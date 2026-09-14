use anyhow::{anyhow, Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig};
use log::{error, info, warn};
use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Runtime};

const EMIT_INTERVAL: Duration = Duration::from_millis(100);
const LEVEL_STALE_AFTER: Duration = Duration::from_millis(500);
const START_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct AudioLevelData {
    pub device_name: String,
    pub device_type: String,
    pub rms_level: f32,
    pub peak_level: f32,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct AudioLevelUpdate {
    pub timestamp: u64,
    pub levels: Vec<AudioLevelData>,
}

#[derive(Clone)]
struct TimedLevel {
    measured_at: Instant,
    data: AudioLevelData,
}

struct MonitorController {
    stop_sender: mpsc::Sender<()>,
    thread: JoinHandle<()>,
}

static CONTROLLER: Lazy<Mutex<Option<MonitorController>>> = Lazy::new(|| Mutex::new(None));
static LIFECYCLE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static IS_MONITORING: AtomicBool = AtomicBool::new(false);

pub async fn start_monitoring<R: Runtime>(
    app_handle: AppHandle<R>,
    device_names: Vec<String>,
) -> Result<()> {
    let _lifecycle = LIFECYCLE.lock().await;
    stop_monitoring_locked().await?;

    if device_names.is_empty() {
        return Err(anyhow!(
            "No microphone devices were provided for monitoring"
        ));
    }

    let (stop_sender, stop_receiver) = mpsc::channel();
    let (ready_sender, ready_receiver) = mpsc::sync_channel(1);
    let thread = std::thread::Builder::new()
        .name("hush-audio-level-monitor".to_string())
        .spawn(move || run_monitor(app_handle, device_names, stop_receiver, ready_sender))
        .context("Failed to start the microphone level monitor thread")?;

    let controller = MonitorController {
        stop_sender,
        thread,
    };
    let ready = tokio::task::spawn_blocking(move || ready_receiver.recv_timeout(START_TIMEOUT))
        .await
        .context("Microphone level monitor startup task failed")?;

    match ready {
        Ok(Ok(())) => {
            *CONTROLLER
                .lock()
                .map_err(|_| anyhow!("Audio level monitor state is poisoned"))? = Some(controller);
            info!("Real microphone level monitoring started");
            Ok(())
        }
        Ok(Err(message)) => {
            stop_and_join(controller).await?;
            Err(anyhow!(message))
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {
            stop_and_join(controller).await?;
            Err(anyhow!(
                "Timed out while opening microphones for level monitoring"
            ))
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            stop_and_join(controller).await?;
            Err(anyhow!(
                "Microphone level monitor stopped before startup completed"
            ))
        }
    }
}

pub async fn stop_monitoring() -> Result<()> {
    let _lifecycle = LIFECYCLE.lock().await;
    stop_monitoring_locked().await
}

pub fn is_monitoring() -> bool {
    IS_MONITORING.load(Ordering::SeqCst)
}

async fn stop_monitoring_locked() -> Result<()> {
    let controller = CONTROLLER
        .lock()
        .map_err(|_| anyhow!("Audio level monitor state is poisoned"))?
        .take();

    if let Some(controller) = controller {
        stop_and_join(controller).await?;
    }

    IS_MONITORING.store(false, Ordering::SeqCst);
    Ok(())
}

async fn stop_and_join(controller: MonitorController) -> Result<()> {
    let _ = controller.stop_sender.send(());
    tokio::task::spawn_blocking(move || controller.thread.join())
        .await
        .context("Microphone level monitor shutdown task failed")?
        .map_err(|_| anyhow!("Microphone level monitor thread panicked"))?;
    Ok(())
}

fn run_monitor<R: Runtime>(
    app_handle: AppHandle<R>,
    device_names: Vec<String>,
    stop_receiver: mpsc::Receiver<()>,
    ready_sender: mpsc::SyncSender<std::result::Result<(), String>>,
) {
    let levels = Arc::new(Mutex::new(HashMap::<String, TimedLevel>::new()));
    let streams = match open_input_streams(&device_names, Arc::clone(&levels)) {
        Ok(streams) => streams,
        Err(error) => {
            let _ = ready_sender.send(Err(error.to_string()));
            return;
        }
    };

    IS_MONITORING.store(true, Ordering::SeqCst);
    if ready_sender.send(Ok(())).is_err() {
        IS_MONITORING.store(false, Ordering::SeqCst);
        return;
    }

    while let Err(mpsc::RecvTimeoutError::Timeout) = stop_receiver.recv_timeout(EMIT_INTERVAL) {
        let measured_levels = match snapshot_levels(&levels) {
            Ok(levels) => levels,
            Err(error) => {
                error!("Failed to read microphone levels: {}", error);
                break;
            }
        };
        let update = AudioLevelUpdate {
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            levels: measured_levels,
        };

        if let Err(error) = app_handle.emit("audio-levels", &update) {
            error!("Failed to emit microphone levels: {}", error);
            break;
        }
    }

    drop(streams);
    IS_MONITORING.store(false, Ordering::SeqCst);
    info!("Real microphone level monitoring stopped");
}

fn open_input_streams(
    device_names: &[String],
    levels: Arc<Mutex<HashMap<String, TimedLevel>>>,
) -> Result<Vec<Stream>> {
    let host = cpal::default_host();
    let mut streams = Vec::new();
    let mut failures = Vec::new();
    let mut seen_devices = HashSet::new();

    for device_name in device_names {
        if !seen_devices.insert(device_name.as_str()) {
            continue;
        }

        let result = find_input_device(&host, device_name).and_then(|device| {
            create_input_level_stream(&device, device_name, Arc::clone(&levels))
        });

        match result {
            Ok(stream) => streams.push(stream),
            Err(error) => {
                warn!("Could not monitor microphone '{}': {}", device_name, error);
                failures.push(format!("{device_name}: {error}"));
            }
        }
    }

    if streams.is_empty() {
        return Err(anyhow!(
            "Could not open any requested microphone for level monitoring: {}",
            failures.join("; ")
        ));
    }

    Ok(streams)
}

fn find_input_device(host: &cpal::Host, device_name: &str) -> Result<cpal::Device> {
    if device_name.eq_ignore_ascii_case("default") {
        return host
            .default_input_device()
            .ok_or_else(|| anyhow!("No default microphone is available"));
    }

    host.input_devices()
        .context("Failed to enumerate microphones")?
        .find(|device| device.name().is_ok_and(|name| name == device_name))
        .ok_or_else(|| anyhow!("Microphone was not found"))
}

fn create_input_level_stream(
    device: &cpal::Device,
    device_name: &str,
    levels: Arc<Mutex<HashMap<String, TimedLevel>>>,
) -> Result<Stream> {
    let supported_config = device
        .default_input_config()
        .with_context(|| format!("No default input configuration for '{device_name}'"))?;
    let sample_format = supported_config.sample_format();
    let stream_config = supported_config.config();

    match sample_format {
        SampleFormat::I8 => build_input_stream::<i8>(device, stream_config, device_name, levels),
        SampleFormat::I16 => build_input_stream::<i16>(device, stream_config, device_name, levels),
        SampleFormat::I32 => build_input_stream::<i32>(device, stream_config, device_name, levels),
        SampleFormat::I64 => build_input_stream::<i64>(device, stream_config, device_name, levels),
        SampleFormat::U8 => build_input_stream::<u8>(device, stream_config, device_name, levels),
        SampleFormat::U16 => build_input_stream::<u16>(device, stream_config, device_name, levels),
        SampleFormat::U32 => build_input_stream::<u32>(device, stream_config, device_name, levels),
        SampleFormat::U64 => build_input_stream::<u64>(device, stream_config, device_name, levels),
        SampleFormat::F32 => build_input_stream::<f32>(device, stream_config, device_name, levels),
        SampleFormat::F64 => build_input_stream::<f64>(device, stream_config, device_name, levels),
        _ => Err(anyhow!(
            "Unsupported microphone sample format: {sample_format}"
        )),
    }
}

fn build_input_stream<T>(
    device: &cpal::Device,
    config: StreamConfig,
    device_name: &str,
    levels: Arc<Mutex<HashMap<String, TimedLevel>>>,
) -> Result<Stream>
where
    T: Sample + SizedSample + Send + 'static,
    f32: FromSample<T>,
{
    let channels = config.channels;
    let callback_device_name = device_name.to_string();
    let error_device_name = device_name.to_string();
    let stream = device.build_input_stream(
        &config,
        move |data: &[T], _| {
            process_audio_levels(data, channels, &callback_device_name, &levels);
        },
        move |error| {
            error!(
                "Microphone level stream error for '{}': {}",
                error_device_name, error
            )
        },
        None,
    )?;
    stream.play()?;
    Ok(stream)
}

fn process_audio_levels<T>(
    data: &[T],
    channels: u16,
    device_name: &str,
    levels: &Mutex<HashMap<String, TimedLevel>>,
) where
    T: Sample + Copy,
    f32: FromSample<T>,
{
    let Some((rms, peak)) = calculate_audio_levels(data, channels) else {
        return;
    };
    let level = AudioLevelData {
        device_name: device_name.to_string(),
        device_type: "input".to_string(),
        rms_level: rms.clamp(0.0, 1.0),
        peak_level: peak.clamp(0.0, 1.0),
        is_active: rms > 0.001,
    };

    if let Ok(mut levels) = levels.try_lock() {
        levels.insert(
            device_name.to_string(),
            TimedLevel {
                measured_at: Instant::now(),
                data: level,
            },
        );
    }
}

fn calculate_audio_levels<T>(data: &[T], channels: u16) -> Option<(f32, f32)>
where
    T: Sample + Copy,
    f32: FromSample<T>,
{
    let channels = usize::from(channels);
    if data.is_empty() || channels == 0 {
        return None;
    }

    let mut squared_sum = 0.0f32;
    let mut peak = 0.0f32;
    let mut frame_count = 0usize;

    for frame in data.chunks(channels) {
        let mono = frame
            .iter()
            .copied()
            .map(|sample| sample.to_sample::<f32>())
            .map(|sample| if sample.is_finite() { sample } else { 0.0 })
            .sum::<f32>()
            / frame.len() as f32;
        squared_sum += mono * mono;
        peak = peak.max(mono.abs());
        frame_count += 1;
    }

    Some(((squared_sum / frame_count as f32).sqrt(), peak))
}

fn snapshot_levels(levels: &Mutex<HashMap<String, TimedLevel>>) -> Result<Vec<AudioLevelData>> {
    let now = Instant::now();
    let mut levels = levels
        .lock()
        .map_err(|_| anyhow!("Microphone level data is poisoned"))?;
    levels.retain(|_, level| now.duration_since(level.measured_at) <= LEVEL_STALE_AFTER);

    let mut snapshot = levels
        .values()
        .map(|level| level.data.clone())
        .collect::<Vec<_>>();
    snapshot.sort_by(|left, right| left.device_name.cmp(&right.device_name));
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_reports_zero_levels() {
        let (rms, peak) = calculate_audio_levels(&[0.0f32; 8], 1).unwrap();
        assert_eq!(rms, 0.0);
        assert_eq!(peak, 0.0);
    }

    #[test]
    fn mono_levels_report_rms_and_peak() {
        let (rms, peak) = calculate_audio_levels(&[0.5f32, -0.5, 0.5, -0.5], 1).unwrap();
        assert!((rms - 0.5).abs() < f32::EPSILON);
        assert!((peak - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn stereo_levels_are_mixed_to_mono_by_frame() {
        let (rms, peak) = calculate_audio_levels(&[0.5f32, -0.5, 1.0, 1.0], 2).unwrap();
        assert!((rms - std::f32::consts::FRAC_1_SQRT_2).abs() < 0.0001);
        assert!((peak - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn empty_or_invalid_channel_input_has_no_measurement() {
        assert_eq!(calculate_audio_levels::<f32>(&[], 1), None);
        assert_eq!(calculate_audio_levels(&[0.5f32], 0), None);
    }

    #[test]
    fn non_finite_samples_do_not_escape_into_events() {
        let (rms, peak) = calculate_audio_levels(&[f32::NAN, f32::INFINITY, 0.5f32], 1).unwrap();
        assert!(rms.is_finite());
        assert!(peak.is_finite());
        assert!((peak - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn stale_levels_are_removed_from_snapshots() {
        let levels = Mutex::new(HashMap::from([(
            "Test Mic".to_string(),
            TimedLevel {
                measured_at: Instant::now() - LEVEL_STALE_AFTER - Duration::from_millis(1),
                data: AudioLevelData {
                    device_name: "Test Mic".to_string(),
                    device_type: "input".to_string(),
                    rms_level: 0.8,
                    peak_level: 0.9,
                    is_active: true,
                },
            },
        )]));

        assert!(snapshot_levels(&levels).unwrap().is_empty());
    }
}

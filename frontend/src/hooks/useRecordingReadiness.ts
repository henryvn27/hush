import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  deriveRecordingReadiness,
  RecordingReadiness,
} from '@/lib/recording-readiness';
import { withTimeout } from '@/lib/with-timeout';
import type { SelectedDevices } from '@/components/DeviceSelection';

interface AudioDevice {
  name: string;
  device_type: 'Input' | 'Output';
}

interface ParakeetModel {
  status?: string | Record<string, unknown>;
}

interface ReadinessSnapshot {
  isChecking: boolean;
  audioError: string | null;
  inputDevices: string[];
  outputDevices: string[];
  modelState: 'checking' | 'ready' | 'downloading' | 'missing' | 'error';
  modelError: string | null;
}

const initialSnapshot: ReadinessSnapshot = {
  isChecking: true,
  audioError: null,
  inputDevices: [],
  outputDevices: [],
  modelState: 'checking',
  modelError: null,
};

function isDownloadingModel(model: ParakeetModel): boolean {
  if (model.status === 'Downloading') return true;
  return Boolean(model.status && typeof model.status === 'object' && 'Downloading' in model.status);
}

export function useRecordingReadiness(selectedDevices: SelectedDevices) {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot>(initialSnapshot);

  const refresh = useCallback(async () => {
    setSnapshot(initialSnapshot);

    const usesDefaultDevices = !selectedDevices.micDevice && !selectedDevices.systemDevice;
    const audioOperation = usesDefaultDevices
      ? Promise.resolve([{ name: 'Default microphone', device_type: 'Input' as const }])
      : invoke<AudioDevice[]>('get_audio_devices');

    const [audioResult, modelResult] = await Promise.allSettled([
      withTimeout(
        audioOperation,
        'Audio-device check timed out. Check macOS audio permissions, then try again.',
      ),
      withTimeout((async () => {
        await invoke('parakeet_init');
        const hasAvailableModels = await invoke<boolean>('parakeet_has_available_models');
        if (hasAvailableModels) {
          return { state: 'ready' as const, error: null };
        }

        const models = await invoke<ParakeetModel[]>('parakeet_get_available_models');
        return {
          state: models.some(isDownloadingModel) ? 'downloading' as const : 'missing' as const,
          error: null,
        };
      })(), 'Local-model check timed out. Restart Hush, then try again.'),
    ]);

    const audioDevices = audioResult.status === 'fulfilled' ? audioResult.value : [];
    const audioError = audioResult.status === 'rejected'
      ? audioResult.reason instanceof Error
        ? audioResult.reason.message
        : String(audioResult.reason || 'Unknown audio-device error')
      : null;
    const modelState = modelResult.status === 'fulfilled' ? modelResult.value.state : 'error';
    const modelError = modelResult.status === 'rejected'
      ? modelResult.reason instanceof Error
        ? modelResult.reason.message
        : String(modelResult.reason || 'Unknown model error')
      : null;

    setSnapshot({
      isChecking: false,
      audioError,
      inputDevices: audioDevices.filter(device => device.device_type === 'Input').map(device => device.name),
      outputDevices: audioDevices.filter(device => device.device_type === 'Output').map(device => device.name),
      modelState,
      modelError,
    });
  }, [selectedDevices.micDevice, selectedDevices.systemDevice]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const readiness: RecordingReadiness = useMemo(() => deriveRecordingReadiness({
    ...snapshot,
    selectedMicrophone: selectedDevices.micDevice,
    selectedSystemAudio: selectedDevices.systemDevice,
  }), [selectedDevices.micDevice, selectedDevices.systemDevice, snapshot]);

  return {
    ...readiness,
    isChecking: snapshot.isChecking,
    refresh,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { recordingService } from '@/services/recordingService';
import Analytics from '@/lib/analytics';
import { showRecordingNotification } from '@/lib/recordingNotification';
import { withTimeout } from '@/lib/with-timeout';
import { toast } from 'sonner';
import { ParakeetModelInfo } from '@/lib/parakeet';
import { ModelInfo as WhisperModelInfo } from '@/lib/whisper';

interface UseRecordingStartReturn {
  handleRecordingStart: () => Promise<void>;
  isAutoStarting: boolean;
}

/**
 * Custom hook for managing recording start lifecycle.
 * Handles both manual start (button click) and auto-start (from sidebar navigation).
 *
 * Features:
 * - Meeting title generation (format: Meeting DD_MM_YY_HH_MM_SS)
 * - Transcript clearing on start
 * - Analytics tracking
 * - Recording notification display
 * - Auto-start from sidebar via sessionStorage flag
 */
export function useRecordingStart(
  isRecording: boolean,
  setIsRecording: (value: boolean) => void,
  showModal?: (name: 'modelSelector', message?: string) => void
): UseRecordingStartReturn {
  const [isAutoStarting, setIsAutoStarting] = useState(false);

  const { clearTranscripts, setMeetingTitle } = useTranscripts();
  const { setIsMeetingActive } = useSidebar();
  const { selectedDevices, transcriptModelConfig } = useConfig();
  const { status, setStatus } = useRecordingState();
  const isPostProcessing = [
    RecordingStatus.STOPPING,
    RecordingStatus.PROCESSING_TRANSCRIPTS,
    RecordingStatus.SAVING,
  ].includes(status);

  // Generate meeting title with timestamp
  const generateMeetingTitle = useCallback(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `Meeting ${day}_${month}_${year}_${hours}_${minutes}_${seconds}`;
  }, []);

  // Check only the engine selected in settings. A missing Parakeet model must
  // never block a user who selected Whisper (or a remote provider).
  const checkTranscriptionReady = useCallback(async (): Promise<boolean> => {
    const { provider, model } = transcriptModelConfig;
    if (provider !== 'parakeet' && provider !== 'localWhisper') return true;

    try {
      if (provider === 'parakeet') {
        await invoke('parakeet_init');
        const models = await invoke<ParakeetModelInfo[]>('parakeet_get_available_models');
        return models.some((item) => item.name === model && item.status === 'Available');
      }

      const models = await invoke<WhisperModelInfo[]>('whisper_get_available_models');
      return models.some((item) => item.name === model && item.status === 'Available');
    } catch (error) {
      console.error(`Failed to check ${provider} transcription status:`, error);
      return false;
    }
  }, [transcriptModelConfig]);

  // Check download state for the configured engine only.
  const checkIfModelDownloading = useCallback(async (): Promise<boolean> => {
    try {
      if (transcriptModelConfig.provider !== 'parakeet' && transcriptModelConfig.provider !== 'localWhisper') {
        return false;
      }

      const models = transcriptModelConfig.provider === 'parakeet'
        ? await invoke<ParakeetModelInfo[]>('parakeet_get_available_models')
        : await invoke<WhisperModelInfo[]>('whisper_get_available_models');
      return models.some(m => typeof m.status === 'object' && 'Downloading' in m.status);
    } catch (error) {
      console.error('Failed to check model download status:', error);
      return false; // Default to not downloading (will show error + modal)
    }
  }, [transcriptModelConfig.provider]);

  const ensureMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await invoke<boolean>('trigger_microphone_permission');
      if (granted) return true;

      toast.error('Microphone access is required', {
        description: 'Allow Hush to use your microphone in System Settings before starting a recording.',
        duration: 7000,
      });
      return false;
    } catch (error) {
      console.error('Failed to request microphone permission:', error);
      toast.error('Microphone permission could not be requested', {
        description: error instanceof Error ? error.message : 'Check microphone access in System Settings and try again.',
        duration: 7000,
      });
      return false;
    }
  }, []);

  const ensureAudioDeviceReady = useCallback(async (): Promise<boolean> => {
    if (!selectedDevices.micDevice && !selectedDevices.systemDevice) return true;

    try {
      const devices = await withTimeout(
        invoke<Array<{ device_type: 'Input' | 'Output' }>>('get_audio_devices'),
        'Audio-device check timed out.',
      );
      if (devices.some(device => device.device_type === 'Input')) return true;
    } catch (error) {
      console.error('Failed to check audio devices before recording:', error);
    }

    toast.error('Audio input is not ready', {
      description: 'Check macOS audio permissions and your microphone, then try again.',
      duration: 7000,
    });
    return false;
  }, [selectedDevices.micDevice, selectedDevices.systemDevice]);

  const captureFocusedAppIfEnabled = useCallback(async () => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    if (window.localStorage.getItem('hush-insert-at-cursor') !== 'true') return;

    try {
      await invoke('capture_focused_app');
    } catch (error) {
      // A failed capture should not block recording; stop falls back to copying.
      console.warn('Could not capture the focused app for insertion:', error);
    }
  }, []);

  // Handle manual recording start (from button click)
  const handleRecordingStart = useCallback(async () => {
    if (isPostProcessing) return;

    try {
      console.log('handleRecordingStart called - checking selected transcription model status');

      if (!await ensureMicrophonePermission()) {
        setStatus(RecordingStatus.IDLE);
        return;
      }
      if (!await ensureAudioDeviceReady()) {
        setStatus(RecordingStatus.IDLE);
        return;
      }

      const transcriptionReady = await checkTranscriptionReady();
      if (!transcriptionReady) {
        const isDownloading = await checkIfModelDownloading();
        if (isDownloading) {
          toast.info('Model download in progress', {
            description: 'Please wait for the transcription model to finish downloading before recording.',
            duration: 5000,
          });
          Analytics.trackButtonClick('start_recording_blocked_downloading', 'home_page');
        } else {
          toast.error('Transcription model not ready', {
            description: 'Please download a transcription model before recording.',
            duration: 5000,
          });
          showModal?.('modelSelector', 'Transcription model setup required');
          Analytics.trackButtonClick('start_recording_blocked_missing', 'home_page');
        }
        setStatus(RecordingStatus.IDLE);
        return;
      }

      console.log('Selected transcription model ready - setting up meeting title and state');

      const randomTitle = generateMeetingTitle();
      setMeetingTitle(randomTitle);

      // Set STARTING status before initiating backend recording
      setStatus(RecordingStatus.STARTING, 'Initializing recording...');
      await captureFocusedAppIfEnabled();

      // Start the actual backend recording
      console.log('Starting backend recording with meeting:', randomTitle);
      await recordingService.startRecordingWithDevices(
        selectedDevices?.micDevice || null,
        selectedDevices?.systemDevice || null,
        randomTitle
      );
      console.log('Backend recording started successfully');

      // Update state after successful backend start
      // Note: RECORDING status will be set by RecordingStateContext event listener
      console.log('Setting isRecordingState to true');
      setIsRecording(true); // This will also update the sidebar via the useEffect
      clearTranscripts(); // Clear previous transcripts when starting new recording
      setIsMeetingActive(true);
      void emit('hush-recording-lifecycle', { status: RecordingStatus.RECORDING });
      Analytics.trackButtonClick('start_recording', 'home_page');

      // Show recording notification if enabled
      await showRecordingNotification();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setStatus(RecordingStatus.ERROR, error instanceof Error ? error.message : 'Failed to start recording');
      setIsRecording(false); // Reset state on error
      Analytics.trackButtonClick('start_recording_error', 'home_page');
      // Re-throw so RecordingControls can handle device-specific errors
      throw error;
    }
  }, [generateMeetingTitle, setMeetingTitle, setIsRecording, clearTranscripts, setIsMeetingActive, checkTranscriptionReady, checkIfModelDownloading, ensureMicrophonePermission, ensureAudioDeviceReady, selectedDevices, showModal, setStatus, isPostProcessing, captureFocusedAppIfEnabled]);

  // Legacy sidebar auto-start flags must never initiate capture without the New Meeting confirmation surface.
  useEffect(() => {
    sessionStorage.removeItem('autoStartRecording');
  }, []);

  // Check for autoStartRecording flag and start recording automatically
  useEffect(() => {
    const checkAutoStartRecording = async () => {
      if (typeof window !== 'undefined') {
        const shouldAutoStart = sessionStorage.getItem('autoStartRecording');
        if (shouldAutoStart === 'true' && isPostProcessing) {
          sessionStorage.removeItem('autoStartRecording');
          return;
        }
        if (shouldAutoStart === 'true' && !isRecording && !isAutoStarting) {
          console.log('Auto-starting recording from navigation...');
          setIsAutoStarting(true);
          sessionStorage.removeItem('autoStartRecording'); // Clear the flag

          if (!await ensureMicrophonePermission()) {
            setStatus(RecordingStatus.IDLE);
            setIsAutoStarting(false);
            return;
          }
          if (!await ensureAudioDeviceReady()) {
            setStatus(RecordingStatus.IDLE);
            setIsAutoStarting(false);
            return;
          }

          // Check the selected transcription model before starting
          const transcriptionReady = await checkTranscriptionReady();
          if (!transcriptionReady) {
            const isDownloading = await checkIfModelDownloading();
            if (isDownloading) {
              toast.info('Model download in progress', {
                description: 'Please wait for the transcription model to finish downloading before recording.',
                duration: 5000,
              });
              Analytics.trackButtonClick('start_recording_blocked_downloading', 'sidebar_auto');
            } else {
              toast.error('Transcription model not ready', {
                description: 'Please download a transcription model before recording.',
                duration: 5000,
              });
              showModal?.('modelSelector', 'Transcription model setup required');
              Analytics.trackButtonClick('start_recording_blocked_missing', 'sidebar_auto');
            }
            setStatus(RecordingStatus.IDLE);
            setIsAutoStarting(false);
            return;
          }

          // Start the actual backend recording
          try {
            // Generate meeting title
            const generatedMeetingTitle = generateMeetingTitle();

            // Set STARTING status before initiating backend recording
            setStatus(RecordingStatus.STARTING, 'Initializing recording...');
            await captureFocusedAppIfEnabled();

            console.log('Auto-starting backend recording with meeting:', generatedMeetingTitle);
            const result = await recordingService.startRecordingWithDevices(
              selectedDevices?.micDevice || null,
              selectedDevices?.systemDevice || null,
              generatedMeetingTitle
            );
            console.log('Auto-start backend recording result:', result);

            // Update UI state after successful backend start
            // Note: RECORDING status will be set by RecordingStateContext event listener
            setMeetingTitle(generatedMeetingTitle);
            setIsRecording(true);
            clearTranscripts();
            setIsMeetingActive(true);
            void emit('hush-recording-lifecycle', { status: RecordingStatus.RECORDING });
            Analytics.trackButtonClick('start_recording', 'sidebar_auto');

            // Show recording notification if enabled
            await showRecordingNotification();
          } catch (error) {
            console.error('Failed to auto-start recording:', error);
            setStatus(RecordingStatus.ERROR, error instanceof Error ? error.message : 'Failed to auto-start recording');
            alert('Failed to start recording. Check console for details.');
            Analytics.trackButtonClick('start_recording_error', 'sidebar_auto');
          } finally {
            setIsAutoStarting(false);
          }
        }
      }
    };

    checkAutoStartRecording();
  }, [
    isRecording,
    isAutoStarting,
    selectedDevices,
    generateMeetingTitle,
    setMeetingTitle,
    setIsRecording,
    clearTranscripts,
    setIsMeetingActive,
    checkTranscriptionReady,
    checkIfModelDownloading,
    ensureMicrophonePermission,
    ensureAudioDeviceReady,
    showModal,
    setStatus,
    isPostProcessing,
    captureFocusedAppIfEnabled,
  ]);

  // Listen for direct recording trigger from sidebar when already on home page
  useEffect(() => {
    const handleDirectStart = async () => {
      if (isRecording || isAutoStarting || isPostProcessing) {
        console.log('Recording or local save already in progress, ignoring direct start event');
        return;
      }

      console.log('Direct start from sidebar - checking selected transcription model status');
      setIsAutoStarting(true);

      if (!await ensureMicrophonePermission()) {
        setStatus(RecordingStatus.IDLE);
        setIsAutoStarting(false);
        return;
      }
      if (!await ensureAudioDeviceReady()) {
        setStatus(RecordingStatus.IDLE);
        setIsAutoStarting(false);
        return;
      }

      const transcriptionReady = await checkTranscriptionReady();
      if (!transcriptionReady) {
        const isDownloading = await checkIfModelDownloading();
        if (isDownloading) {
          toast.info('Model download in progress', {
            description: 'Please wait for the transcription model to finish downloading before recording.',
            duration: 5000,
          });
          Analytics.trackButtonClick('start_recording_blocked_downloading', 'sidebar_direct');
        } else {
          toast.error('Transcription model not ready', {
            description: 'Please download a transcription model before recording.',
            duration: 5000,
          });
          showModal?.('modelSelector', 'Transcription model setup required');
          Analytics.trackButtonClick('start_recording_blocked_missing', 'sidebar_direct');
        }
        setStatus(RecordingStatus.IDLE);
        setIsAutoStarting(false);
        return;
      }

      try {
        // Generate meeting title
        const generatedMeetingTitle = generateMeetingTitle();

        // Set STARTING status before initiating backend recording
        setStatus(RecordingStatus.STARTING, 'Initializing recording...');
        await captureFocusedAppIfEnabled();

        console.log('Starting backend recording with meeting:', generatedMeetingTitle);
        const result = await recordingService.startRecordingWithDevices(
          selectedDevices?.micDevice || null,
          selectedDevices?.systemDevice || null,
          generatedMeetingTitle
        );
        console.log('Backend recording result:', result);

        // Update UI state after successful backend start
        // Note: RECORDING status will be set by RecordingStateContext event listener
        setMeetingTitle(generatedMeetingTitle);
        setIsRecording(true);
        clearTranscripts();
        setIsMeetingActive(true);
        void emit('hush-recording-lifecycle', { status: RecordingStatus.RECORDING });
        Analytics.trackButtonClick('start_recording', 'sidebar_direct');

        // Show recording notification if enabled
        await showRecordingNotification();
      } catch (error) {
        console.error('Failed to start recording from sidebar:', error);
        setStatus(RecordingStatus.ERROR, error instanceof Error ? error.message : 'Failed to start recording from sidebar');
        alert('Failed to start recording. Check console for details.');
        Analytics.trackButtonClick('start_recording_error', 'sidebar_direct');
      } finally {
        setIsAutoStarting(false);
      }
    };

    window.addEventListener('start-recording-from-sidebar', handleDirectStart);

    return () => {
      window.removeEventListener('start-recording-from-sidebar', handleDirectStart);
    };
  }, [
    isRecording,
    isAutoStarting,
    selectedDevices,
    generateMeetingTitle,
    setMeetingTitle,
    setIsRecording,
    clearTranscripts,
    setIsMeetingActive,
    checkTranscriptionReady,
    checkIfModelDownloading,
    ensureMicrophonePermission,
    ensureAudioDeviceReady,
    showModal,
    setStatus,
    isPostProcessing,
    captureFocusedAppIfEnabled,
  ]);

  return {
    handleRecordingStart,
    isAutoStarting,
  };
}

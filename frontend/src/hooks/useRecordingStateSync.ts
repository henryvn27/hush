import { useState, useEffect } from 'react';
import { useRecordingState } from '@/contexts/RecordingStateContext';

interface UseRecordingStateSyncReturn {
  isBackendRecording: boolean;
  isRecordingDisabled: boolean;
  setIsRecordingDisabled: (value: boolean) => void;
}

/**
 * Custom hook for adapting the shared recording context to the page-level
 * setter API used by the start/stop workflows. Backend synchronization lives
 * in RecordingStateProvider, so this hook does not create another IPC poller.
 *
 * Features:
 * - Event-driven backend state synchronization via RecordingStateProvider
 * - Recording disabled flag management (prevents re-recording during processing)
 */
export function useRecordingStateSync(
  isRecording: boolean,
  setIsRecording: (value: boolean) => void,
  setIsMeetingActive: (value: boolean) => void
): UseRecordingStateSyncReturn {
  const [isRecordingDisabled, setIsRecordingDisabled] = useState(false);
  const { isRecording: backendRecording } = useRecordingState();

  useEffect(() => {
    if (backendRecording === isRecording) return;

    setIsRecording(backendRecording);
    if (backendRecording) setIsMeetingActive(true);
  }, [backendRecording, isRecording, setIsRecording, setIsMeetingActive]);

  return {
    isBackendRecording: backendRecording,
    isRecordingDisabled,
    setIsRecordingDisabled,
  };
}

'use client';

import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { useRecordingStop } from '@/hooks/useRecordingStop';
import { recordingService } from '@/services/recordingService';
import { readLastTranscript } from '@/lib/last-transcript';
import { toast } from 'sonner';

/**
 * RecordingPostProcessingProvider
 *
 * This provider handles post-processing when recording stops from any source:
 * - Tray menu stop
 * - Global keyboard shortcut
 * - Overlay stop button
 * - Main UI stop button
 *
 * It listens for the 'recording-stop-complete' event from Rust backend
 * and triggers the full post-processing flow (save to database, navigate, analytics)
 * regardless of which page the user is currently on.
 */
export function RecordingPostProcessingProvider({ children }: { children: React.ReactNode }) {
  // No-op functions since the global RecordingStateContext already handles state updates
  // These are only needed for the hook's local component state management
  const setIsRecording = () => { };
  const setIsRecordingDisabled = () => { };

  const {
    handleRecordingStop,
    handleRecordingCancel,
  } = useRecordingStop(setIsRecording, setIsRecordingDisabled);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      try {
        // Listen for recording-stop-complete event from Rust
        unlistenFn = await listen<boolean>('recording-stop-complete', (event) => {
          console.log('[RecordingPostProcessing] Received recording-stop-complete event:', event.payload);

          // Call the post-processing handler
          // event.payload is the callApi boolean (true for normal stops)
          handleRecordingStop(event.payload);
        });

        console.log('[RecordingPostProcessing] Event listener set up successfully');
      } catch (error) {
        console.error('[RecordingPostProcessing] Failed to set up event listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        console.log('[RecordingPostProcessing] Cleaning up event listener');
        unlistenFn();
      }
    };
  }, [handleRecordingStop]);

  useEffect(() => {
    let cancelInFlight = false;
    const handleCancel = async () => {
      if (cancelInFlight) return;
      cancelInFlight = true;
      try {
        await recordingService.cancelRecording();
        await handleRecordingCancel();
      } catch (error) {
        console.error('Failed to cancel recording from the Hush Flow Bar:', error);
      } finally {
        cancelInFlight = false;
      }
    };
    window.addEventListener('request-recording-cancel', handleCancel);
    return () => window.removeEventListener('request-recording-cancel', handleCancel);
  }, [handleRecordingCancel]);

  useEffect(() => {
    let pasteInFlight = false;
    const handlePasteLast = async () => {
      if (pasteInFlight) return;
      const transcript = readLastTranscript();
      if (!transcript) {
        toast.info('No finished dictation yet', {
          description: 'Complete a local dictation first, then it will be available here.',
        });
        return;
      }

      pasteInFlight = true;
      try {
        if ('__TAURI_INTERNALS__' in window) {
          await invoke('focus_captured_app');
          await invoke('paste_text_at_cursor', { text: transcript });
          toast.success('Last dictation pasted');
        } else {
          await navigator.clipboard.writeText(transcript);
          toast.success('Last dictation copied', {
            description: 'The browser preview cannot paste into another app.',
          });
        }
      } catch (error) {
        try {
          await navigator.clipboard.writeText(transcript);
          toast.warning('Last dictation copied instead', {
            description: 'Allow Hush in macOS Accessibility settings to paste automatically.',
          });
        } catch (clipboardError) {
          console.warn('Could not copy the last dictation:', clipboardError);
          toast.error('Could not paste the last dictation', {
            description: error instanceof Error ? error.message : 'Try again after enabling Accessibility.',
          });
        }
      } finally {
        pasteInFlight = false;
      }
    };

    window.addEventListener('request-paste-last', handlePasteLast);
    return () => window.removeEventListener('request-paste-last', handlePasteLast);
  }, []);

  useEffect(() => {
    let stopInFlight = false;

    const handleShortcutStop = async () => {
      if (stopInFlight) return;
      stopInFlight = true;

      try {
        const dataDir = await appDataDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await recordingService.stopRecording(`${dataDir}/recording-${timestamp}.wav`);
        await handleRecordingStop(true);
      } catch (error) {
        console.error('Failed to stop recording from the Hush shortcut:', error);
        await handleRecordingStop(false);
      } finally {
        stopInFlight = false;
      }
    };

    window.addEventListener('stop-recording-from-sidebar', handleShortcutStop);
    return () => window.removeEventListener('stop-recording-from-sidebar', handleShortcutStop);
  }, [handleRecordingStop]);

  return <>{children}</>;
}

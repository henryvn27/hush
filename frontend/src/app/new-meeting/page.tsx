'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { useConfig } from '@/contexts/ConfigContext';
import Analytics from '@/lib/analytics';
import { SettingsModals } from '@/app/_components/SettingsModal';
import { useModalState } from '@/hooks/useModalState';
import { useRecordingStateSync } from '@/hooks/useRecordingStateSync';
import { useRecordingStart } from '@/hooks/useRecordingStart';
import { useRecordingStop } from '@/hooks/useRecordingStop';
import { useTranscriptRecovery } from '@/hooks/useTranscriptRecovery';
import { TranscriptRecovery } from '@/components/TranscriptRecovery';
import { indexedDBService } from '@/services/indexedDBService';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { PreRecordingWorkspace } from '@/components/recording/PreRecordingWorkspace';
import { ActiveRecordingWorkspace } from '@/components/recording/ActiveRecordingWorkspace';
import { PostRecordingWorkspace } from '@/components/recording/PostRecordingWorkspace';
import { getAudioRecoveryDescription } from '@/lib/transcript-recovery';

export default function NewMeetingPage() {
  // Local page state (not moved to contexts)
  const [isRecording, setIsRecordingState] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [hasPostRecordingStarted, setHasPostRecordingStarted] = useState(false);
  const autoStartRequested = useRef(false);

  // Use contexts for state management
  const { transcriptModelConfig, selectedDevices } = useConfig();
  const recordingState = useRecordingState();

  // Extract status from global state
  const { status, isStopping, isProcessing } = recordingState;

  // Hooks
  const { setIsMeetingActive, refetchMeetings } = useSidebar();
  const { modals, messages, showModal, hideModal } = useModalState(transcriptModelConfig);
  const { setIsRecordingDisabled } = useRecordingStateSync(isRecording, setIsRecordingState, setIsMeetingActive);
  const { handleRecordingStart } = useRecordingStart(isRecording, setIsRecordingState, showModal);

  // Get handleRecordingStop function and setIsStopping (state comes from global context)
  const { handleRecordingStop, setIsStopping } = useRecordingStop(
    setIsRecordingState,
    setIsRecordingDisabled
  );

  // Recovery hook
  const {
    recoverableMeetings,
    checkForRecoverableTranscripts,
    recoverMeeting,
    loadMeetingTranscripts,
    deleteRecoverableMeeting
  } = useTranscriptRecovery();

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page view
    Analytics.trackPageView('new_meeting');
  }, []);

  useEffect(() => {
    if (
      searchParams.get('autostart') !== '1'
      || autoStartRequested.current
      || recordingState.isRecording
      || status !== RecordingStatus.IDLE
    ) return;

    autoStartRequested.current = true;
    void handleRecordingStart();
  }, [handleRecordingStart, recordingState.isRecording, searchParams, status]);

  useEffect(() => {
    if ([
      RecordingStatus.STOPPING,
      RecordingStatus.PROCESSING_TRANSCRIPTS,
      RecordingStatus.SAVING,
      RecordingStatus.COMPLETED,
    ].includes(status)) {
      setHasPostRecordingStarted(true);
    } else if ([RecordingStatus.IDLE, RecordingStatus.STARTING, RecordingStatus.RECORDING].includes(status)) {
      setHasPostRecordingStarted(false);
    }
  }, [status]);

  // Startup recovery check
  useEffect(() => {
    const performStartupChecks = async () => {
      try {
        // Skip recovery check if currently recording or processing stop
        // This prevents the recovery dialog from showing when:
        if (recordingState.isRecording ||
          status === RecordingStatus.STOPPING ||
          status === RecordingStatus.PROCESSING_TRANSCRIPTS ||
          status === RecordingStatus.SAVING) {
          console.log('Skipping recovery check - recording in progress or processing');
          return;
        }

        // 1. Clean up old meetings (7+ days)
        try {
          await indexedDBService.deleteOldMeetings(7);
        } catch (error) {
          console.warn('⚠️ Failed to clean up old meetings:', error);
        }

        // 2. Clean up saved meetings (24+ hours after save)
        try {
          await indexedDBService.deleteSavedMeetings(24);
        } catch (error) {
          console.warn('⚠️ Failed to clean up saved meetings:', error);
        }

        // 3. Always check for recoverable meetings on startup
        // Don't skip based on sessionStorage - we need to check every time
        await checkForRecoverableTranscripts();
      } catch (error) {
        console.error('Failed to perform startup checks:', error);
      }
    };

    performStartupChecks();
  }, [checkForRecoverableTranscripts, recordingState.isRecording, status]);

  // Watch for recoverable meetings changes and show dialog once per session
  useEffect(() => {
    // Only show dialog if we have meetings and haven't shown it yet this session
    if (recoverableMeetings.length > 0) {
      const shownThisSession = sessionStorage.getItem('recovery_dialog_shown');
      if (!shownThisSession) {
        setShowRecoveryDialog(true);
        sessionStorage.setItem('recovery_dialog_shown', 'true');
      }
    }
  }, [recoverableMeetings]);

  useEffect(() => {
    if (status === RecordingStatus.ERROR) {
      void checkForRecoverableTranscripts();
    }
  }, [checkForRecoverableTranscripts, status]);

  // Handle recovery with toast notifications and navigation
  const handleRecovery = async (meetingId: string) => {
    try {
      const result = await recoverMeeting(meetingId);

      if (result.success) {
        toast.success('Meeting recovered successfully!', {
          description: getAudioRecoveryDescription(result.audioRecoveryStatus?.status),
          action: result.meetingId ? {
            label: 'View Meeting',
            onClick: () => {
              router.push(`/meeting-details?id=${result.meetingId}`);
            }
          } : undefined,
          duration: 10000,
        });

        // Refresh sidebar to show the newly recovered meeting
        await refetchMeetings();

        // If no more recoverable meetings, clear session flag so dialog can show again
        if (recoverableMeetings.length === 0) {
          sessionStorage.removeItem('recovery_dialog_shown');
        }

        // Auto-navigate after a short delay
        if (result.meetingId) {
          setTimeout(() => {
            router.push(`/meeting-details?id=${result.meetingId}`);
          }, 2000);
        }
      }
      return result;
    } catch (error) {
      toast.error('Failed to recover meeting', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  };

  // Handle dialog close - clear session flag if no meetings left
  const handleDialogClose = () => {
    setShowRecoveryDialog(false);
    // If user closes dialog and there are no more meetings, clear the flag
    // This allows the dialog to show again next session if new meetings appear
    if (recoverableMeetings.length === 0) {
      sessionStorage.removeItem('recovery_dialog_shown');
    }
  };

  const handleRetryRecovery = async () => {
    const candidates = await checkForRecoverableTranscripts();
    const candidate = candidates[0];
    if (!candidate) {
      toast.error('No local recovery copy found', {
        description: 'Hush could not find a checkpoint to retry. The original error is still available above.',
      });
      return;
    }
    await handleRecovery(candidate.meetingId);
  };

  // Computed values using global status
  const isProcessingStop = status === RecordingStatus.PROCESSING_TRANSCRIPTS || isProcessing;
  const showPreRecording = !recordingState.isRecording && (
    [RecordingStatus.IDLE, RecordingStatus.STARTING].includes(status)
    || (status === RecordingStatus.ERROR && !hasPostRecordingStarted)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex h-full flex-col bg-background"
    >
      <h1 className="sr-only">New meeting</h1>
      {/* All Modals supported*/}
      <SettingsModals
        modals={modals}
        messages={messages}
        onClose={hideModal}
      />

      {/* Recovery Dialog */}
      <TranscriptRecovery
        isOpen={showRecoveryDialog}
        onClose={handleDialogClose}
        recoverableMeetings={recoverableMeetings}
        onRecover={handleRecovery}
        onDelete={deleteRecoverableMeeting}
        onLoadPreview={loadMeetingTranscripts}
      />
      {showPreRecording ? (
        <PreRecordingWorkspace
          selectedDevices={selectedDevices}
          status={status}
          statusMessage={recordingState.statusMessage}
          onStart={handleRecordingStart}
          showModal={showModal}
        />
      ) : recordingState.isRecording ? (
        <ActiveRecordingWorkspace
          isProcessingStop={isProcessingStop}
          isStopping={isStopping}
          onRecordingStop={(callApi = true) => handleRecordingStop(callApi)}
          onStopInitiated={() => setIsStopping(true)}
          showModal={showModal}
        />
      ) : (
        <PostRecordingWorkspace
          hasRecoveryCopy={recoverableMeetings.length > 0}
          onRetryRecovery={handleRetryRecovery}
          onOpenRecovery={() => setShowRecoveryDialog(true)}
        />
      )}
    </motion.div>
  );
}

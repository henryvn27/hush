import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ArrowDownTrayIcon, ArrowPathIcon, CheckIcon, CpuChipIcon, LanguageIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { getSummaryModelSizeLabel, getSummaryModelSizeMb } from '@/lib/onboarding-summary-model';
import { isNativeQaMode } from '@/lib/native-qa-mode';

const PARAKEET_MODEL = 'parakeet-tdt-0.6b-v3-int8';

type DownloadStatus = 'waiting' | 'downloading' | 'completed' | 'error';

interface DownloadState {
  status: DownloadStatus;
  progress: number;
  downloadedMb: number;
  totalMb: number;
  speedMbps: number;
  error?: string;
}

export function DownloadProgressStep() {
  const {
    goNext,
    selectedSummaryModel,
    recommendedSummaryModel,
    parakeetDownloaded,
    setParakeetDownloaded,
    summaryModelDownloaded,
    setSummaryModelDownloaded,
    startBackgroundDownloads,
    completeOnboarding,
  } = useOnboarding();

  const [isMac, setIsMac] = useState(false);

  const [parakeetState, setParakeetState] = useState<DownloadState>({
    status: parakeetDownloaded ? 'completed' : 'waiting',
    progress: parakeetDownloaded ? 100 : 0,
    downloadedMb: 0,
    totalMb: 670,
    speedMbps: 0,
  });

  const [summaryState, setSummaryState] = useState<DownloadState>({
    status: summaryModelDownloaded ? 'completed' : 'waiting',
    progress: summaryModelDownloaded ? 100 : 0,
    downloadedMb: 0,
    totalMb: 0,
    speedMbps: 0,
  });

  const [isCompleting, setIsCompleting] = useState(false);
  const parakeetDownloadStartedRef = useRef(false);
  const summaryDownloadStartedRef = useRef(false);
  const retryingRef = useRef(false);
  const retryingSummaryRef = useRef(false);

  // Retry download handler
  const handleRetryDownload = async () => {
    // Prevent multiple simultaneous retries
    if (retryingRef.current) {
      console.log('[DownloadProgressStep] Retry already in progress, ignoring');
      return;
    }

    console.log('[DownloadProgressStep] Retrying Parakeet download');
    retryingRef.current = true;

    // Reset error state
    setParakeetState((prev) => ({
      ...prev,
      status: 'waiting',
      error: undefined,
      progress: 0,
      downloadedMb: 0,
      speedMbps: 0,
    }));

    try {
      await invoke('parakeet_retry_download', { modelName: PARAKEET_MODEL });
      // Progress events will update state
    } catch (error) {
      console.error('[DownloadProgressStep] Retry failed:', error);
      setParakeetState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Retry failed',
      }));

      toast.error('Download retry failed', {
        description: 'Please check your connection and try again.',
      });
    } finally {
      // Allow retry again after 2 seconds
      setTimeout(() => {
        retryingRef.current = false;
      }, 2000);
    }
  };

  // Retry summary download handler
  const handleRetrySummaryDownload = async () => {
    // Prevent multiple simultaneous retries
    if (retryingSummaryRef.current) {
      console.log('[DownloadProgressStep] Summary retry already in progress, ignoring');
      return;
    }

    console.log('[DownloadProgressStep] Retrying summary model download');
    retryingSummaryRef.current = true;

    // Reset error state
    setSummaryState((prev) => ({
      ...prev,
      status: 'downloading',
      error: undefined,
      progress: 0,
      downloadedMb: 0,
      totalMb: getSummaryModelSizeMb(selectedSummaryModel || recommendedSummaryModel),
      speedMbps: 0,
    }));

    try {
      // Call download command directly (no retry command exists for built-in AI)
      const modelName = selectedSummaryModel;
      if (!modelName) {
        throw new Error('Summary model recommendation is not ready yet');
      }
      await invoke('builtin_ai_download_model', { modelName });
    } catch (error) {
      console.error('[DownloadProgressStep] Summary retry failed:', error);
      setSummaryState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Retry failed',
      }));

      toast.error('Summary model download retry failed', {
        description: 'Please check your connection and try again.',
      });
    } finally {
      // Allow retry again after 2 seconds
      setTimeout(() => {
        retryingSummaryRef.current = false;
      }, 2000);
    }
  };

  // Detect platform on mount
  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        setIsMac(platform() === 'macos');
      } catch (e) {
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    };

    checkPlatform();
  }, []);

  // Start the required transcription model immediately; summary readiness must not block it.
  useEffect(() => {
    if (isNativeQaMode) return;
    if (parakeetDownloadStartedRef.current) return;
    parakeetDownloadStartedRef.current = true;

    if (!parakeetDownloaded) {
      setParakeetState((prev) => ({ ...prev, status: 'downloading' }));
    }

    startBackgroundDownloads({
      includeParakeet: true,
      includeSummary: false,
    }).catch((error) => {
      console.error('Failed to start Parakeet download:', error);
      if (!parakeetDownloaded) {
        setParakeetState((prev) => ({ ...prev, status: 'error', error: String(error) }));
      }
    });
  }, []);

  // Start the selected summary model only after the backend recommendation is known.
  useEffect(() => {
    if (isNativeQaMode) return;
    if (summaryDownloadStartedRef.current) return;
    if (!selectedSummaryModel) return;
    summaryDownloadStartedRef.current = true;

    startSummaryDownload();
  }, [selectedSummaryModel]);

  // Listen to Parakeet download progress
  useEffect(() => {
    const unlistenProgress = listen<{
      modelName: string;
      progress: number;
      downloaded_mb?: number;
      total_mb?: number;
      speed_mbps?: number;
      status?: string;
    }>('parakeet-model-download-progress', (event) => {
      const { modelName, progress, downloaded_mb, total_mb, speed_mbps, status } = event.payload;
      if (modelName === PARAKEET_MODEL) {
        setParakeetState((prev) => ({
          ...prev,
          status: status === 'completed' ? 'completed' : 'downloading',
          progress,
          downloadedMb: downloaded_mb ?? prev.downloadedMb,
          totalMb: total_mb ?? prev.totalMb,
          speedMbps: speed_mbps ?? prev.speedMbps,
        }));

        if (status === 'completed' || progress >= 100) {
          setParakeetDownloaded(true);
        }
      }
    });

    const unlistenComplete = listen<{ modelName: string }>(
      'parakeet-model-download-complete',
      (event) => {
        if (event.payload.modelName === PARAKEET_MODEL) {
          setParakeetState((prev) => ({ ...prev, status: 'completed', progress: 100 }));
          setParakeetDownloaded(true);
        }
      }
    );

    const unlistenError = listen<{ modelName: string; error: string }>(
      'parakeet-model-download-error',
      (event) => {
        if (event.payload.modelName === PARAKEET_MODEL) {
          setParakeetState((prev) => ({
            ...prev,
            status: 'error',
            error: event.payload.error,
          }));
        }
      }
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, []);

  // Listen to Summary Model download progress (always downloading for builtin-ai)
  useEffect(() => {
    const unlisten = listen<{
      model: string;
      progress: number;
      downloaded_mb?: number;
      total_mb?: number;
      speed_mbps?: number;
      status: string;
      error?: string;
    }>('builtin-ai-download-progress', (event) => {
      const { model, progress, downloaded_mb, total_mb, speed_mbps, status, error } = event.payload;
      if (selectedSummaryModel && model === selectedSummaryModel) {
        setSummaryState((prev) => ({
          ...prev,
          status: status === 'completed'
            ? 'completed'
            : status === 'error'
            ? 'error'
            : 'downloading',
          progress,
          downloadedMb: downloaded_mb ?? prev.downloadedMb,
          totalMb: (total_mb ?? prev.totalMb) || getSummaryModelSizeMb(model),
          speedMbps: speed_mbps ?? prev.speedMbps,
          error: status === 'error' ? error : undefined,
        }));

        if (status === 'completed' || progress >= 100) {
          setSummaryModelDownloaded(true);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [selectedSummaryModel]);

  useEffect(() => {
    const modelForSize = selectedSummaryModel || recommendedSummaryModel;
    if (!modelForSize) return;

    setSummaryState((prev) => ({
      ...prev,
      status: summaryModelDownloaded
        ? 'completed'
        : prev.status === 'completed'
        ? 'waiting'
        : prev.status,
      progress: summaryModelDownloaded
        ? 100
        : prev.status === 'completed'
        ? 0
        : prev.progress,
      totalMb: prev.totalMb || getSummaryModelSizeMb(modelForSize),
    }));
  }, [selectedSummaryModel, recommendedSummaryModel, summaryModelDownloaded]);

  const startSummaryDownload = async () => {
    if (!summaryModelDownloaded && selectedSummaryModel) {
      try {
        setSummaryState((prev) => ({
          ...prev,
          status: 'downloading',
          totalMb: getSummaryModelSizeMb(selectedSummaryModel),
        }));
        await startBackgroundDownloads({
          includeParakeet: false,
          includeSummary: true,
          summaryModel: selectedSummaryModel,
        });
      } catch (error) {
        console.error('Failed to start summary model download:', error);
        setSummaryState((prev) => ({ ...prev, status: 'error', error: String(error) }));
      }
    }
  };

  const handleContinue = async () => {
    // Verify actual model availability (catches state drift)
    try {
      await invoke('parakeet_init');
      const actuallyAvailable = await invoke<boolean>('parakeet_has_available_models');

      if (actuallyAvailable && !parakeetDownloaded) {
        console.log('[DownloadProgressStep] Model available but state not updated');
        setParakeetDownloaded(true);
        setParakeetState((prev) => ({
          ...prev,
          status: 'completed',
          progress: 100,
        }));
      } else if (!actuallyAvailable && parakeetState.status === 'error') {
        toast.error('Transcription engine required', {
          description: 'Please retry the download before continuing.',
        });
        return;
      }
    } catch (error) {
      console.warn('[DownloadProgressStep] Failed to verify model:', error);
    }

    // Check if downloads are complete for toast notification
    const downloadsComplete = parakeetState.status === 'completed' &&
      summaryState.status === 'completed';

    // Show toast if downloads still in progress
    if (!downloadsComplete) {
      toast.info('Downloads will continue in the background', {
        description: 'You can start using the app. Recording will be available once speech recognition is ready.',
        duration: 5000,
      });
    }

    if (isMac) {
      // macOS: Go to Permissions step (will complete after permissions granted)
      goNext();
    } else {
      // Non-macOS: Complete onboarding immediately (downloads continue in background)
      setIsCompleting(true);
      try {
        await completeOnboarding();

        // Small delay to ensure state is saved before reload
        await new Promise(resolve => setTimeout(resolve, 100));

        window.location.reload();
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
        toast.error('Failed to complete setup', {
          description: 'Please try again.',
        });
        setIsCompleting(false);
      }
    }
  };

  const renderDownloadCard = (
    title: string,
    icon: React.ReactNode,
    state: DownloadState,
    modelSize: string,
    sizeUnit = 'MB'
  ) => (
    <div className="py-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[9px] border border-border bg-card [&_svg]:size-[18px]">
            {icon}
          </div>
          <div>
            <h3 className="text-[13px] font-medium">{title}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{modelSize}</p>
          </div>
        </div>
        <div>
          {state.status === 'waiting' && (
            <span className="text-[11px] text-muted-foreground">Waiting</span>
          )}
          {state.status === 'downloading' && (
            <ArrowPathIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          {state.status === 'completed' && (
            <div className="grid size-5 place-items-center rounded-full bg-[hsl(var(--success)/0.1)]">
              <CheckIcon className="size-3.5 text-success" />
            </div>
          )}
          {state.status === 'error' && (
            <span className="text-[11px] font-medium text-destructive">Failed</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(state.status === 'downloading' || state.status === 'completed') && (
        <div className="space-y-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={`${title} download progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress)}>
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-muted-foreground">
              {state.downloadedMb.toFixed(1)} {sizeUnit} / {state.totalMb.toFixed(1)} {sizeUnit}
            </span>
            <div className="flex items-center gap-2">
              {state.speedMbps > 0 && (
                <span className="text-muted-foreground">
                  {state.speedMbps.toFixed(1)} {sizeUnit}/s
                </span>
              )}
              <span className="font-medium text-foreground">
                {Math.round(state.progress)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {state.status === 'error' && state.error && (
        <div className="mt-3 border-l-2 border-destructive pl-3">
          <p className="text-[12px] font-medium text-destructive">Download couldn&apos;t finish</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{state.error}</p>
          {(title === 'Transcription Engine' || title === 'Summary Engine') && (
            <button
              onClick={title === 'Transcription Engine' ? handleRetryDownload : handleRetrySummaryDownload}
              className="mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <ArrowPathIcon className="size-4" />
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <OnboardingContainer
      title="Getting things ready"
      description="You can start using Meetily after downloading the Transcription Engine."
      step={3}
      totalSteps={isMac ? 4 : 3}
    >
      <div className="max-w-[680px]">
        {/* Download Cards */}
        <div className="divide-y divide-border border-y border-border">
          {renderDownloadCard(
            'Transcription Engine',
            <LanguageIcon className="text-muted-foreground" />,
            parakeetState,
            '~670 MB'
          )}

          {renderDownloadCard(
            'Summary Engine',
            <CpuChipIcon className="text-muted-foreground" />,
            summaryState,
            getSummaryModelSizeLabel(selectedSummaryModel || recommendedSummaryModel),
            'MiB'
          )}
        </div>

        {/* Info Message - Only show when Parakeet is downloaded */}
        <AnimatePresence>
          {parakeetDownloaded && !summaryModelDownloaded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mt-5 border-l-2 border-border pl-3 text-foreground"
            >
              <div className="flex items-start gap-3">
                <ArrowDownTrayIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[12px] font-medium">You can continue while this finishes</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Download will continue in the background.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue Button */}
        <div className="mt-8">
          <Button
            onClick={handleContinue}
            disabled={!parakeetDownloaded || isCompleting}
            className="h-9 min-w-[116px] disabled:cursor-not-allowed"
          >
            {(isCompleting || !parakeetDownloaded) ? (
              <ArrowPathIcon className="size-4 animate-spin" />
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </div>
    </OnboardingContainer>
  );
}

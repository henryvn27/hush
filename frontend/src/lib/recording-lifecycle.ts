export type RecordingLifecyclePhase = 'stopping' | 'processing';

export interface NativeRecordingShutdownProgress {
  stage: string;
  message: string;
  progress: number;
  detailed?: boolean;
  elapsed_seconds?: number;
}

export interface RecordingShutdownUpdate {
  phase: RecordingLifecyclePhase;
  message: string;
  nativeProgress: NativeRecordingShutdownProgress;
}

const PROCESSING_STAGES = new Set([
  'processing_transcripts',
  'unloading_model',
]);

const FALLBACK_MESSAGES: Record<string, string> = {
  stopping_audio: 'Stopping audio capture...',
  processing_transcripts: 'Processing remaining transcript chunks...',
  unloading_model: 'Releasing the transcription model...',
  finalizing: 'Finalizing the recording...',
  complete: 'Recording stopped successfully',
};

function normalizeProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

export function getRecordingShutdownUpdate(
  payload: NativeRecordingShutdownProgress,
): RecordingShutdownUpdate {
  const stage = payload.stage?.trim() || 'unknown';
  const message = payload.message?.trim() || FALLBACK_MESSAGES[stage] || 'Finishing the recording...';

  return {
    phase: PROCESSING_STAGES.has(stage) ? 'processing' : 'stopping',
    message,
    nativeProgress: {
      ...payload,
      stage,
      message,
      progress: normalizeProgress(payload.progress),
    },
  };
}

export function getRecordingErrorMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as { userMessage?: unknown; message?: unknown; error?: unknown };
    for (const value of [candidate.userMessage, candidate.message, candidate.error]) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  return 'Recording stopped because of an unexpected audio error.';
}

export function formatRecordingDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '--:--';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export type PostRecordingStatus = 'stopping' | 'processing' | 'saving' | 'completed' | 'error';
export type PostRecordingStepState = 'complete' | 'active' | 'pending' | 'error';

export interface PostRecordingPresentation {
  eyebrow: string;
  title: string;
  description: string;
  nativeProgress: number | null;
  steps: [PostRecordingStepState, PostRecordingStepState, PostRecordingStepState];
}

export function getPostRecordingPresentation(
  status: PostRecordingStatus,
  statusMessage?: string,
  shutdownProgress?: NativeRecordingShutdownProgress | null,
): PostRecordingPresentation {
  const nativeProgress = shutdownProgress && (status === 'stopping' || status === 'processing')
    ? normalizeProgress(shutdownProgress.progress)
    : null;

  if (status === 'stopping') {
    return {
      eyebrow: 'Audio capture ended',
      title: 'Securing the recording',
      description: statusMessage || 'Hush is closing the local audio pipeline before it finishes the transcript.',
      nativeProgress,
      steps: ['complete', 'pending', 'pending'],
    };
  }

  if (status === 'processing') {
    return {
      eyebrow: 'Processing locally',
      title: 'Finishing the transcript',
      description: statusMessage || 'Hush is draining the remaining local transcription work.',
      nativeProgress,
      steps: ['complete', 'active', 'pending'],
    };
  }

  if (status === 'saving') {
    return {
      eyebrow: 'Local save',
      title: 'Saving the meeting',
      description: statusMessage || 'Hush is writing the completed meeting and transcript to the local database.',
      nativeProgress: null,
      steps: ['complete', 'complete', 'active'],
    };
  }

  if (status === 'completed') {
    return {
      eyebrow: 'Saved locally',
      title: 'Meeting saved',
      description: statusMessage || 'The local meeting is ready. Opening it now…',
      nativeProgress: null,
      steps: ['complete', 'complete', 'complete'],
    };
  }

  return {
    eyebrow: 'Save interrupted',
    title: 'Meeting not saved yet',
    description: statusMessage || 'Hush could not finish the local meeting save.',
    nativeProgress: null,
    steps: ['complete', 'error', 'error'],
  };
}

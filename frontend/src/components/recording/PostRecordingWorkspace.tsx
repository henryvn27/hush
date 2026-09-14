'use client';

import { ArrowPathIcon, CheckIcon, CircleStackIcon, DocumentTextIcon, ExclamationTriangleIcon, ShieldCheckIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Surface } from '@/components/app-shell/Surface';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RecordingStatus, useRecordingState } from '@/contexts/RecordingStateContext';
import {
  getPostRecordingPresentation,
  type PostRecordingStatus,
  type PostRecordingStepState,
} from '@/lib/recording-lifecycle';
import { cn } from '@/lib/utils';

const steps = [
  { label: 'Capture ended', icon: SpeakerWaveIcon },
  { label: 'Transcript', icon: DocumentTextIcon },
  { label: 'Saved locally', icon: CircleStackIcon },
] as const;

interface PostRecordingWorkspaceProps {
  hasRecoveryCopy: boolean;
  onRetryRecovery: () => Promise<void>;
  onOpenRecovery: () => void;
}

function StepState({ state }: { state: PostRecordingStepState }) {
  if (state === 'complete') {
    return <CheckIcon className="size-4" aria-hidden="true" />;
  }
  if (state === 'active') {
    return <ArrowPathIcon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  }
  if (state === 'error') {
    return <ExclamationTriangleIcon className="size-4" aria-hidden="true" />;
  }
  return <span className="size-2 rounded-full bg-current opacity-35" aria-hidden="true" />;
}

export function PostRecordingWorkspace({ hasRecoveryCopy, onRetryRecovery, onOpenRecovery }: PostRecordingWorkspaceProps) {
  const recordingState = useRecordingState();
  const [isRetrying, setIsRetrying] = useState(false);
  const status = recordingState.status as PostRecordingStatus;
  const presentation = getPostRecordingPresentation(
    status,
    recordingState.statusMessage,
    recordingState.shutdownProgress,
  );
  const isError = recordingState.status === RecordingStatus.ERROR;
  const isComplete = recordingState.status === RecordingStatus.COMPLETED;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryRecovery();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center py-4">
        <Surface
          role={isError ? 'alert' : 'status'}
          aria-live="polite"
          className="overflow-hidden p-0"
        >
          <div className="border-b border-border/70 px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex items-start gap-5">
              <span className={cn(
                'grid size-12 shrink-0 place-items-center rounded-[3px]',
                isError
                  ? 'bg-destructive/10 text-destructive'
                  : isComplete
                    ? 'bg-[hsl(var(--success)/0.10)] text-[hsl(var(--success))]'
                    : 'bg-secondary text-foreground',
              )}>
                {isError ? (
                  <ExclamationTriangleIcon className="size-5" aria-hidden="true" />
                ) : isComplete ? (
                  <CheckIcon className="size-5" aria-hidden="true" />
                ) : (
                  <ArrowPathIcon className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {presentation.eyebrow}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                  {presentation.title}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {presentation.description}
                </p>
              </div>
            </div>

            {presentation.nativeProgress !== null && (
              <div className="mt-6" aria-label={`Native shutdown progress ${presentation.nativeProgress}%`}>
                <div className="mb-2 flex items-center justify-between gap-4 text-xs font-medium text-muted-foreground">
                  <span>Native shutdown progress</span>
                  <span className="tabular-nums">{presentation.nativeProgress}%</span>
                </div>
                <Progress value={presentation.nativeProgress} />
              </div>
            )}
          </div>

          <div className="grid gap-2 px-6 py-5 sm:grid-cols-3 sm:px-8">
            {steps.map((step, index) => {
              const state = presentation.steps[index];
              const Icon = step.icon;
              return (
                <div
                  key={step.label}
                  className={cn(
                    'flex items-center gap-3 rounded-[3px] border px-3 py-3 text-sm',
                    state === 'active' && 'border-foreground/20 bg-secondary text-foreground',
                    state === 'complete' && 'border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))]',
                    state === 'error' && 'border-destructive/25 bg-destructive/5 text-destructive',
                    state === 'pending' && 'border-border/70 text-muted-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 font-medium">{step.label}</span>
                  <StepState state={state} />
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 border-t border-border/70 bg-secondary/35 px-6 py-4 text-sm leading-6 text-muted-foreground sm:px-8">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              {isError
                ? 'Your local transcript checkpoint is still on this device. Retry the save or review the recovery copy below.'
                : isComplete
                  ? 'The transcript and meeting metadata are saved in Hush’s local database.'
                  : 'Keep Hush open. Transcript recovery data remains on this device until the local database save completes.'}
            </p>
          </div>

          {isError && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-6 py-4 sm:px-8">
              <Button onClick={() => void handleRetry()} disabled={isRetrying}>
                {isRetrying && <ArrowPathIcon className="mr-2 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {hasRecoveryCopy ? 'Retry save' : 'Check for recovery'}
              </Button>
              {hasRecoveryCopy && (
                <Button variant="outline" onClick={onOpenRecovery} disabled={isRetrying}>
                  Review recovery
                </Button>
              )}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}

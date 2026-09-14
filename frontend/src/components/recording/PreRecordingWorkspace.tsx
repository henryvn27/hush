'use client';

import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckIcon,
  Cog6ToothIcon,
  EllipsisHorizontalCircleIcon,
  ExclamationCircleIcon,
  MicrophoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { AppState } from '@/components/app-shell/AppState';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { Surface } from '@/components/app-shell/Surface';
import { Button } from '@/components/ui/button';
import type { SelectedDevices } from '@/components/DeviceSelection';
import type { ModalType } from '@/hooks/useModalState';
import { useRecordingReadiness } from '@/hooks/useRecordingReadiness';
import type { RecordingStatus } from '@/contexts/RecordingStateContext';
import type { RecordingReadinessItem } from '@/lib/recording-readiness';
import { cn } from '@/lib/utils';

interface PreRecordingWorkspaceProps {
  selectedDevices: SelectedDevices;
  status: RecordingStatus;
  statusMessage?: string;
  onStart: () => Promise<void>;
  showModal: (name: ModalType, message?: string) => void;
}

const statusMeta = {
  checking: { label: 'Checking', icon: ArrowPathIcon },
  ready: { label: 'Ready', icon: CheckIcon },
  optional: { label: 'Optional', icon: EllipsisHorizontalCircleIcon },
  blocked: { label: 'Blocked', icon: ExclamationCircleIcon },
  error: { label: 'Unavailable', icon: ExclamationCircleIcon },
} as const;

const itemIcons = {
  microphone: MicrophoneIcon,
  'system-audio': SpeakerWaveIcon,
  transcription: SparklesIcon,
};

function ReadinessRow({ item }: { item: RecordingReadinessItem }) {
  const Icon = itemIcons[item.id];
  const StateIcon = statusMeta[item.state].icon;

  return (
    <li className="flex items-start gap-3 border-b border-border/60 py-3 last:border-b-0">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[3px] bg-secondary text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{item.label}</h3>
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium',
            item.state === 'ready' && 'text-[hsl(var(--success))]',
            item.state === 'optional' && 'text-muted-foreground',
            (item.state === 'blocked' || item.state === 'error') && 'text-destructive',
            item.state === 'checking' && 'text-muted-foreground',
          )}>
            <StateIcon className={cn('size-3.5', item.state === 'checking' && 'animate-spin')} aria-hidden="true" />
            {statusMeta[item.state].label}
          </span>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
      </div>
    </li>
  );
}

export function PreRecordingWorkspace({
  selectedDevices,
  status,
  statusMessage,
  onStart,
  showModal,
}: PreRecordingWorkspaceProps) {
  const router = useRouter();
  const readiness = useRecordingReadiness(selectedDevices);
  const isStarting = status === 'starting';
  const hasLifecycleError = status === 'error';
  const canStart = readiness.canStart && !isStarting;

  const handleStart = async () => {
    try {
      await onStart();
    } catch {
      // useRecordingStart writes the authoritative error into RecordingStateContext.
    }
  };

  const openRelevantSettings = () => {
    const modelBlocked = readiness.items.find(item => item.id === 'transcription' && item.state !== 'ready');
    if (modelBlocked) {
      showModal('modelSelector', modelBlocked.detail);
      return;
    }
    router.push('/settings');
  };

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="New local meeting"
        title="Ready when you are"
        description="Confirm local capture and transcription, then start. Hush creates the meeting title when recording begins."
        actions={
          <Button variant="outline" onClick={() => router.push('/settings')}>
            <Cog6ToothIcon aria-hidden="true" />
            Recording settings
          </Button>
        }
      />

      <div className="mt-6">
        <Surface className="overflow-hidden p-0">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-h-[22rem] flex-col justify-between p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[hsl(var(--accent-soft))] text-accent">
                  <MicrophoneIcon className="size-[1.1rem]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-[0.02em] text-muted-foreground">Capture locally</p>
                  <h2 className="mt-1.5 max-w-xl text-xl font-semibold tracking-[-0.02em]">Record without a meeting bot</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Audio, transcript checkpoints, and the saved meeting remain in Hush&apos;s local workflow.
                  </p>
                </div>
              </div>

              <div className="mt-8 border-t border-border pt-4">
                <Button variant="recording" size="lg" onClick={() => void handleStart()} disabled={!canStart} className="min-w-44">
                  {isStarting ? <ArrowPathIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <MicrophoneIcon aria-hidden="true" />}
                  {isStarting ? 'Starting recording...' : 'Start recording'}
                  {!isStarting && <ArrowRightIcon aria-hidden="true" />}
                </Button>
                <p className="mt-3 text-sm text-muted-foreground" role="status">
                  {isStarting
                    ? statusMessage || 'Initializing local capture...'
                    : readiness.canStart
                      ? 'Microphone and local transcription are ready.'
                      : readiness.blockDetail}
                </p>
              </div>
            </div>

            <aside className="border-t border-border bg-secondary/45 p-5 xl:border-l xl:border-t-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.02em] text-muted-foreground">Readiness</p>
                  <h2 className="mt-1.5 text-base font-semibold">Before you record</h2>
                </div>
                <ShieldCheckIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>

              <ul className="mt-4" aria-label="Recording readiness checks">
                {readiness.items.map(item => <ReadinessRow key={item.id} item={item} />)}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void readiness.refresh()} disabled={readiness.isChecking}>
                  <ArrowPathIcon className={readiness.isChecking ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
                  Recheck
                </Button>
                {!readiness.canStart && !readiness.isChecking && (
                  <Button variant="ghost" size="sm" onClick={openRelevantSettings}>
                    Resolve in settings
                  </Button>
                )}
              </div>
            </aside>
          </div>
        </Surface>
      </div>

      {hasLifecycleError && (
        <AppState
          compact
          kind="error"
          className="mt-4"
          title="Recording could not start"
          description={statusMessage || 'Hush could not start the native recording session.'}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void readiness.refresh()}>Check setup again</Button>
              <Button size="sm" variant="ghost" onClick={openRelevantSettings}>Review settings</Button>
            </div>
          }
        />
      )}
    </div>
  );
}

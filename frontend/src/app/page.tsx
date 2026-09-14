'use client';

import { useEffect, useState } from 'react';
import { ArrowRightIcon, ChevronRightIcon, CommandLineIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AppState } from '@/components/app-shell/AppState';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/contexts/ConfigContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useTranscriptRecovery } from '@/hooks/useTranscriptRecovery';
import { TranscriptRecovery } from '@/components/TranscriptRecovery';
import { getLocalModelStatus } from '@/lib/local-model-status';
import { getAudioRecoveryDescription } from '@/lib/transcript-recovery';
import { readShortcutConfig } from '@/components/hush/ShortcutRuntime';

export default function DashboardPage() {
  const router = useRouter();
  const { meetings, refetchMeetings } = useSidebar();
  const { modelConfig, models, error } = useConfig();
  const [showRecovery, setShowRecovery] = useState(false);
  const {
    recoverableMeetings,
    checkForRecoverableTranscripts,
    recoverMeeting,
    loadMeetingTranscripts,
    deleteRecoverableMeeting,
  } = useTranscriptRecovery();
  const recentMeetings = meetings.slice(0, 5);
  const [shortcutLabel, setShortcutLabel] = useState('Fn');
  const localModelStatus = getLocalModelStatus({
    provider: modelConfig.provider,
    model: modelConfig.model,
    ollamaModelCount: models.length,
    ollamaError: error,
  });

  useEffect(() => {
    void checkForRecoverableTranscripts();
  }, [checkForRecoverableTranscripts]);

  useEffect(() => {
    const updateShortcut = (config = readShortcutConfig()) => {
      setShortcutLabel(config.kind === 'globe' ? 'Fn' : config.label);
    };
    updateShortcut();
    const handleShortcutChange = (event: Event) => {
      const config = (event as CustomEvent<{ kind?: string; label?: string }>).detail;
      if (config?.label) setShortcutLabel(config.kind === 'globe' ? 'Fn' : config.label);
    };
    window.addEventListener('hush-shortcut-change', handleShortcutChange);
    return () => window.removeEventListener('hush-shortcut-change', handleShortcutChange);
  }, []);

  const handleRecovery = async (meetingId: string) => {
    const result = await recoverMeeting(meetingId);
    await refetchMeetings();
    if (result.meetingId) {
      toast.success('Meeting recovered', { description: getAudioRecoveryDescription(result.audioRecoveryStatus?.status) });
      router.push(`/meeting-details?id=${result.meetingId}`);
    }
    return result;
  };

  return (
    <div className="app-page xl:grid-cols-[minmax(0,1fr)_20rem]">
      <TranscriptRecovery
        isOpen={showRecovery}
        onClose={() => setShowRecovery(false)}
        recoverableMeetings={recoverableMeetings}
        onRecover={handleRecovery}
        onDelete={deleteRecoverableMeeting}
        onLoadPreview={loadMeetingTranscripts}
      />
      <header className="hush-hub-header">
        <div>
          <p className="app-eyebrow">Hush / local voice desk</p>
          <h1 className="hush-hub-title">Activity</h1>
        </div>
        <div className="hush-shortcut-note" aria-label="Hands-free shortcut">
          <span className="hush-shortcut-note-label">Hold to dictate</span>
          <kbd>{shortcutLabel}</kbd>
        </div>
      </header>

      <section aria-labelledby="capture-heading" className="hush-activity-capture">
        <div className="hush-activity-capture-copy">
          <div className="hush-activity-status">
            <span className="hush-activity-status-dot" aria-hidden="true" />
            <span>{localModelStatus.ready ? 'Local engine ready' : 'Setup needed'}</span>
          </div>
          <h2 id="capture-heading">Start a dictation</h2>
          <p>Hold <kbd>{shortcutLabel}</kbd> while you speak, or start one here. Hush keeps the audio and transcript on this Mac.</p>
        </div>
        <div className="hush-activity-capture-actions">
          <Button className="hush-activity-primary" aria-label="Start dictating" onClick={() => router.push('/new-meeting?autostart=1')}>
            <MicrophoneIcon aria-hidden="true" />
            Start dictating
            <ArrowRightIcon aria-hidden="true" />
          </Button>
            <div className="hush-activity-capture-meta">
            <button type="button" onClick={() => router.push('/settings')}>
              <CommandLineIcon aria-hidden="true" />
              {localModelStatus.ready ? 'Offline transcription' : 'Set up local engine'}
            </button>
            <button type="button" onClick={() => router.push('/settings')}>⌘ , Settings</button>
            </div>
        </div>
      </section>

      <section aria-label="Hush status" className="hush-activity-facts">
        <div className="hush-ledger-item">
          <span className="hush-ledger-label">Flows captured</span>
          <strong>{meetings.length.toString().padStart(2, '0')}</strong>
          <span>on this Mac</span>
        </div>
        <div className="hush-ledger-item">
          <span className="hush-ledger-label">Local engine</span>
          <strong>{localModelStatus.ready ? 'READY' : 'SETUP'}</strong>
          <span>{localModelStatus.ready ? 'offline transcription' : 'choose a local model'}</span>
        </div>
        <div className="hush-ledger-item">
          <span className="hush-ledger-label">Privacy mode</span>
          <strong>LOCAL</strong>
          <span>audio stays on this Mac</span>
        </div>
      </section>

      {recoverableMeetings.length > 0 && (
        <AppState
          compact
          kind="recording"
          className="mt-4"
          title={`${recoverableMeetings.length} interrupted meeting${recoverableMeetings.length === 1 ? '' : 's'} found`}
          description="Review the real local checkpoint before it expires. Recovery preserves available transcript and audio data."
          action={<Button size="sm" variant="outline" onClick={() => setShowRecovery(true)}>Review recovery</Button>}
        />
      )}

      <section aria-labelledby="recent-heading" className="hush-feed mt-8">
        <div className="hush-feed-header">
          <div>
            <p className="app-eyebrow">Your words</p>
            <h2 id="recent-heading" className="mt-2 text-lg font-semibold tracking-[-0.03em]">Recent flows</h2>
          </div>
          {meetings.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/meetings')}>
              See all history
              <ArrowRightIcon aria-hidden="true" />
            </Button>
          )}
        </div>

        {recentMeetings.length === 0 ? (
          <AppState
            compact
            kind="empty"
            title="Your local history starts here"
            description="Complete a dictation and it will appear in this feed. Hush does not add sample meetings or fabricated activity."
            action={undefined}
          />
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {recentMeetings.map((meeting) => (
              <button
                key={meeting.id}
                type="button"
                onClick={() => router.push(`/meeting-details?id=${meeting.id}`)}
                className="group flex min-h-14 w-full items-center justify-between gap-4 px-1 py-3 text-left transition-[background,transform] hover:bg-card active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-card text-muted-foreground ring-1 ring-inset ring-border">
                      <MicrophoneIcon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium">{meeting.title}</span>
                  </span>
                  <span className="hush-feed-meta">Local capture</span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

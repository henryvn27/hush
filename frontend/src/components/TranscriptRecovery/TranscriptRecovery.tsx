import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowPathIcon, CheckIcon, ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, ShieldCheckIcon, SpeakerWaveIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MeetingMetadata, StoredTranscript } from '@/services/indexedDBService';
import type { AudioRecoveryStatus } from '@/hooks/useTranscriptRecovery';
import { formatRecoveryTimestamp } from '@/lib/transcript-recovery';
import { cn } from '@/lib/utils';

interface RecoveryResult {
  success: boolean;
  audioRecoveryStatus?: AudioRecoveryStatus | null;
  meetingId?: string;
}

interface TranscriptRecoveryProps {
  isOpen: boolean;
  onClose: () => void;
  recoverableMeetings: MeetingMetadata[];
  onRecover: (meetingId: string) => Promise<RecoveryResult>;
  onDelete: (meetingId: string) => Promise<void>;
  onLoadPreview: (meetingId: string) => Promise<StoredTranscript[]>;
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function TranscriptRecovery({ isOpen, onClose, recoverableMeetings, onRecover, onDelete, onLoadPreview }: TranscriptRecoveryProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [previewTranscripts, setPreviewTranscripts] = useState<StoredTranscript[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isBusy = isRecovering || isDeleting;

  const handleMeetingSelect = useCallback(async (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    setConfirmDelete(false);
    setActionError(null);
    setIsLoadingPreview(true);
    try {
      const transcripts = await onLoadPreview(meetingId);
      setPreviewTranscripts(transcripts.slice(0, 10));
    } catch (error) {
      setPreviewTranscripts([]);
      setActionError(errorMessage(error, 'Hush could not load this local transcript preview.'));
    } finally {
      setIsLoadingPreview(false);
    }
  }, [onLoadPreview]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMeetingId(null);
    setPreviewTranscripts([]);
    setConfirmDelete(false);
    setActionError(null);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && recoverableMeetings.length > 0 && !selectedMeetingId) {
      void handleMeetingSelect(recoverableMeetings[0].meetingId);
    }
  }, [handleMeetingSelect, isOpen, recoverableMeetings, selectedMeetingId]);

  const selectedMeeting = recoverableMeetings.find((meeting) => meeting.meetingId === selectedMeetingId);

  const handleRecover = async () => {
    if (!selectedMeetingId) return;
    setIsRecovering(true);
    setActionError(null);
    setConfirmDelete(false);
    try {
      const result = await onRecover(selectedMeetingId);
      if (!result.success || !result.meetingId) throw new Error('Recovery did not return a saved meeting ID. The local recovery copy was kept.');
      onClose();
    } catch (error) {
      setActionError(errorMessage(error, 'Hush could not recover this meeting. The local recovery copy was kept.'));
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMeetingId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setActionError(null);
      return;
    }
    setIsDeleting(true);
    setActionError(null);
    try {
      await onDelete(selectedMeetingId);
      setSelectedMeetingId(null);
      setPreviewTranscripts([]);
      setConfirmDelete(false);
    } catch (error) {
      setActionError(errorMessage(error, 'Hush could not discard this recovery copy. Nothing was removed.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isBusy) onClose(); }}>
      <DialogContent className="flex max-h-[86vh] flex-col overflow-hidden p-0 sm:max-w-[820px]">
        <div className="border-b border-border/70 bg-secondary/35 px-6 py-5 sm:px-7">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-[3px] bg-secondary"><ShieldCheckIcon className="size-5" aria-hidden="true" /></span>
              <div>
                <p className="app-eyebrow">Local recovery</p>
                <DialogTitle className="mt-1 text-xl tracking-[-0.02em]">Review interrupted meetings</DialogTitle>
                <DialogDescription className="mt-1.5 leading-5">These are real local transcript checkpoints that were not marked saved. Review what exists before recovering or discarding one.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="min-h-0 border-b border-border/70 bg-secondary/20 p-3 md:border-b-0 md:border-r">
            <p className="app-eyebrow px-2 pb-2">{recoverableMeetings.length} recovery {recoverableMeetings.length === 1 ? 'copy' : 'copies'}</p>
            <ScrollArea className="h-40 md:h-[25rem]">
              <div className="space-y-1.5">
                {recoverableMeetings.map((meeting) => (
                  <button key={meeting.meetingId} type="button" onClick={() => void handleMeetingSelect(meeting.meetingId)} disabled={isBusy} className={cn('w-full rounded-[3px] border px-3 py-3 text-left transition-colors disabled:opacity-60', selectedMeetingId === meeting.meetingId ? 'border-foreground/20 bg-card' : 'border-transparent hover:bg-card/70')}>
                    <p className="truncate text-sm font-semibold">{meeting.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><ClockIcon className="size-3" aria-hidden="true" />{formatDistanceToNow(new Date(meeting.lastUpdated), { addSuffix: true })}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><DocumentTextIcon className="size-3" aria-hidden="true" />{meeting.transcriptCount}</span><span>·</span><span>{meeting.folderPath ? 'Audio checkpoints' : 'Transcript only'}</span></div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 p-5 sm:p-6">
            {selectedMeeting ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-lg font-semibold tracking-[-0.02em]">{selectedMeeting.title}</h2><p className="mt-1 text-xs text-muted-foreground">Started {new Date(selectedMeeting.startTime).toLocaleString()}</p></div>
                  <div className={cn('flex items-center gap-2 rounded-[3px] px-3 py-1 text-xs font-medium', selectedMeeting.folderPath ? 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]' : 'bg-secondary text-muted-foreground')}>
                    {selectedMeeting.folderPath ? <SpeakerWaveIcon className="size-3.5" aria-hidden="true" /> : <DocumentTextIcon className="size-3.5" aria-hidden="true" />}{selectedMeeting.folderPath ? 'Transcript + audio checkpoints' : 'Transcript only'}
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[3px] border border-border/80 bg-card">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><p className="text-sm font-semibold">Stored transcript preview</p><p className="text-xs text-muted-foreground">{selectedMeeting.transcriptCount} segments</p></div>
                  <ScrollArea className="h-[14rem]">
                    <div className="space-y-3 p-4">
                      {isLoadingPreview ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowPathIcon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading local preview…</div> : previewTranscripts.length > 0 ? previewTranscripts.map((transcript, index) => (
                        <div key={transcript.id?.toString() || index} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 text-sm leading-6"><span className="font-mono text-xs text-muted-foreground">{formatRecoveryTimestamp(transcript.timestamp, transcript.audio_start_time)}</span><p>{transcript.text}</p></div>
                      )) : <p className="text-sm text-muted-foreground">No stored transcript segments are available to preview.</p>}
                      {selectedMeeting.transcriptCount > previewTranscripts.length && previewTranscripts.length > 0 && <p className="text-xs text-muted-foreground">Previewing the first {previewTranscripts.length} of {selectedMeeting.transcriptCount} stored segments.</p>}
                    </div>
                  </ScrollArea>
                </div>

                {actionError && <div role="alert" className="mt-3 flex items-start gap-3 rounded-[3px] border border-destructive/25 bg-destructive/5 p-3 text-sm"><ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><div><p className="font-semibold">Recovery did not complete</p><p className="mt-1 leading-5 text-muted-foreground">{actionError}</p></div></div>}
                {confirmDelete && <div role="alert" className="mt-3 rounded-[3px] border border-destructive/25 bg-destructive/5 p-3 text-sm"><p className="font-semibold">Discard this recovery copy?</p><p className="mt-1 leading-5 text-muted-foreground">This removes the selected IndexedDB transcript recovery copy. Hush does not delete the recording folder or claim other files were removed.</p></div>}
              </div>
            ) : <div className="grid h-full min-h-56 place-items-center text-sm text-muted-foreground">Select a local recovery copy to review it.</div>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/70 bg-secondary/25 px-6 py-4 sm:px-7">
          <p className="mr-auto text-xs text-muted-foreground">Recovery stays on this device.</p>
          <DialogFooter className="flex-row gap-2 sm:space-x-0">
            <Button variant="ghost" onClick={onClose} disabled={isBusy}>Keep for later</Button>
            {confirmDelete && <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={isBusy}>Cancel discard</Button>}
            <Button variant="destructive" onClick={handleDelete} disabled={!selectedMeetingId || isBusy}>{isDeleting ? <ArrowPathIcon className="mr-2 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <TrashIcon className="mr-2 size-4" aria-hidden="true" />}{confirmDelete ? 'Confirm discard' : 'Discard copy'}</Button>
            <Button onClick={handleRecover} disabled={!selectedMeetingId || isBusy}>{isRecovering ? <ArrowPathIcon className="mr-2 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckIcon className="mr-2 size-4" aria-hidden="true" />}{isRecovering ? 'Recovering locally…' : 'Recover meeting'}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

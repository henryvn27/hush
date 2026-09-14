'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRightIcon, ArrowUpTrayIcon, CalendarDaysIcon, ClipboardDocumentIcon, FlagIcon, MagnifyingGlassIcon, MicrophoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { AppState } from '@/components/app-shell/AppState';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { Surface } from '@/components/app-shell/Surface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfig } from '@/contexts/ConfigContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { WisprImportDialog } from '@/components/hush/WisprImportDialog';
import { toast } from 'sonner';
import {
  createMeetingRow,
  deriveMeetingHistoryViewState,
  filterMeetingRows,
  type MeetingSortOrder,
  type SavedMeeting,
  type SavedMeetingMetadata,
  type SavedMeetingRow,
  sortMeetingRows,
  type TranscriptSearchHit,
} from '@/lib/meeting-history';

function formatMeetingDate(value: string | null): string {
  if (!value) return 'Date unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export default function MeetingsPage() {
  const router = useRouter();
  const { betaFeatures } = useConfig();
  const { openImportDialog } = useImportDialog();
  const [rows, setRows] = useState<SavedMeetingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metadataFailureCount, setMetadataFailureCount] = useState(0);
  const [query, setQuery] = useState('');
  const [transcriptHits, setTranscriptHits] = useState<TranscriptSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<MeetingSortOrder>('newest');
  const [isWisprImportOpen, setIsWisprImportOpen] = useState(false);
  const [flaggedMeetingIds, setFlaggedMeetingIds] = useState<Set<string>>(new Set());
  const [copyingMeetingId, setCopyingMeetingId] = useState<string | null>(null);
  const searchSequence = useRef(0);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('hush-flagged-meetings');
      if (stored) setFlaggedMeetingIds(new Set(JSON.parse(stored) as string[]));
    } catch {
      // A stale preference should never make the library unusable.
    }
  }, []);

  const toggleFlag = useCallback((meetingId: string) => {
    setFlaggedMeetingIds((current) => {
      const next = new Set(current);
      if (next.has(meetingId)) next.delete(meetingId);
      else next.add(meetingId);
      window.localStorage.setItem('hush-flagged-meetings', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const copyTranscript = useCallback(async (meeting: SavedMeetingRow) => {
    setCopyingMeetingId(meeting.id);
    try {
      const firstPage = await invoke<{ transcripts: Array<{ text: string; timestamp: string; audio_start_time?: number }>; total_count: number }>('api_get_meeting_transcripts', {
        meetingId: meeting.id,
        limit: 1,
        offset: 0,
      });
      if (!firstPage.total_count) {
        toast.info('This meeting has no transcript to copy yet.');
        return;
      }
      const allData = await invoke<typeof firstPage>('api_get_meeting_transcripts', {
        meetingId: meeting.id,
        limit: firstPage.total_count,
        offset: 0,
      });
      const transcript = allData.transcripts.map((item) => {
        if (typeof item.audio_start_time !== 'number') return `${item.timestamp} ${item.text}`;
        const totalSeconds = Math.max(0, Math.floor(item.audio_start_time));
        return `[${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}] ${item.text}`;
      }).join('\n');
      await navigator.clipboard.writeText(`# ${meeting.title}\n\n${transcript}`);
      toast.success('Transcript copied');
    } catch (error) {
      console.error('Failed to copy transcript:', error);
      toast.error('Could not copy this transcript');
    } finally {
      setCopyingMeetingId(null);
    }
  }, []);

  const loadMeetings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const meetings = await invoke<SavedMeeting[]>('api_get_meetings');
      const metadataResults = await Promise.allSettled(
        meetings.map((meeting) => invoke<SavedMeetingMetadata>('api_get_meeting_metadata', {
          meetingId: meeting.id,
        })),
      );
      const hydratedRows = meetings.map((meeting, index) => createMeetingRow(
        meeting,
        metadataResults[index].status === 'fulfilled'
          ? metadataResults[index].value
          : null,
      ));

      setRows(hydratedRows);
      setMetadataFailureCount(metadataResults.filter((result) => result.status === 'rejected').length);
    } catch (error) {
      console.error('Failed to load saved meetings:', error);
      setRows([]);
      setMetadataFailureCount(0);
      setLoadError('Hush could not read the saved-meeting list from the local database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    const handleImportedMeetings = () => void loadMeetings();
    window.addEventListener('hush-meetings-updated', handleImportedMeetings);
    return () => window.removeEventListener('hush-meetings-updated', handleImportedMeetings);
  }, [loadMeetings]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    const sequence = ++searchSequence.current;
    setSearchError(null);

    if (!normalizedQuery) {
      setTranscriptHits([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = window.setTimeout(async () => {
      try {
        const results = await invoke<TranscriptSearchHit[]>('api_search_transcripts', {
          query: normalizedQuery,
        });
        if (sequence === searchSequence.current) setTranscriptHits(results);
      } catch (error) {
        console.error('Failed to search saved transcripts:', error);
        if (sequence === searchSequence.current) {
          setTranscriptHits([]);
          setSearchError('Transcript search is unavailable. Title matches are still shown.');
        }
      } finally {
        if (sequence === searchSequence.current) setIsSearching(false);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const visibleRows = useMemo(
    () => sortMeetingRows(filterMeetingRows(rows, query, transcriptHits), sortOrder),
    [query, rows, sortOrder, transcriptHits],
  );

  const hasQuery = query.trim().length > 0;
  const viewState = deriveMeetingHistoryViewState({
    isLoading,
    hasLoadError: Boolean(loadError),
    totalRows: rows.length,
    visibleRows: visibleRows.length,
    isSearching,
  });

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Library"
        title="Saved meetings"
        description="Revisit transcripts and notes stored in your local Hush database."
      />
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={() => setIsWisprImportOpen(true)}>
          <ArrowUpTrayIcon aria-hidden="true" />
          Import notes
        </Button>
      </div>
      <section aria-label="Saved meeting list" className="mt-7">
        {viewState === 'loading' ? (
          <AppState
            kind="loading"
            title="Loading saved meetings"
            description="Reading meeting titles and dates from your local database."
          />
        ) : viewState === 'error' ? (
          <AppState
            kind="error"
            title="Saved meetings could not be loaded"
            description={loadError || 'Hush could not read the saved-meeting list from the local database.'}
            action={<Button variant="outline" onClick={() => void loadMeetings()}>Try again</Button>}
          />
        ) : viewState === 'empty' ? (
          <AppState
            kind="empty"
            title="Nothing saved yet"
            description={betaFeatures.importAndRetranscribe
              ? 'Complete a recording or import audio to create your first saved meeting.'
              : 'Complete a recording to create your first saved meeting.'}
            action={(
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => router.push('/new-meeting')}><MicrophoneIcon />Open recorder</Button>
                {betaFeatures.importAndRetranscribe && (
                  <Button variant="outline" onClick={() => openImportDialog()}><ArrowUpTrayIcon />Import audio</Button>
                )}
              </div>
            )}
          />
        ) : (
          <div className="space-y-4">
            <Surface className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search titles and transcripts"
                  aria-label="Search saved meeting titles and transcripts"
                  className="h-10 bg-background pl-9 pr-9"
                />
                {hasQuery && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary p-1" aria-label="Sort saved meetings">
                {(['newest', 'oldest'] as const).map((order) => (
                  <button
                    key={order}
                    type="button"
                    onClick={() => setSortOrder(order)}
                    aria-pressed={sortOrder === order}
                    className={`h-8 rounded-md px-3 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sortOrder === order ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {order}
                  </button>
                ))}
              </div>
            </Surface>

            {metadataFailureCount > 0 && (
              <p className="px-1 text-xs text-muted-foreground" role="status">
                {metadataFailureCount === 1
                  ? 'One meeting date is unavailable. The meeting can still be opened.'
                  : `${metadataFailureCount} meeting dates are unavailable. Those meetings can still be opened.`}
              </p>
            )}
            {searchError && <p className="px-1 text-xs text-destructive" role="alert">{searchError}</p>}

            {viewState === 'no-results' ? (
              <AppState
                kind="empty"
                title="No saved meetings found"
                description={`Nothing in local titles or transcripts matches “${query.trim()}”. Try a different phrase.`}
                action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>}
              />
            ) : (
              <Surface className="divide-y divide-border/70 overflow-hidden p-0">
                {visibleRows.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="group flex min-h-[4.75rem] w-full items-start gap-3 px-5 py-3 transition-[background,transform] hover:bg-secondary/70"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/meeting-details?id=${meeting.id}`)}
                      className="flex min-w-0 flex-1 items-start justify-between gap-5 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 truncate text-sm font-semibold tracking-[-0.01em]">
                          {meeting.title}
                          {flaggedMeetingIds.has(meeting.id) && <FlagIcon className="size-3.5 shrink-0 text-accent" aria-label="Flagged" />}
                        </span>
                        {meeting.matchContext ? (
                          <span className="mt-1 block line-clamp-1 text-xs leading-5 text-muted-foreground">
                            {meeting.matchContext}
                          </span>
                        ) : (
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                            {formatMeetingDate(meeting.updatedAt || meeting.createdAt)}
                          </span>
                        )}
                      </span>
                      <ArrowRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                    </button>
                    <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => void copyTranscript(meeting)}
                        disabled={copyingMeetingId === meeting.id}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        aria-label={`Copy transcript for ${meeting.title}`}
                        title="Copy transcript"
                      >
                        <ClipboardDocumentIcon className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFlag(meeting.id)}
                        className={`grid size-8 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${flaggedMeetingIds.has(meeting.id) ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}
                        aria-label={`${flaggedMeetingIds.has(meeting.id) ? 'Unflag' : 'Flag'} ${meeting.title}`}
                        aria-pressed={flaggedMeetingIds.has(meeting.id)}
                        title={flaggedMeetingIds.has(meeting.id) ? 'Unflag meeting' : 'Flag meeting'}
                      >
                        <FlagIcon className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                {isSearching && (
                  <div className="px-5 py-3 text-xs text-muted-foreground" role="status">
                    Searching local transcripts…
                  </div>
                )}
              </Surface>
            )}
          </div>
        )}
      </section>
      <WisprImportDialog open={isWisprImportOpen} onOpenChange={setIsWisprImportOpen} />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRightIcon, MagnifyingGlassIcon, MicrophoneIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { AppState } from '@/components/app-shell/AppState';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { Surface } from '@/components/app-shell/Surface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TimelineItem = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  source_device_type: string;
  modality: string;
  status: string;
  privacy_class: string;
  segment_count: number;
  preview: string | null;
};

type SearchHit = {
  event_id: string;
  segment_id: string;
  title: string;
  started_at: string;
  source_device_type: string;
  modality: string;
  text: string;
  start_seconds: number | null;
  end_seconds: number | null;
  derivation_kind: string;
  confidence: number | null;
};

type EventDetail = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  source_device_type: string;
  modality: string;
  summary: string | null;
  source_device_id: string;
  segments: Array<{
    id: string;
    event_id: string;
    text: string;
    started_at: string | null;
    ended_at: string | null;
    start_seconds: number | null;
    end_seconds: number | null;
    speaker_label: string | null;
  }>;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

export default function TimelinePage() {
  const router = useRouter();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await invoke<TimelineItem[]>('hush_timeline', { limit: 100 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The local timeline is not available yet.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadTimeline(); }, [loadTimeline]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await invoke<SearchHit[]>('hush_search', { query: trimmed, limit: 100 });
        if (!cancelled) setHits(result);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  const visibleItems = useMemo(() => {
    if (!query.trim()) return items;
    const ids = new Set(hits.map((hit) => hit.event_id));
    return items.filter((item) => ids.has(item.id));
  }, [hits, items, query]);

  const openEvent = async (eventId: string) => {
    try {
      const event = await invoke<EventDetail | null>('hush_get_event', { eventId });
      setSelected(event);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hush could not open that event.');
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const deleted = await invoke<boolean>('hush_delete_event', { eventId });
      if (!deleted) return;
      setItems((current) => current.filter((item) => item.id !== eventId));
      setHits((current) => current.filter((hit) => hit.event_id !== eventId));
      if (selected?.id === eventId) setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hush could not delete that event.');
    }
  };

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Local memory"
        title="Timeline"
        description="A chronological view of events Hush has processed on this device. Every result keeps its source and timestamp."
        actions={<Button onClick={() => router.push('/new-meeting')}><MicrophoneIcon aria-hidden="true" />New capture</Button>}
      />

      <div className="mt-6 flex items-center gap-3 rounded-md border border-input bg-background/65 px-3 py-1.5 focus-within:border-ring focus-within:shadow-[var(--shadow-focus)]">
        <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your local timeline" aria-label="Search local timeline" className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        {isSearching && <span className="shrink-0 text-xs text-muted-foreground">Searching</span>}
      </div>

      {error && <AppState className="mt-5" kind="error" title="Timeline unavailable" description={error} action={<Button variant="outline" onClick={() => void loadTimeline()}>Try again</Button>} />}
      {!error && isLoading && <AppState className="mt-5" kind="loading" title="Reading local events" description="Loading the Hush event store from this device." />}
      {!error && !isLoading && visibleItems.length === 0 && <AppState className="mt-5" kind="empty" title={query ? 'No matching events' : 'Nothing in the timeline yet'} description={query ? 'Try a person, project, phrase, or topic from a saved transcript.' : 'Finish a local recording and its transcript will appear here with source timestamps.'} action={!query ? <Button onClick={() => router.push('/new-meeting')}><MicrophoneIcon />Start a capture</Button> : undefined} />}

      {!error && !isLoading && visibleItems.length > 0 && (
        <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,27rem)]">
          <section aria-label="Hush timeline" className="space-y-2">
            {visibleItems.map((item) => (
              <article key={item.id} className="group border-b border-border py-4 first:border-t">
                <div className="flex items-start gap-4">
                  <div className="w-24 shrink-0 pt-0.5 text-xs text-muted-foreground">
                    <p>{formatDate(item.started_at)}</p>
                    <p className="mt-1 tabular-nums">{formatTime(item.started_at)}</p>
                  </div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openEvent(item.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium tracking-[-0.01em]">{item.title}</h2>
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">{formatLabel(item.modality)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.preview || 'Transcript text is still processing.'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.segment_count} {item.segment_count === 1 ? 'segment' : 'segments'} · {item.source_device_type} · {item.privacy_class} local</p>
                  </button>
                  <button type="button" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100" onClick={() => void deleteEvent(item.id)} aria-label={`Delete ${item.title}`} title="Delete event">
                    <TrashIcon className="size-4" aria-hidden="true" />
                  </button>
                  <ArrowRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </article>
            ))}
          </section>

          <Surface className="h-fit p-5 xl:sticky xl:top-6">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                  <div><p className="app-eyebrow">Source event</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{selected.title}</h2><p className="mt-1 text-xs text-muted-foreground">{formatDate(selected.started_at)} · {formatTime(selected.started_at)}</p></div>
                  <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">{selected.source_device_type}</span>
                </div>
                <div className="mt-4 space-y-4">
                  {selected.segments.map((segment) => <p key={segment.id} className="text-sm leading-6">{segment.text}</p>)}
                </div>
                <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Observed locally from {selected.modality}. This transcript is source material, not an inferred memory.</p>
              </>
            ) : (
              <div className="py-5"><p className="app-eyebrow">Source preview</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Select an event to inspect its transcript segments and provenance.</p></div>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}

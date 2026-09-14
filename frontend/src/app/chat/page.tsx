'use client';

import { FormEvent, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppState } from '@/components/app-shell/AppState';
import { MeetilyGlyph } from '@/components/app-shell/MeetilyGlyph';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/contexts/ConfigContext';
import { getLocalModelStatus } from '@/lib/local-model-status';

type RecallSource = { meeting_id: string; title: string; matchContext: string; timestamp: string; meetingDate?: string | null; summary?: string | null };
type RecallResponse = { answer: string; sources: RecallSource[] };

export default function ChatPage() {
  const router = useRouter();
  const { modelConfig, models, error: modelConfigError } = useConfig();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<RecallResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const localModelStatus = getLocalModelStatus({
    provider: modelConfig.provider,
    model: modelConfig.model,
    ollamaModelCount: models.length,
    ollamaError: modelConfigError,
  });

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;
    setIsAsking(true);
    setError(null);
    setResult(null);
    try {
      setResult(await invoke<RecallResponse>('api_answer_meetings_locally', { question: trimmed, history: [] }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="app-page">
      <PageHeader eyebrow="Local meeting recall" title="Ask meetings" description="Questions and excerpts stay on this device and use only your configured local model." />
      <form className="app-surface mt-7 p-5" onSubmit={ask}>
        <label className="app-eyebrow" htmlFor="meeting-question">Question</label>
        <div className="mt-3 flex items-center gap-3 rounded-md border border-input bg-background/65 p-2 pl-4 transition-[border-color,box-shadow] duration-fast ease-standard focus-within:border-ring focus-within:shadow-[var(--shadow-focus)]">
          <input id="meeting-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} placeholder="What decisions were discussed?" className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          <Button type="submit" disabled={!question.trim() || isAsking}>{isAsking ? 'Asking locally…' : 'Ask locally'}</Button>
        </div>
      </form>
      {!localModelStatus.ready && !isAsking && !error && !result && (
        <AppState
          compact
          className="mt-4"
          kind="model"
          title="Local recall needs a model"
          description={localModelStatus.description}
          action={(
            <Button size="sm" variant="outline" onClick={() => router.push('/settings')}>
              <MeetilyGlyph name="settings" className="size-4" />
              Review local model settings
            </Button>
          )}
        />
      )}
      {isAsking && <AppState className="mt-6" kind="loading" title="Searching local meeting excerpts" description="Hush is sending matching local excerpts to your configured local model." />}
      {error && <AppState className="mt-6" kind="model" title="Local recall is unavailable" description={error} action={<Button variant="outline" onClick={() => router.push('/settings')}><MeetilyGlyph name="settings" className="size-4" />Review local model settings</Button>} />}
      {result && <section className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <article aria-label="Local meeting answer" className="prose prose-neutral min-w-0 max-w-none text-[0.975rem] leading-7 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-[-0.02em] prose-p:leading-7 prose-li:my-1 prose-strong:font-semibold"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown></article>
        <aside aria-label="Answer sources" className="border-l border-border pl-5"><p className="app-eyebrow">Local sources</p><div className="mt-3 space-y-4">{result.sources.map((source) => <button key={`${source.meeting_id}-${source.timestamp}`} type="button" onClick={() => router.push(`/meeting-details?id=${source.meeting_id}`)} className="block w-full text-left"><p className="text-sm font-medium">{source.title}</p>{source.meetingDate && <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{new Date(source.meetingDate).toLocaleDateString()}</p>}<p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{source.matchContext}</p></button>)}</div></aside>
      </section>}
    </div>
  );
}

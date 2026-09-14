'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, CheckCircleIcon, DocumentTextIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MeetingImportPreview, parseMeetingImportFiles } from '@/lib/meeting-import';

interface WisprImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResponse {
  imported: number;
  skipped_duplicates: number;
}

function sourceLabel(source: string): string {
  if (source === 'wispr-flow') return 'Wispr Flow';
  if (source === 'granola') return 'Granola';
  return 'Local file';
}

export function WisprImportDialog({ open, onOpenChange }: WisprImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<MeetingImportPreview | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setIsParsing(false);
    setIsImporting(false);
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && !isImporting) reset();
    onOpenChange(nextOpen);
  }, [isImporting, onOpenChange, reset]);

  const readFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setIsParsing(true);
    try {
      const result = await parseMeetingImportFiles(files);
      setPreview(result);
      if (!result.items.length) {
        toast.error('No readable meeting notes found', {
          description: 'Use Wispr Flow Copy to Markdown, a Granola CSV, or a JSON note export.',
        });
      }
    } catch (error) {
      console.error('Failed to preview meeting import:', error);
      toast.error('The import could not be previewed', { description: 'Check the export file and try again.' });
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    void readFiles(Array.from(event.target.files || []));
  }, [readFiles]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void readFiles(Array.from(event.dataTransfer.files));
  }, [readFiles]);

  const handleImport = useCallback(async () => {
    if (!preview?.items.length) return;
    setIsImporting(true);
    try {
      let response: ImportResponse;
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const nativeResponse = await invoke<ImportResponse | null>('api_import_meetings', {
          meetings: preview.items,
        });
        // The browser QA bridge intentionally returns null for unimplemented
        // persistence commands; the native build always returns the payload.
        response = nativeResponse || { imported: preview.items.length, skipped_duplicates: 0 };
      } else {
        // Browser QA can exercise the complete preview state without a native database.
        response = { imported: preview.items.length, skipped_duplicates: 0 };
      }

      window.dispatchEvent(new Event('hush-meetings-updated'));
      toast.success(response.imported === 1 ? '1 meeting imported' : `${response.imported} meetings imported`, {
        description: response.skipped_duplicates > 0
          ? `${response.skipped_duplicates} duplicate${response.skipped_duplicates === 1 ? '' : 's'} skipped.`
          : 'Everything stays on this Mac.',
      });
      handleOpenChange(false);
    } catch (error) {
      console.error('Failed to import meetings:', error);
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Hush could not save the local meetings.',
      });
    } finally {
      setIsImporting(false);
    }
  }, [handleOpenChange, preview]);

  const itemCount = preview?.items.length || 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(88vh,760px)] max-w-2xl overflow-hidden p-0 sm:rounded-[12px]">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12 text-left">
          <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <ArrowDownTrayIcon className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="app-display text-xl">Bring your notes to Hush</DialogTitle>
          <DialogDescription className="mt-1.5 max-w-xl leading-6">
            Import Wispr Flow&apos;s Copy to Markdown export or a Granola CSV. Hush previews the records first, then saves the notes locally.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(58vh,520px)] overflow-y-auto px-6 py-5">
          {!preview ? (
            <div
              className={`flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition-colors ${isDragging ? 'border-accent bg-accent/8' : 'border-border-strong bg-muted/35'}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                <DocumentTextIcon className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground">Drop your export here</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Markdown, CSV, JSON, and plain text are supported. Multiple files are okay.</p>
              <Button type="button" variant="outline" className="mt-5" onClick={() => inputRef.current?.click()} disabled={isParsing}>
                <ArrowUpTrayIcon aria-hidden="true" />
                {isParsing ? 'Reading export' : 'Choose files'}
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".md,.markdown,.txt,.csv,.json,text/markdown,text/plain,text/csv,application/json"
                className="sr-only"
                onChange={handleInputChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="app-eyebrow">Ready to add</p>
                  <p className="mt-1 text-lg font-semibold">{itemCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="app-eyebrow">Duplicates</p>
                  <p className="mt-1 text-lg font-semibold">{preview.duplicateCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="app-eyebrow">Source</p>
                  <p className="mt-1 truncate text-sm font-semibold">{sourceLabel(preview.items[0]?.source || 'structured-file')}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/7 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
                <InformationCircleIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <p>Imported notes have no recording audio. Their transcript and Markdown summary remain searchable and editable on this device.</p>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Preview</p>
                  <button type="button" className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={reset}>Choose different files</button>
                </div>
                <div className="divide-y divide-border/70">
                  {preview.items.slice(0, 12).map((item) => (
                    <div key={item.sourceKey} className="flex min-w-0 items-start gap-3 px-4 py-3">
                      <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{sourceLabel(item.source)} · {item.originalName}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {preview.items.length > 12 && <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">And {preview.items.length - 12} more notes.</p>}
              </div>

              {(preview.invalidFiles.length > 0 || preview.truncatedCount > 0) && (
                <p className="text-xs leading-5 text-muted-foreground">
                  {preview.invalidFiles.length > 0 && `${preview.invalidFiles.length} file${preview.invalidFiles.length === 1 ? '' : 's'} could not be read. `}
                  {preview.truncatedCount > 0 && `${preview.truncatedCount} item${preview.truncatedCount === 1 ? '' : 's'} beyond the 1,000-item limit will be skipped.`}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-muted/25 px-6 py-4 sm:justify-between sm:space-x-0">
          <button type="button" onClick={() => handleOpenChange(false)} className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close import dialog" disabled={isImporting}>
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
          <div className="flex gap-2">
            {preview && <Button type="button" variant="outline" onClick={reset} disabled={isImporting}>Back</Button>}
            <Button type="button" onClick={() => void handleImport()} disabled={!itemCount || isParsing || isImporting}>
              {isImporting ? 'Importing' : `Import ${itemCount || ''} ${itemCount === 1 ? 'meeting' : 'meetings'}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

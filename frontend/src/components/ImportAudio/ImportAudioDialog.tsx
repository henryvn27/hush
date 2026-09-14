import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleStackIcon,
  ClockIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  LanguageIcon,
  MusicalNoteIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import { useImportAudio, ImportResult } from '@/hooks/useImportAudio';
import { useRouter } from 'next/navigation';
import { useSidebar } from '../Sidebar/SidebarProvider';
import { LANGUAGES } from '@/constants/languages';
import { useTranscriptionModels, ModelOption } from '@/hooks/useTranscriptionModels';
import { Progress } from '../ui/progress';
import { getAudioFormatsDisplayList } from '@/constants/audioFormats';
import {
  formatImportDuration,
  formatImportFileSize,
  getImportProgressPresentation,
} from '@/lib/import-audio';

interface ImportAudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedFile?: string | null;
  onComplete?: () => void;
}

export function ImportAudioDialog({
  open,
  onOpenChange,
  preselectedFile,
  onComplete,
}: ImportAudioDialogProps) {
  const router = useRouter();
  const { refetchMeetings } = useSidebar();
  const { selectedLanguage, transcriptModelConfig } = useConfig();

  const [title, setTitle] = useState('');
  const [selectedLang, setSelectedLang] = useState(selectedLanguage || 'auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [titleModifiedByUser, setTitleModifiedByUser] = useState(false);

  // Always start as false — represents "dialog has not yet been opened".
  // Do NOT initialize from the `open` prop: if the component mounts with open=true
  // (e.g. drag-drop path), we still need the initialization effect to run.
  const prevOpenRef = useRef(false);

  // Use centralized model fetching hook
  const {
    availableModels,
    selectedModelKey,
    setSelectedModelKey,
    loadingModels,
    fetchModels,
    resetSelection,
  } = useTranscriptionModels(transcriptModelConfig);

  const handleImportComplete = useCallback((result: ImportResult) => {
    toast.success(`Import complete! ${result.segments_count} segments created.`);

    // Refresh meetings list then navigate to the imported meeting
    refetchMeetings();
    onComplete?.();
    onOpenChange(false);
    router.push(`/meeting-details?id=${result.meeting_id}`);
  }, [router, refetchMeetings, onComplete, onOpenChange]);

  const handleImportError = useCallback((error: string) => {
    toast.error('Import failed', { description: error });
  }, []);

  const {
    status,
    fileInfo,
    progress,
    error,
    isProcessing,
    selectFile,
    validateFile,
    startImport,
    cancelImport,
    reset,
  } = useImportAudio({
    onComplete: handleImportComplete,
    onError: handleImportError,
  });

  // Reset state only when dialog transitions from closed to open
  // This prevents re-initialization when config changes while dialog is already open (Bug #4 & #5)
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    // Only initialize when transitioning from closed (false) to open (true)
    if (open && !wasOpen) {
      reset();
      resetSelection();
      setTitle('');
      setTitleModifiedByUser(false);
      setSelectedLang(selectedLanguage || 'auto');
      setShowAdvanced(false);

      // Validate preselected file if provided
      if (preselectedFile) {
        validateFile(preselectedFile).then((info) => {
          if (info) {
            setTitle(info.filename);
          }
        });
      }

      // Fetch available models using centralized hook
      fetchModels();
    }
  }, [open, preselectedFile, selectedLanguage, transcriptModelConfig, reset, resetSelection, validateFile, fetchModels]);

  // Update title when fileInfo changes
  useEffect(() => {
    if (fileInfo && !title && !titleModifiedByUser) {
      setTitle(fileInfo.filename);
    }
  }, [fileInfo, title, titleModifiedByUser]);

  const selectedModel = useMemo((): ModelOption | undefined => {
    if (!selectedModelKey) return undefined;
    const colonIndex = selectedModelKey.indexOf(':');
    if (colonIndex === -1) return undefined;
    const provider = selectedModelKey.slice(0, colonIndex);
    const name = selectedModelKey.slice(colonIndex + 1);
    return availableModels.find((m) => m.provider === provider && m.name === name);
  }, [selectedModelKey, availableModels]);
  const isParakeetModel = selectedModel?.provider === 'parakeet';
  const progressPresentation = progress ? getImportProgressPresentation(progress) : null;

  useEffect(() => {
    if (isParakeetModel && selectedLang !== 'auto') {
      setSelectedLang('auto');
    }
  }, [isParakeetModel, selectedLang]);

  const handleSelectFile = async () => {
    const info = await selectFile();
    if (info) {
      setTitle(info.filename);
    }
  };

  const handleStartImport = async () => {
    if (!fileInfo) return;

    await startImport(
      fileInfo.path,
      title || fileInfo.filename,
      isParakeetModel ? null : selectedLang === 'auto' ? null : selectedLang,
      selectedModel?.name || null,
      selectedModel?.provider || null
    );
  };

  const handleCancel = async () => {
    if (isProcessing) {
      const cancelled = await cancelImport();
      if (!cancelled) return;
      toast.info('Import cancelled');
    }
    onOpenChange(false);
  };

  // Prevent closing during processing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isProcessing) {
      return;
    }
    onOpenChange(newOpen);
  };

  const handleEscapeKeyDown = (event: KeyboardEvent) => {
    if (isProcessing) {
      event.preventDefault();
    }
  };

  const handleInteractOutside = (event: Event) => {
    if (isProcessing) {
      event.preventDefault();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-[640px]"
        onEscapeKeyDown={handleEscapeKeyDown}
        onInteractOutside={handleInteractOutside}
      >
        <div className="border-b border-border/70 bg-secondary/35 px-6 py-5 sm:px-7">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-foreground">
                {isProcessing ? <ArrowPathIcon className="size-5 animate-spin" aria-hidden="true" /> : error ? <ExclamationTriangleIcon className="size-5 text-destructive" aria-hidden="true" /> : status === 'complete' ? <CheckCircleIcon className="size-5 text-[hsl(var(--success))]" aria-hidden="true" /> : <MusicalNoteIcon className="size-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className="app-eyebrow">Local audio import</p>
                <DialogTitle className="mt-1 text-xl tracking-[-0.02em]">
                  {isProcessing ? 'Creating your meeting' : error && !isProcessing ? 'Import needs attention' : status === 'complete' ? 'Meeting imported' : 'Import a recording'}
                </DialogTitle>
                <DialogDescription className="mt-1.5 leading-5">
                  {isProcessing ? progressPresentation?.message || 'Waiting for the first local processing update…' : error && !isProcessing ? 'The original file was not changed. Review the local error below.' : 'Choose one recording. Hush validates, transcribes, and saves it on this device.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[62vh] space-y-4 overflow-y-auto px-6 py-5 sm:px-7">
          {!isProcessing && !error && (
            fileInfo ? (
              <>
                <div className="rounded-md border border-border/80 bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary"><MusicalNoteIcon className="size-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{fileInfo.filename}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><ClockIcon className="size-3.5" aria-hidden="true" />{formatImportDuration(fileInfo.duration_seconds)}</span>
                        <span className="flex items-center gap-1.5"><CircleStackIcon className="size-3.5" aria-hidden="true" />{formatImportFileSize(fileInfo.size_bytes)}</span>
                        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[0.6875rem] text-foreground">{fileInfo.format}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <label htmlFor="import-meeting-title" className="text-sm font-medium">Meeting title</label>
                    <Input id="import-meeting-title" value={title} onChange={(event) => { setTitle(event.target.value); setTitleModifiedByUser(true); }} placeholder="Enter meeting title" />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSelectFile} className="mt-3 w-full"><FolderOpenIcon className="mr-2 size-4" aria-hidden="true" />Choose a different file</Button>
                </div>

                <div className="overflow-hidden rounded-md border border-border/80">
                  <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced} className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-medium hover:bg-secondary/55">
                    <span>Transcription options</span>
                    {showAdvanced ? <ChevronUpIcon className="size-4" aria-hidden="true" /> : <ChevronDownIcon className="size-4" aria-hidden="true" />}
                  </button>
                  {showAdvanced && (
                    <div className="grid gap-4 border-t border-border/70 p-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium"><LanguageIcon className="size-4 text-muted-foreground" aria-hidden="true" />Language</div>
                        {!isParakeetModel ? (
                          <Select value={selectedLang} onValueChange={setSelectedLang}><SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger><SelectContent className="max-h-60">{LANGUAGES.map((lang) => <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>)}</SelectContent></Select>
                        ) : <p className="text-xs leading-5 text-muted-foreground">Parakeet uses automatic language detection.</p>}
                      </div>
                      {availableModels.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium"><CpuChipIcon className="size-4 text-muted-foreground" aria-hidden="true" />Local model</div>
                          <Select value={selectedModelKey} onValueChange={setSelectedModelKey} disabled={loadingModels}><SelectTrigger><SelectValue placeholder={loadingModels ? 'Loading models…' : 'Select model'} /></SelectTrigger><SelectContent>{availableModels.map((model) => <SelectItem key={`${model.provider}:${model.name}`} value={`${model.provider}:${model.name}`}>{model.displayName} ({Math.round(model.size_mb)} MB)</SelectItem>)}</SelectContent></Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-secondary/25 px-6 py-9 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-md bg-card"><ArrowUpTrayIcon className="size-5" aria-hidden="true" /></span>
                <h2 className="mt-4 font-semibold">Choose a recording</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Drag one file anywhere into Hush, or open the native file picker.</p>
                <Button onClick={handleSelectFile} disabled={status === 'validating'} className="mt-4">
                  {status === 'validating' ? <><ArrowPathIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />Validating locally…</> : <><FolderOpenIcon className="mr-2 size-4" aria-hidden="true" />Choose audio file</>}
                </Button>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">Supported: {getAudioFormatsDisplayList()}</p>
              </div>
            )
          )}

          {isProcessing && (
            <div className="space-y-4 rounded-md border border-border/80 bg-card p-5">
              {progressPresentation ? (
                <>
                  <div className="flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{progressPresentation.label}</span><span className="tabular-nums text-muted-foreground">{progressPresentation.percentage}%</span></div>
                  <Progress value={progressPresentation.percentage} aria-label={`Native import progress ${progressPresentation.percentage}%`} />
                  <p className="text-sm leading-6 text-muted-foreground">{progressPresentation.message}</p>
                </>
              ) : (
                <div className="flex items-center gap-3 text-sm text-muted-foreground"><ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />Waiting for the native importer…</div>
              )}
              <div className="flex items-start gap-3 border-t border-border/70 pt-4 text-sm leading-6 text-muted-foreground"><ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>Keep Hush open while the local transcript and meeting record are created.</p></div>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 p-4">
              <div className="flex items-start gap-3"><ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><div><p className="text-sm font-semibold text-foreground">{isProcessing ? 'Cancellation did not complete' : 'Local import failed'}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{error}</p></div></div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-secondary/25 px-6 py-4 sm:px-7">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><ShieldCheckIcon className="size-4" aria-hidden="true" />Audio stays on this device.</div>
          <DialogFooter className="ml-auto flex-row gap-2 sm:space-x-0">
            {!isProcessing && !error && <><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleStartImport} disabled={!fileInfo || !title.trim()}><ArrowUpTrayIcon className="mr-2 size-4" aria-hidden="true" />Import meeting</Button></>}
            {isProcessing && <Button variant="outline" onClick={handleCancel}><XMarkIcon className="mr-2 size-4" aria-hidden="true" />Cancel import</Button>}
            {error && !isProcessing && <><Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button><Button onClick={reset} variant="outline">Choose another file</Button></>}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

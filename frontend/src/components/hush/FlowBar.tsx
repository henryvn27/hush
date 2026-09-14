'use client';

import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon, EllipsisHorizontalIcon, StopIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Menu } from '@base-ui/react/menu';
import { emit, emitTo } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { RecordingStatus } from '@/contexts/RecordingStateContext';
import { readShortcutConfig } from './ShortcutRuntime';
import { readLastTranscript } from '@/lib/last-transcript';

function formatDuration(value: number | null) {
  const totalSeconds = Math.max(0, Math.floor(value ?? 0));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isBrowserQaRuntime() {
  return process.env.NEXT_PUBLIC_MEETILY_BROWSER_QA === 'true';
}

async function startRecordingFromFlowBar() {
  try {
    await invoke('flow_bar_start_recording');
  } catch (error) {
    console.warn('[Hush Flow Bar] Native start command failed; falling back to main-window event', error);
    await emitToMainWithFallback('request-recording-toggle', { state: 'Pressed' });
  }
}

async function emitToMainWithFallback<T>(eventName: string, payload?: T) {
  try {
    await emitTo('main', eventName, payload);
  } catch (error) {
    console.warn(`[Hush Flow Bar] Targeted event failed for ${eventName}; falling back to app-wide delivery`, error);
    await emit(eventName, payload);
  }
}

function SignalWave({ active }: { active: boolean }) {
  return (
    <span className={active ? 'hush-signal-wave hush-signal-wave-active' : 'hush-signal-wave'} aria-hidden="true">
      {[0.45, 0.8, 1, 0.62, 0.36].map((scale, index) => (
        <span key={index} style={{ '--hush-wave-scale': scale } as CSSProperties} />
      ))}
    </span>
  );
}

export function FlowBar({ floating = false }: { floating?: boolean }) {
  const router = useRouter();
  const { isRecording, isPaused, isStopping, isProcessing, isSaving, status, recordingDuration } = useRecordingState();
  const [hiddenUntil, setHiddenUntil] = useState<number | null>(null);
  const [barEnabled, setBarEnabled] = useState(true);
  const [shortcutLabel, setShortcutLabel] = useState('Fn');
  const [hasLastTranscript, setHasLastTranscript] = useState(false);
  const isBusy = isStopping || isProcessing || isSaving;
  const isLive = isRecording && !isPaused;
  const nativeVisibility = useCallback(async (visible: boolean) => {
    if (floating && isTauriRuntime()) {
      if (visible) await getCurrentWindow().show();
      else await getCurrentWindow().hide();
    }
  }, [floating]);
  const statusLabel = isBusy
    ? status === RecordingStatus.SAVING ? 'Saving locally' : 'Finishing capture'
      : isRecording
        ? isPaused ? 'Capture paused' : 'Listening'
      : 'Ready to flow';

  useEffect(() => {
    const savedHiddenUntil = Number(window.localStorage.getItem('hush-flow-bar-hidden-until') ?? 0);
    if (savedHiddenUntil > Date.now()) setHiddenUntil(savedHiddenUntil);
    if (savedHiddenUntil > Date.now()) {
      window.setTimeout(() => setHiddenUntil(null), savedHiddenUntil - Date.now());
    }
    setBarEnabled(window.localStorage.getItem('hush-flow-bar-disabled') !== 'true');
    setHasLastTranscript(Boolean(readLastTranscript()));
    const shortcut = readShortcutConfig();
    setShortcutLabel(shortcut.kind === 'globe' ? 'Fn' : shortcut.label);

    const handleVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled?: boolean }>;
      setBarEnabled(customEvent.detail?.enabled !== false);
    };
    window.addEventListener('hush-flow-bar-visibility', handleVisibility);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'hush-flow-bar-disabled') setBarEnabled(event.newValue !== 'true');
      if (event.key === 'hush-flow-bar-hidden-until') {
        const nextHiddenUntil = Number(event.newValue ?? 0);
        setHiddenUntil(nextHiddenUntil > Date.now() ? nextHiddenUntil : null);
      }
      if (event.key === 'hush-flow-shortcut') {
        const nextShortcut = readShortcutConfig();
        setShortcutLabel(nextShortcut.kind === 'globe' ? 'Fn' : nextShortcut.label);
      }
    };
    window.addEventListener('storage', handleStorage);
    const handleShortcutChange = (event: Event) => {
      const config = (event as CustomEvent<{ kind?: string; label?: string }>).detail;
      if (config?.label) setShortcutLabel(config.kind === 'globe' ? 'Fn' : config.label);
    };
    window.addEventListener('hush-shortcut-change', handleShortcutChange);
    const handleLastTranscriptChange = () => setHasLastTranscript(Boolean(readLastTranscript()));
    window.addEventListener('hush-last-transcript-change', handleLastTranscriptChange);

    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.altKey && event.code === 'Space') || (event.metaKey && event.shiftKey && event.code === 'Space')) {
        event.preventDefault();
        router.push('/new-meeting?autostart=1');
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      window.removeEventListener('hush-flow-bar-visibility', handleVisibility);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('hush-shortcut-change', handleShortcutChange);
      window.removeEventListener('hush-last-transcript-change', handleLastTranscriptChange);
    };
  }, [router, nativeVisibility]);

  useEffect(() => {
    void nativeVisibility(barEnabled && !(hiddenUntil && hiddenUntil > Date.now()));
  }, [barEnabled, hiddenUntil, nativeVisibility]);

  const hideForAnHour = () => {
    const until = Date.now() + 60 * 60 * 1000;
    window.localStorage.setItem('hush-flow-bar-hidden-until', String(until));
    setHiddenUntil(until);
    void nativeVisibility(false);
  };

  const sendRecordingEvent = (eventName: 'request-recording-stop' | 'request-recording-cancel') => {
    if (floating && isTauriRuntime()) void emitToMainWithFallback(eventName);
    else window.dispatchEvent(new CustomEvent(eventName));
  };

  const pasteLastTranscript = () => {
    if (!hasLastTranscript) return;
    if (floating && isTauriRuntime()) void emitToMainWithFallback('request-paste-last');
    else window.dispatchEvent(new CustomEvent('request-paste-last'));
  };

  const copyLastTranscript = async () => {
    const transcript = readLastTranscript();
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setHasLastTranscript(true);
    } catch (error) {
      console.warn('[Hush Flow Bar] Could not copy the last dictation', error);
    }
  };

  if (!floating && isTauriRuntime() && !isBrowserQaRuntime()) return null;
  if (!barEnabled || (hiddenUntil && hiddenUntil > Date.now())) return null;

  return (
    <aside
      className={floating ? 'hush-flow-bar hush-flow-bar-floating group' : 'hush-flow-bar group'}
      aria-label="Hush Flow Bar"
      onPointerDown={(event) => {
        if (!floating || event.button !== 0) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('button')) return;
        void getCurrentWindow().startDragging();
      }}
    >
      <button
        type="button"
        className="hush-flow-core"
        onClick={() => {
          // Keep the center of the bar non-destructive during a live hands-free
          // session. Wispr reserves stop/cancel for explicit controls so an
          // accidental click cannot end a long dictation.
          if (isRecording || isBusy) return;
          if (floating) {
            void startRecordingFromFlowBar();
          } else {
            router.push('/new-meeting?autostart=1');
          }
        }}
        disabled={isBusy}
        aria-label={isRecording ? 'Dictation in progress; use Stop or Cancel' : 'Start local dictation'}
        title={isRecording ? 'Use Stop to finish or Cancel to discard' : 'Start local dictation'}
      >
        <span className={isLive ? 'hush-flow-orb hush-flow-orb-live' : 'hush-flow-orb'}>
          <Image src="/hush-mark.png" alt="" width={24} height={24} unoptimized aria-hidden="true" />
        </span>
        <span className="hush-flow-copy">
          <span className="hush-flow-kicker">Hush</span>
          <span className="hush-flow-status">
            <span className={isLive ? 'hush-flow-status-dot hush-flow-status-dot-live' : 'hush-flow-status-dot'} aria-hidden="true" />
            {isRecording ? statusLabel : 'Click to start dictating'}
            {isRecording && <span className="hush-flow-time">{formatDuration(recordingDuration)}</span>}
          </span>
        </span>
        <SignalWave active={isLive} />
      </button>
      {isRecording && (
        <div className="hush-flow-actions" aria-label="Recording actions">
          <button type="button" className="hush-flow-action" onClick={() => sendRecordingEvent('request-recording-cancel')} aria-label="Cancel dictation" title="Cancel dictation">
            <XMarkIcon className="size-3.5" aria-hidden="true" />
          </button>
          <button type="button" className="hush-flow-action hush-flow-action-stop" onClick={() => sendRecordingEvent('request-recording-stop')} aria-label="Stop dictation" title="Stop dictation">
            <StopIcon className="size-3" aria-hidden="true" />
          </button>
        </div>
      )}
      <Menu.Root>
        <Menu.Trigger
        className="hush-flow-menu-trigger"
        aria-label="Open Flow Bar menu"
        title="Flow Bar menu"
        >
          <EllipsisHorizontalIcon className="size-4" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="hush-flow-menu-positioner" side="top" align="end" sideOffset={10}>
            <Menu.Popup className="hush-flow-menu" aria-label="Flow Bar menu">
              <div className="hush-flow-menu-heading">Flow Bar</div>
              <Menu.Group>
                <Menu.Item className="hush-flow-menu-item" onClick={() => floating ? void emitToMainWithFallback('hush-main-navigation', { path: '/settings' }) : router.push('/settings')}>
                  Settings
                </Menu.Item>
                <Menu.Item className="hush-flow-menu-item" onClick={() => floating ? void emitToMainWithFallback('hush-main-navigation', { path: '/meetings' }) : router.push('/meetings')}>
                  Transcript history
                </Menu.Item>
                <Menu.Item
                  className="hush-flow-menu-item"
                  disabled={!hasLastTranscript}
                  onClick={pasteLastTranscript}
                >
                  <ClipboardDocumentIcon className="size-3.5" aria-hidden="true" />
                  Paste last dictation
                </Menu.Item>
                <Menu.Item
                  className="hush-flow-menu-item"
                  disabled={!hasLastTranscript}
                  onClick={() => void copyLastTranscript()}
                >
                  <ClipboardDocumentCheckIcon className="size-3.5" aria-hidden="true" />
                  Copy last dictation
                </Menu.Item>
                <Menu.Item className="hush-flow-menu-item" onClick={hideForAnHour}>
                  Hide for 1 hour
                </Menu.Item>
              </Menu.Group>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </aside>
  );
}

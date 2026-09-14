'use client';

import { emit, listen } from '@tauri-apps/api/event';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import {
  advanceGlobeGesture,
  INITIAL_GLOBE_GESTURE_STATE,
  type GlobeGestureEvent,
  type GlobeGestureState,
} from '@/lib/globe-gesture';

export const HUSH_SHORTCUT_STORAGE_KEY = 'hush-flow-shortcut';
export const HUSH_PASTE_SHORTCUT_STORAGE_KEY = 'hush-paste-last-shortcut';
const HUSH_SHORTCUT_RUNTIME_KEY = 'hush-flow-shortcut-runtime';
const DEFAULT_SHORTCUT: ShortcutConfig = { kind: 'globe', label: 'Globe / Fn' };
const DEFAULT_PASTE_SHORTCUT: PasteShortcutConfig = { shortcut: 'Command+Control+V', label: '⌘ ⌃ V' };

export interface PasteShortcutConfig {
  shortcut: string;
  label: string;
}

export type ShortcutConfig =
  | { kind: 'globe'; label: string }
  | { kind: 'global'; label: string; shortcut: string; shortcuts?: string[] };

export function readPasteShortcutConfig(): PasteShortcutConfig {
  if (typeof window === 'undefined') return DEFAULT_PASTE_SHORTCUT;
  try {
    const value = window.localStorage.getItem(HUSH_PASTE_SHORTCUT_STORAGE_KEY);
    if (!value) return DEFAULT_PASTE_SHORTCUT;
    const parsed = JSON.parse(value) as PasteShortcutConfig;
    if (parsed.shortcut && parsed.label) return parsed;
  } catch {
    // Fall through to the safe default when a stale preference cannot be read.
  }
  return DEFAULT_PASTE_SHORTCUT;
}

function pasteShortcutBinding(config: PasteShortcutConfig): string[] {
  return config.shortcut ? [config.shortcut] : [];
}

function shortcutBindings(config: ShortcutConfig): string[] {
  if (config.kind !== 'global') return [];
  return Array.from(new Set([config.shortcut, ...(config.shortcuts ?? [])].filter(Boolean)));
}

interface ShortcutEventPayload {
  state?: 'Pressed' | 'Released';
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function readShortcutConfig(): ShortcutConfig {
  if (typeof window === 'undefined') return DEFAULT_SHORTCUT;

  try {
    const value = window.localStorage.getItem(HUSH_SHORTCUT_STORAGE_KEY);
    if (!value) return DEFAULT_SHORTCUT;
    const parsed = JSON.parse(value) as ShortcutConfig;
    if (parsed.kind === 'global' && parsed.shortcut && parsed.label) return parsed;
    if (parsed.kind === 'globe' && parsed.label) return parsed;
  } catch {
    // Fall through to the safe default when a stale preference cannot be read.
  }

  return DEFAULT_SHORTCUT;
}

function writeShortcutConfig(config: ShortcutConfig) {
  window.localStorage.setItem(HUSH_SHORTCUT_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('hush-shortcut-change', { detail: config }));
}

export function ShortcutRuntime() {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let activeShortcuts: string[] = [];
    let activePasteShortcuts: string[] = [];
    let lastAppliedConfig = readShortcutConfig();
    let lastAppliedPaste = readPasteShortcutConfig();

    const applyShortcuts = async (config: ShortcutConfig, pasteConfig: PasteShortcutConfig) => {
      const previousShortcuts = [...activeShortcuts, ...activePasteShortcuts];
      const previousConfig = lastAppliedConfig;
      const previousPaste = lastAppliedPaste;
      try {
        await Promise.all(previousShortcuts.map((shortcut) => unregister(shortcut).catch(() => undefined)));
        activeShortcuts = [];
        activePasteShortcuts = [];

        for (const shortcut of shortcutBindings(config)) {
          await register(shortcut, () => {
            window.dispatchEvent(new CustomEvent("hush-toggle-recording"));
          });
          activeShortcuts.push(shortcut);
        }
        for (const shortcut of pasteShortcutBinding(pasteConfig)) {
          await register(shortcut, () => {
            window.dispatchEvent(new CustomEvent("request-paste-last"));
          });
          activePasteShortcuts.push(shortcut);
        }

        lastAppliedConfig = config;
        lastAppliedPaste = pasteConfig;
        window.localStorage.setItem(HUSH_SHORTCUT_RUNTIME_KEY, activeShortcuts.join(",") || "globe");
      } catch (error) {
        console.error("Failed to register Hush shortcut:", error);
        await Promise.all([...activeShortcuts, ...activePasteShortcuts].map((shortcut) => unregister(shortcut).catch(() => undefined)));
        activeShortcuts = [];
        activePasteShortcuts = [];
        try {
          for (const shortcut of shortcutBindings(previousConfig)) {
            await register(shortcut, () => {
              window.dispatchEvent(new CustomEvent("hush-toggle-recording"));
            });
            activeShortcuts.push(shortcut);
          }
          for (const shortcut of pasteShortcutBinding(previousPaste)) {
            await register(shortcut, () => {
              window.dispatchEvent(new CustomEvent("request-paste-last"));
            });
            activePasteShortcuts.push(shortcut);
          }
        } catch {
          activeShortcuts = [];
          activePasteShortcuts = [];
        }
        window.localStorage.setItem(HUSH_SHORTCUT_STORAGE_KEY, JSON.stringify(previousConfig));
        window.localStorage.setItem(HUSH_PASTE_SHORTCUT_STORAGE_KEY, JSON.stringify(previousPaste));
        window.dispatchEvent(new CustomEvent("hush-shortcut-rejected", { detail: previousConfig }));
        window.dispatchEvent(new CustomEvent("hush-paste-shortcut-rejected", { detail: previousPaste }));
        toast.error("Shortcut is unavailable", {
          description: "That keybind is already in use. Choose another shortcut in Settings.",
        });
      }
    };

    void applyShortcuts(lastAppliedConfig, lastAppliedPaste);

    const handleShortcutChange = (event: Event) => {
      const config = (event as CustomEvent<ShortcutConfig>).detail;
      if (config) void applyShortcuts(config, lastAppliedPaste);
    };
    const handlePasteShortcutChange = (event: Event) => {
      const pasteConfig = (event as CustomEvent<PasteShortcutConfig>).detail;
      if (pasteConfig) void applyShortcuts(lastAppliedConfig, pasteConfig);
    };

    window.addEventListener("hush-shortcut-change", handleShortcutChange);
    window.addEventListener("hush-paste-shortcut-change", handlePasteShortcutChange);
    return () => {
      window.removeEventListener("hush-shortcut-change", handleShortcutChange);
      window.removeEventListener("hush-paste-shortcut-change", handlePasteShortcutChange);
      void Promise.all([...activeShortcuts, ...activePasteShortcuts].map((shortcut) => unregister(shortcut).catch(() => undefined)));
    };
  }, []);

  return null;
}

export function ShortcutActivationBridge({ showOnboarding }: { showOnboarding: boolean }) {
  const router = useRouter();
  const { isRecording, isStopping, isProcessing, isSaving } = useRecordingState();
  const isBusy = isStopping || isProcessing || isSaving;
  const recordingRef = useRef(isRecording);
  const busyRef = useRef(isBusy);
  const pendingStopRef = useRef(false);
  const selectedShortcutKind = useRef<ShortcutConfig['kind']>(readShortcutConfig().kind);
  const pendingGlobeReleaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globeGestureRef = useRef<GlobeGestureState>(INITIAL_GLOBE_GESTURE_STATE);

  useEffect(() => {
    recordingRef.current = isRecording;
    busyRef.current = isBusy;

    if (pendingStopRef.current && isRecording && !isBusy) {
      pendingStopRef.current = false;
      window.dispatchEvent(new CustomEvent('stop-recording-from-sidebar'));
    }
  }, [isBusy, isRecording]);

  const blockForOnboarding = useCallback(() => {
    if (!showOnboarding) return false;
    toast.error('Finish setup before dictating', {
      description: 'Choose a local model and microphone, then the shortcut will work anywhere in Hush.',
    });
    return true;
  }, [showOnboarding]);

  const startRecording = useCallback(() => {
    if (blockForOnboarding() || busyRef.current || recordingRef.current) return;
    pendingStopRef.current = false;

    if (window.location.pathname === '/new-meeting') {
      window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
    } else {
      router.push('/new-meeting?autostart=1');
    }
  }, [blockForOnboarding, router]);

  const stopRecording = useCallback(() => {
    if (busyRef.current) return;
    if (recordingRef.current) {
      pendingStopRef.current = false;
      if (isTauriRuntime()) void emit('hush-recording-lifecycle', { status: 'stopping' });
      window.dispatchEvent(new CustomEvent('stop-recording-from-sidebar'));
    } else {
      pendingStopRef.current = true;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (blockForOnboarding() || busyRef.current) return;
    if (recordingRef.current) stopRecording();
    else startRecording();
  }, [blockForOnboarding, startRecording, stopRecording]);

  useEffect(() => {
    const handleShortcutChange = (event: Event) => {
      const config = (event as CustomEvent<ShortcutConfig>).detail;
      if (config) selectedShortcutKind.current = config.kind;
    };
    window.addEventListener('hush-shortcut-change', handleShortcutChange);
    return () => window.removeEventListener('hush-shortcut-change', handleShortcutChange);
  }, []);

  useEffect(() => {
    const unlistenToggle = listen<ShortcutEventPayload>('request-recording-toggle', (event) => {
      if (event.payload?.state !== 'Released') toggleRecording();
    });
    const unlistenStop = listen('request-recording-stop', () => stopRecording());
    const unlistenCancel = listen('request-recording-cancel', () => {
      window.dispatchEvent(new CustomEvent('request-recording-cancel'));
    });
    const unlistenPasteLast = listen('request-paste-last', () => {
      window.dispatchEvent(new CustomEvent('request-paste-last'));
    });
    const unlistenFlowBarError = listen<{ message?: string }>('hush-flow-bar-error', (event) => {
      window.dispatchEvent(new CustomEvent('hush-flow-bar-error', { detail: event.payload }));
    });

    const unlistenGlobe = listen<ShortcutEventPayload>('request-globe-dictation', (event) => {
      if (selectedShortcutKind.current !== 'globe') return;
      if (blockForOnboarding()) return;
      const state = event.payload?.state;
      if (!state) return;

      const gestureEvent: GlobeGestureEvent = state === 'Pressed' ? 'pressed' : 'released';
      const transition = advanceGlobeGesture(globeGestureRef.current, gestureEvent);
      globeGestureRef.current = transition.state;

      if (transition.effect === 'cancel-release' && pendingGlobeReleaseRef.current) {
        clearTimeout(pendingGlobeReleaseRef.current);
        pendingGlobeReleaseRef.current = null;
      } else if (transition.effect === 'schedule-release') {
        pendingGlobeReleaseRef.current = setTimeout(() => {
          pendingGlobeReleaseRef.current = null;
          const timeoutTransition = advanceGlobeGesture(globeGestureRef.current, 'release-timeout');
          globeGestureRef.current = timeoutTransition.state;
          if (timeoutTransition.effect === 'stop') stopRecording();
        }, 320);
      }

      if (transition.effect === 'start') startRecording();
      if (transition.effect === 'stop') stopRecording();
    });

    return () => {
      if (pendingGlobeReleaseRef.current) clearTimeout(pendingGlobeReleaseRef.current);
      globeGestureRef.current = INITIAL_GLOBE_GESTURE_STATE;
      unlistenToggle.then((cleanup) => cleanup());
      unlistenStop.then((cleanup) => cleanup());
      unlistenCancel.then((cleanup) => cleanup());
      unlistenPasteLast.then((cleanup) => cleanup());
      unlistenFlowBarError.then((cleanup) => cleanup());
      unlistenGlobe.then((cleanup) => cleanup());
    };
  }, [blockForOnboarding, startRecording, stopRecording, toggleRecording]);

  useEffect(() => {
    const handleBrowserStop = () => stopRecording();
    const handleBrowserCancel = () => window.dispatchEvent(new CustomEvent('request-recording-cancel'));
    window.addEventListener('request-recording-stop', handleBrowserStop);
    window.addEventListener('request-recording-cancel', handleBrowserCancel);
    return () => {
      window.removeEventListener('request-recording-stop', handleBrowserStop);
      window.removeEventListener('request-recording-cancel', handleBrowserCancel);
    };
  }, [stopRecording]);

  // The custom event is useful for the browser QA harness and for the compact
  // Flow Bar while the native AppKit monitor is unavailable.
  useEffect(() => {
    const handleBrowserShortcut = (event: Event) => {
      const shortcutEvent = event as CustomEvent<ShortcutEventPayload>;
      if (shortcutEvent.detail?.state === 'Released') return;
      toggleRecording();
    };
    window.addEventListener('hush-toggle-recording', handleBrowserShortcut);
    return () => window.removeEventListener('hush-toggle-recording', handleBrowserShortcut);
  }, [toggleRecording]);

  return null;
}

export function saveShortcutConfig(config: ShortcutConfig) {
  writeShortcutConfig(config);
}

export function savePasteShortcutConfig(config: PasteShortcutConfig) {
  window.localStorage.setItem(HUSH_PASTE_SHORTCUT_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("hush-paste-shortcut-change", { detail: config }));
}

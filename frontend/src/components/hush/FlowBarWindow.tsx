'use client';

import { RecordingStatus, RecordingStateProvider, useRecordingState } from '@/contexts/RecordingStateContext';
import { FlowBar } from './FlowBar';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { currentMonitor, getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window';
import { useEffect } from 'react';

function LifecycleBridge() {
  const { setStatus, syncNow } = useRecordingState();

  useEffect(() => {
    // The Flow Bar is a separate WebView, so it cannot inherit the main
    // window's React context. Keep its live state truthful while recording.
    void syncNow();
    const interval = window.setInterval(() => void syncNow(), 500);
    return () => window.clearInterval(interval);
  }, [syncNow]);

  useEffect(() => {
    const unlisten = listen<{ status?: RecordingStatus }>('hush-recording-lifecycle', (event) => {
      if (event.payload?.status) setStatus(event.payload.status);
    });
    return () => { void unlisten.then((cleanup) => cleanup()); };
  }, [setStatus]);

  return null;
}

function NativeVisibilityBridge() {
  useEffect(() => {
    const shouldShowFromPersistedState = () => {
      void invoke('set_flow_bar_screen_capture_protection', { protected: window.localStorage.getItem('hush-hide-flow-bar-from-capture') === 'true' }).catch(() => undefined);
      const disabled = window.localStorage.getItem('hush-flow-bar-disabled') === 'true';
      const hiddenUntil = Number(window.localStorage.getItem('hush-flow-bar-hidden-until') ?? 0);
      const onboardingComplete = window.localStorage.getItem('hush-onboarding-completed') === 'true';
      return onboardingComplete && !disabled && hiddenUntil <= Date.now();
    };

    const showPositioned = async () => {
      if (!shouldShowFromPersistedState()) return;
      const flowBarWindow = getCurrentWindow();
      try {
        const [monitor, outerSize] = await Promise.all([
          currentMonitor().then((monitor) => monitor ?? primaryMonitor()),
          flowBarWindow.outerSize(),
        ]);
        if (monitor) {
          const bottomInset = Math.round(88 * monitor.scaleFactor);
          const x = monitor.position.x + Math.round((monitor.size.width - outerSize.width) / 2);
          const y = monitor.position.y + monitor.size.height - bottomInset - outerSize.height;
          await flowBarWindow.setPosition(new PhysicalPosition(x, y));
        }
        await flowBarWindow.show();
      } catch (error) {
        console.error('[Hush] Could not position Flow Bar', error);
      }
    };

    // The main WebView can emit before this hidden WebView finishes mounting.
    // Reconcile persisted state locally so the idle bar cannot disappear on startup.
    void showPositioned();

    const unlisten = listen('hush-flow-bar-show', () => {
      void showPositioned();
    });
    return () => { void unlisten.then((cleanup) => cleanup()); };
  }, []);

  return null;
}

export default function FlowBarWindow() {
  return (
    <div className="hush-flow-window">
      <RecordingStateProvider>
        <LifecycleBridge />
        <NativeVisibilityBridge />
        <FlowBar floating />
      </RecordingStateProvider>
    </div>
  );
}

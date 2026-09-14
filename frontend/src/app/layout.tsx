'use client'

import './globals.css'
import Sidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/Sidebar/SidebarProvider'
import MainContent from '@/components/MainContent'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import { Toaster, toast } from 'sonner'
import "sonner/dist/styles.css"
import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RecordingStateProvider, useRecordingState } from '@/contexts/RecordingStateContext'
import { OllamaDownloadProvider } from '@/contexts/OllamaDownloadContext'
import { TranscriptProvider } from '@/contexts/TranscriptContext'
import { ConfigProvider, useConfig } from '@/contexts/ConfigContext'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { OnboardingFlow } from '@/components/onboarding'
import { loadBetaFeatures } from '@/types/betaFeatures'
import { DownloadProgressToastProvider } from '@/components/shared/DownloadProgressToast'
import { UpdateCheckProvider } from '@/components/UpdateCheckProvider'
import { RecordingPostProcessingProvider } from '@/contexts/RecordingPostProcessingProvider'
import { ImportAudioDialog, ImportDropOverlay } from '@/components/ImportAudio'
import { FlowBar } from '@/components/hush/FlowBar'
import { ShortcutActivationBridge, ShortcutRuntime } from '@/components/hush/ShortcutRuntime'
import LandingPage from '@/components/hush/LandingPage'
import FlowBarWindow from '@/components/hush/FlowBarWindow'
import { ImportDialogProvider } from '@/contexts/ImportDialogContext'
import { isAudioExtension, getAudioFormatsDisplayList } from '@/constants/audioFormats'
import { readLastTranscript } from '@/lib/last-transcript'
import { insertIntoFocusedApp } from '@/lib/focused-app-insertion'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import AnalyticsDataModal from '@/components/AnalyticsDataModal'
import { bypassOnboardingForNativeQa, isBrowserQaMode, isNativeQaMode, nativeQaRoute, nativeQaTheme, openAnalyticsDetailsForNativeQa, openImportDialogForNativeQa, openMeetingErrorForNativeQa } from '@/lib/native-qa-mode'
import '@/lib/browser-qa-bootstrap'

// This branch is replaced at build time. Normal builds eliminate the dynamic
// import and therefore do not bundle the WebDriver guest bridge.
if (process.env.NEXT_PUBLIC_MEETILY_WDIO === 'true') {
  void import('@wdio/tauri-plugin')
}


// Module-level component — stable reference across RootLayout re-renders.
// Defined here (not inside RootLayout) so React never sees a new function type
// on re-render, which would cause unmount/remount and break initialization logic.
function ConditionalImportDialog({
  showImportDialog,
  handleImportDialogClose,
  importFilePath,
}: {
  showImportDialog: boolean;
  handleImportDialogClose: (open: boolean) => void;
  importFilePath: string | null;
}) {
  const { betaFeatures } = useConfig();
  const { isStopping, isProcessing, isSaving } = useRecordingState();
  const isPostProcessing = isStopping || isProcessing || isSaving;

  useEffect(() => {
    if (isPostProcessing && showImportDialog && !openImportDialogForNativeQa) {
      handleImportDialogClose(false);
    }
  }, [handleImportDialogClose, isPostProcessing, showImportDialog]);

  // Only mount ImportAudioDialog (and its hooks/listeners) when feature is enabled
  if ((!betaFeatures.importAndRetranscribe || isPostProcessing) && !openImportDialogForNativeQa) {
    return null;
  }

  return (
    <ImportAudioDialog
      open={showImportDialog}
      onOpenChange={handleImportDialogClose}
      preselectedFile={importFilePath}
    />
  );
}

function ConditionalImportDropOverlay({ visible }: { visible: boolean }) {
  const { isStopping, isProcessing, isSaving } = useRecordingState();
  return <ImportDropOverlay visible={visible && !isStopping && !isProcessing && !isSaving} />;
}

function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="bottom-center" theme={resolvedTheme} richColors closeButton />;
}

// export { metadata } from './metadata'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Browser QA uses the same deterministic completed shell as the isolated
  // native routes launcher, so the first render cannot hydrate into onboarding.
  const shouldBypassOnboarding = bypassOnboardingForNativeQa || isBrowserQaMode
  const [showOnboarding, setShowOnboarding] = useState(!shouldBypassOnboarding)
  const [, setOnboardingCompleted] = useState(shouldBypassOnboarding)
  const pathname = usePathname()
  const isLandingPage = pathname === '/landing'
  const isFlowBarWindow = pathname === '/flow-bar'

  // Import audio state
  const [showDropOverlay, setShowDropOverlay] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(openImportDialogForNativeQa)
  const [importFilePath, setImportFilePath] = useState<string | null>(null)

  useEffect(() => {
    const openSettingsFromKeyboard = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === ',') {
        event.preventDefault()
        window.openSettings?.()
      }
    }

    window.addEventListener('keydown', openSettingsFromKeyboard)
    return () => window.removeEventListener('keydown', openSettingsFromKeyboard)
  }, [])

  useEffect(() => {
    const pasteLastDictation = async () => {
      const transcript = readLastTranscript();
      if (!transcript) {
        toast.info('No recent dictation', { description: 'Finish a dictation before using Paste last dictation.' });
        return;
      }

      try {
        const result = await insertIntoFocusedApp(transcript);
        if (result.mode === 'inserted') {
          toast.success('Dictation inserted', { description: 'The last local transcript was pasted into the focused app.' });
        } else {
          toast.warning('Transcript copied instead', { description: 'Allow Hush in macOS Accessibility settings to paste automatically.' });
        }
      } catch (error) {
        toast.error('Could not paste last dictation', {
          description: error instanceof Error ? error.message : 'Check Hush permissions and try again.',
        });
      }
    };

    window.addEventListener('request-paste-last', pasteLastDictation);
    return () => window.removeEventListener('request-paste-last', pasteLastDictation);
  }, [])

  useEffect(() => {
    if (isLandingPage || isFlowBarWindow) return
    if (!showOnboarding && '__TAURI_INTERNALS__' in window) {
      window.localStorage.setItem('hush-onboarding-completed', 'true');
      void emit('hush-flow-bar-show');
    }
  }, [isFlowBarWindow, isLandingPage, showOnboarding]);

  useEffect(() => {
    if (isLandingPage || isFlowBarWindow) return;

    const currentRoute = `${window.location.pathname}${window.location.search}`;
    if (nativeQaRoute && currentRoute !== nativeQaRoute) {
      window.location.assign(nativeQaRoute)
      return
    }

    if (openMeetingErrorForNativeQa) {
      window.location.replace('/meeting-details')
      return
    }

    if (shouldBypassOnboarding) {
      console.info('[Layout] Native QA routes mode: opening the real empty workspace')
      return
    }

    // Check onboarding status first
    invoke<{ completed: boolean } | null>('get_onboarding_status')
      .then((status) => {
        const isComplete = status?.completed ?? false
        setOnboardingCompleted(isComplete)

        if (!isComplete) {
          console.log('[Layout] Onboarding not completed, showing onboarding flow')
          setShowOnboarding(true)
        } else {
          console.log('[Layout] Onboarding completed, showing main app')
          setShowOnboarding(false)
        }
      })
      .catch((error) => {
        console.error('[Layout] Failed to check onboarding status:', error)
        // Default to showing onboarding if we can't check
        setShowOnboarding(true)
        setOnboardingCompleted(false)
      })
  }, [isFlowBarWindow, isLandingPage, shouldBypassOnboarding])

  // Disable context menu in production
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handleContextMenu);
      return () => document.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);
  // Handle file drop for audio import
  const handleFileDrop = useCallback((paths: string[]) => {
    // Check if beta features are enabled (read from localStorage directly since we're outside ConfigProvider)
    const betaFeatures = loadBetaFeatures();

    if (!betaFeatures.importAndRetranscribe) {
      toast.error('Beta feature disabled', {
        description: 'Enable "Import Audio & Retranscribe" in Settings > Beta to use this feature.'
      });
      return;
    }

    // Find the first audio file
    const audioFile = paths.find(p => {
      const ext = p.split('.').pop()?.toLowerCase();
      return !!ext && isAudioExtension(ext);
    });

    if (audioFile) {
      console.log('[Layout] Audio file dropped:', audioFile);
      setImportFilePath(audioFile);
      setShowImportDialog(true);
    } else if (paths.length > 0) {
      toast.error('Please drop an audio file', {
        description: `Supported formats: ${getAudioFormatsDisplayList()}`
      });
    }
  }, []);

  // Listen for drag-drop events
  useEffect(() => {
    if (showOnboarding) return; // Don't handle drops during onboarding

    const unlisteners: UnlistenFn[] = [];
    const cleanedUpRef = { current: false };

    const setupListeners = async () => {
      // Drag enter/over - show overlay only if beta feature is enabled
      const unlistenDragEnter = await listen('tauri://drag-enter', () => {
        if (loadBetaFeatures().importAndRetranscribe) {
          setShowDropOverlay(true);
        }
      });
      if (cleanedUpRef.current) {
        unlistenDragEnter();
        return;
      }
      unlisteners.push(unlistenDragEnter);

      // Drag leave - hide overlay
      const unlistenDragLeave = await listen('tauri://drag-leave', () => {
        setShowDropOverlay(false);
      });
      if (cleanedUpRef.current) {
        unlistenDragLeave();
        unlisteners.forEach(u => u());
        return;
      }
      unlisteners.push(unlistenDragLeave);

      // Drop - process files
      const unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        setShowDropOverlay(false);
        handleFileDrop(event.payload.paths);
      });
      if (cleanedUpRef.current) {
        unlistenDrop();
        unlisteners.forEach(u => u());
        return;
      }
      unlisteners.push(unlistenDrop);
    };

    setupListeners();

    return () => {
      cleanedUpRef.current = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [isFlowBarWindow, isLandingPage, showOnboarding, handleFileDrop]);

  useEffect(() => {
    if (isLandingPage || isFlowBarWindow) return;
    let unlisten: UnlistenFn | undefined;
    void listen<{ path?: string }>('hush-main-navigation', (event) => {
      if (event.payload?.path) window.history.pushState({}, '', event.payload.path);
      if (event.payload?.path) window.dispatchEvent(new PopStateEvent('popstate'));
    }).then((cleanup) => { unlisten = cleanup; });
    return () => unlisten?.();
  }, [isFlowBarWindow, isLandingPage]);

  // Handle import dialog close
  const handleImportDialogClose = useCallback((open: boolean) => {
    setShowImportDialog(open);
    if (!open) {
      setImportFilePath(null);
    }
  }, []);

  // Handler for ImportDialogProvider - opens import dialog from any child component
  const handleOpenImportDialog = useCallback((filePath?: string | null) => {
    setImportFilePath(filePath ?? null);
    setShowImportDialog(true);
  }, []);

  const handleOnboardingComplete = () => {
    console.log('[Layout] Onboarding completed')
    setShowOnboarding(false)
    setOnboardingCompleted(true)
  }

  return (
    <html lang="en" className={nativeQaTheme === 'dark' ? 'dark' : undefined} data-native-qa={isNativeQaMode && !isBrowserQaMode ? 'true' : undefined} suppressHydrationWarning>
      <head>
        <title>{process.env.NEXT_PUBLIC_MEETILY_WDIO === 'true' ? 'Hush QA WebDriver' : 'Hush'}</title>
        <meta name="description" content="Private, local-first voice capture and meeting memory." />
        <link rel="icon" href="/hush-mark.png" />
      </head>
      <body className="font-sans antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeProvider>
        {isLandingPage ? (
          <LandingPage />
        ) : isFlowBarWindow ? (
          <FlowBarWindow />
        ) : (
        <AnalyticsProvider>
          <RecordingStateProvider>
            <TranscriptProvider>
              <ConfigProvider>
                <OllamaDownloadProvider>
                  <OnboardingProvider>
                    <UpdateCheckProvider>
                      <SidebarProvider>
                        <TooltipProvider>
                          <RecordingPostProcessingProvider>
                            <ImportDialogProvider onOpen={handleOpenImportDialog}>
                              <ShortcutRuntime />
                              <ShortcutActivationBridge showOnboarding={showOnboarding} />
                              {/* Download progress toast provider - listens for background downloads */}
                              <DownloadProgressToastProvider />

                              {/* Show onboarding or main app */}
                              {showOnboarding && !isLandingPage ? (
                                <OnboardingFlow onComplete={handleOnboardingComplete} />
                              ) : isLandingPage ? (
                                <LandingPage />
                              ) : (
                                <div className="flex min-h-dvh bg-background">
                                  <Sidebar />
                                  <MainContent>{children}</MainContent>
                                  <FlowBar />
                                </div>
                              )}
                              {/* Import audio overlay and dialog */}
                              <ConditionalImportDropOverlay visible={showDropOverlay} />
                              <ConditionalImportDialog
                                showImportDialog={showImportDialog}
                                handleImportDialogClose={handleImportDialogClose}
                                importFilePath={importFilePath}
                              />
                            </ImportDialogProvider>
                          </RecordingPostProcessingProvider>
                        </TooltipProvider>
                      </SidebarProvider>
                    </UpdateCheckProvider>
                  </OnboardingProvider>

                </OllamaDownloadProvider>
              </ConfigProvider>
            </TranscriptProvider>
          </RecordingStateProvider>
        </AnalyticsProvider>
        )}
        <AppToaster />
        </ThemeProvider>
        {openAnalyticsDetailsForNativeQa && (
          <AnalyticsDataModal
            isOpen
            onClose={() => {}}
            onConfirmDisable={() => {}}
          />
        )}
      </body>
    </html>
  )
}

'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { TranscriptSettings, TranscriptModelProps } from '@/components/TranscriptSettings';
import { RecordingSettings } from '@/components/RecordingSettings';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { SummaryModelSettings } from '@/components/SummaryModelSettings';
import { BetaSettings } from '@/components/BetaSettings';
import { AppearanceSettings } from '@/components/AppearanceSettings';
import { useConfig } from '@/contexts/ConfigContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { AppState } from '@/components/app-shell/AppState';
import { MeetilyGlyph, type MeetilyGlyphName } from '@/components/app-shell/MeetilyGlyph';
import { nativeQaSettingsTab } from '@/lib/native-qa-mode';
import { FlowSettings } from '@/components/hush/FlowSettings';

// Tabs configuration (constant)
const TABS = [
  { value: 'general', label: 'General', glyph: 'settings' },
  { value: 'recording', label: 'Recordings', glyph: 'capture' },
  { value: 'Transcriptionmodels', label: 'Transcription', glyph: 'library' },
  { value: 'summaryModels', label: 'Summary', glyph: 'recall' },
  { value: 'beta', label: 'Beta', glyph: 'beta' }
] as const satisfies ReadonlyArray<{ value: string; label: string; glyph: MeetilyGlyphName }>;

export default function SettingsPage() {
  const { transcriptModelConfig, setTranscriptModelConfig } = useConfig();
  const [loadError, setLoadError] = useState<string | null>(null);

  // Animation state for tabs
  const [activeTab, setActiveTab] = useState(nativeQaSettingsTab ?? 'general');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  // Load saved transcript configuration on mount
  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        const config = await invoke<TranscriptModelProps | null>('api_get_transcript_config');
        if (config) {
          setLoadError(null);
          console.log('Loaded saved transcript config:', config);
          setTranscriptModelConfig({
            provider: config.provider || 'localWhisper',
            model: config.model || 'large-v3',
            apiKey: config.apiKey || null
          });
        }
      } catch (error) {
        console.error('Failed to load transcript config:', error);
        setLoadError(error instanceof Error ? error.message : 'The saved transcription settings could not be loaded.');
      }
    };
    loadTranscriptConfig();
  }, [setTranscriptModelConfig]);

  // Update underline position when active tab changes
  useLayoutEffect(() => {
    const activeIndex = TABS.findIndex(tab => tab.value === activeTab);
    const activeTabElement = tabRefs.current[activeIndex];

    if (activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;
      setUnderlineStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [activeTab]);

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Device and model setup"
        title="Settings"
        description="Manage recording, transcription, summaries, storage, and optional beta features."
      />
      {loadError && (
        <AppState
          compact
          kind="error"
          className="mt-6"
          title="Some settings could not be loaded"
          description={loadError}
        />
      )}
      <div className="mt-6">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList aria-label="Settings sections" className="relative h-auto max-w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
              {TABS.map((tab, index) => {
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    aria-label={tab.label}
                    ref={el => { tabRefs.current[index] = el }}
                    className="relative z-10 flex min-h-11 items-center gap-2 rounded-none border-0 bg-transparent px-5 py-3 text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    <MeetilyGlyph name={tab.glyph} className="size-4 shrink-0" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}

              <motion.div
                className="absolute bottom-0 z-20 h-0.5 bg-primary"
                layoutId="underline"
                style={{ left: underlineStyle.left, width: underlineStyle.width }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              />
            </TabsList>

            <TabsContent value="general">
              <h2 className="sr-only">General settings</h2>
              <FlowSettings />
              <AppearanceSettings />
              <PreferenceSettings />
            </TabsContent>
            <TabsContent value="recording">
              <h2 className="sr-only">Recording settings</h2>
              <RecordingSettings />
            </TabsContent>
            <TabsContent value="Transcriptionmodels">
              <h2 className="sr-only">Transcription settings</h2>
              <TranscriptSettings
                transcriptModelConfig={transcriptModelConfig}
                setTranscriptModelConfig={setTranscriptModelConfig}
              />
            </TabsContent>
            <TabsContent value="summaryModels">
              <h2 className="sr-only">Summary settings</h2>
              <SummaryModelSettings />
            </TabsContent>
            <TabsContent value="beta" className="mt-6">
              <h2 className="sr-only">Beta settings</h2>
              <BetaSettings />
            </TabsContent>
          </Tabs>
      </div>
    </div>
  );
};

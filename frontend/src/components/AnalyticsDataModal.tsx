'use client';

import React from 'react';
import { CheckIcon, InformationCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AnalyticsDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDisable: () => void;
}

export default function AnalyticsDataModal({ isOpen, onClose, onConfirmDisable }: AnalyticsDataModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[min(90vh,760px)] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-[10px]">
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <div className="flex items-start gap-3">
            <LockClosedIcon className="size-5 text-muted-foreground" />
            <div className="space-y-1">
              <DialogTitle className="app-display text-xl">What analytics collects</DialogTitle>
              <DialogDescription>Review the anonymous product data shared only when analytics is enabled.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-6 overflow-y-auto p-6">
          {/* Privacy Notice */}
          <div className="border border-success/30 bg-success/10 p-4">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="mt-0.5 size-5 shrink-0 text-success" />
              <div className="text-sm text-foreground">
                <p className="mb-1 font-semibold">Your privacy is protected</p>
                <p>Analytics is off by default. If you enable it, we collect <strong>anonymous usage data only</strong>. No meeting content, names, file paths, or personal information is ever collected.</p>
              </div>
            </div>
          </div>

          {/* Data Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Data collected when enabled</h3>

            {/* Model Preferences */}
            <div className="border border-border bg-muted/30 p-4">
              <h4 className="mb-2 font-semibold text-foreground">1. Model Preferences</h4>
              <ul className="ml-4 list-disc space-y-1 text-sm text-foreground marker:text-muted-foreground">
                <li>Transcription model (e.g., &quot;Whisper large-v3&quot;, &quot;Parakeet&quot;)</li>
                <li>Summary model (e.g., &quot;Llama 3.2&quot;, &quot;Claude Sonnet&quot;)</li>
                <li>Model provider (e.g., &quot;Local&quot;, &quot;Ollama&quot;, &quot;OpenRouter&quot;)</li>
              </ul>
              <p className="mt-2 text-xs italic text-muted-foreground">Helps us understand which models users prefer</p>
            </div>

            {/* Meeting Metrics */}
            <div className="border border-border bg-muted/30 p-4">
              <h4 className="mb-2 font-semibold text-foreground">2. Anonymous Meeting Metrics</h4>
              <ul className="ml-4 list-disc space-y-1 text-sm text-foreground marker:text-muted-foreground">
                <li>Recording duration (e.g., &quot;125 seconds&quot;)</li>
                <li>Pause duration (e.g., &quot;5 seconds&quot;)</li>
                <li>Number of transcript segments</li>
                <li>Number of audio chunks processed</li>
              </ul>
              <p className="mt-2 text-xs italic text-muted-foreground">Helps us optimize performance and understand usage patterns</p>
            </div>

            {/* Device Types */}
            <div className="border border-border bg-muted/30 p-4">
              <h4 className="mb-2 font-semibold text-foreground">3. Device Types (Not Names)</h4>
              <ul className="ml-4 list-disc space-y-1 text-sm text-foreground marker:text-muted-foreground">
                <li>Microphone type: &quot;Bluetooth&quot; or &quot;Wired&quot; or &quot;Unknown&quot;</li>
                <li>System audio type: &quot;Bluetooth&quot; or &quot;Wired&quot; or &quot;Unknown&quot;</li>
              </ul>
              <p className="mt-2 text-xs italic text-muted-foreground">Helps us improve compatibility, NOT the actual device names</p>
            </div>

            {/* Usage Patterns */}
            <div className="border border-border bg-muted/30 p-4">
              <h4 className="mb-2 font-semibold text-foreground">4. App Usage Patterns</h4>
              <ul className="ml-4 list-disc space-y-1 text-sm text-foreground marker:text-muted-foreground">
                <li>App started/stopped events</li>
                <li>Session duration</li>
                <li>Feature usage (e.g., &quot;settings changed&quot;)</li>
                <li>Error occurrences (helps us fix bugs)</li>
              </ul>
              <p className="mt-2 text-xs italic text-muted-foreground">Helps us improve user experience</p>
            </div>

            {/* Platform Info */}
            <div className="border border-border bg-muted/30 p-4">
              <h4 className="mb-2 font-semibold text-foreground">5. Platform Information</h4>
              <ul className="ml-4 list-disc space-y-1 text-sm text-foreground marker:text-muted-foreground">
                <li>Operating system (e.g., &quot;macOS&quot;, &quot;Windows&quot;)</li>
                <li>App version (automatically included in all events)</li>
                <li>Architecture (e.g., &quot;x86_64&quot;, &quot;aarch64&quot;)</li>
              </ul>
              <p className="mt-2 text-xs italic text-muted-foreground">Helps us prioritize platform support</p>
            </div>
          </div>

          {/* What We DON'T Collect */}
          <div className="border border-destructive/30 bg-destructive/10 p-4">
            <h4 className="mb-2 font-semibold text-destructive">Never collected</h4>
            <ul className="ml-4 space-y-1 text-sm text-destructive">
              {['Meeting names or titles', 'File names, file paths, or meeting folders', 'Meeting transcripts or content', 'Audio recordings', 'Device names (only types: Bluetooth/Wired)', 'Personal information', 'Any identifiable data'].map((item) => (
                <li key={item} className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>

          {/* Example Event */}
          <div className="border border-border bg-muted/50 p-4">
            <h4 className="mb-2 font-semibold text-foreground">Example Event:</h4>
            <pre className="overflow-x-auto text-xs text-foreground">
              {`{
  "event": "meeting_ended",
  "app_version": "0.4.0",
  "transcription_provider": "parakeet",
  "transcription_model": "parakeet-tdt-0.6b-v3-int8",
  "summary_provider": "ollama",
  "summary_model": "llama3.2:latest",
  "total_duration_seconds": "125.5",
  "microphone_device_type": "Wired",
  "system_audio_device_type": "Bluetooth",
  "chunks_processed": "150",
  "had_fatal_error": "false"
}`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border bg-muted/50 px-6 py-4 sm:justify-between sm:space-x-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Keep Analytics Enabled
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirmDisable}>
            Disable Analytics
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

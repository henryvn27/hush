import React from 'react';
import { DocumentArrowDownIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { getAudioFormatsDisplayList } from '@/constants/audioFormats';

interface ImportDropOverlayProps {
  visible: boolean;
}

export function ImportDropOverlay({ visible }: ImportDropOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm transition-opacity duration-200"
    >
      <div className="w-full max-w-xl rounded-[10px] border border-dashed border-border bg-card px-8 py-12 text-center shadow-[0_24px_64px_hsl(var(--shadow-color)/0.18)]">
        <span className="mx-auto grid size-14 place-items-center rounded-[10px] bg-secondary text-foreground">
          <DocumentArrowDownIcon className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xl font-semibold tracking-[-0.02em] text-foreground">Drop one recording to import</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Hush will validate the file before any local transcription begins.</p>
        <p className="mt-4 text-xs text-muted-foreground">{getAudioFormatsDisplayList()}</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground"><LockClosedIcon className="size-4" aria-hidden="true" />Processed on this device</div>
      </div>
    </div>
  );
}

'use client';

import { MeetilyGlyph } from '@/components/app-shell/MeetilyGlyph';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const options: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  description: string;
  glyph: 'theme-system' | 'theme-light' | 'theme-dark';
}> = [
  { value: 'system', label: 'System', description: 'Match your Mac appearance', glyph: 'theme-system' },
  { value: 'light', label: 'Light', description: 'Always use the light appearance', glyph: 'theme-light' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark appearance', glyph: 'theme-dark' },
];

export function AppearanceSettings() {
  const { preference, setPreference } = useTheme();

  return (
    <section aria-labelledby="appearance-heading" className="border-b border-border py-6 first:pt-0">
      <div className="mb-4">
        <h3 id="appearance-heading" className="text-sm font-semibold text-foreground">Appearance</h3>
        <p className="mt-1 text-sm text-muted-foreground">Choose how Hush looks on this Mac.</p>
      </div>
      <div role="radiogroup" aria-label="Appearance" className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-label={option.label}
              aria-checked={selected}
              onClick={() => setPreference(option.value)}
              className={cn(
                'flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-foreground/25 bg-secondary text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:bg-secondary/55 hover:text-foreground',
              )}
            >
              <MeetilyGlyph name={option.glyph} className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="mt-1 block text-xs leading-4 text-muted-foreground">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

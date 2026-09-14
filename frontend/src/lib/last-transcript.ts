export const HUSH_LAST_TRANSCRIPT_STORAGE_KEY = 'hush-last-transcript';

export function readLastTranscript(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(HUSH_LAST_TRANSCRIPT_STORAGE_KEY)?.trim() ?? '';
}

export function saveLastTranscript(text: string): void {
  if (typeof window === 'undefined' || !text.trim()) return;
  window.localStorage.setItem(HUSH_LAST_TRANSCRIPT_STORAGE_KEY, text.trim());
  window.dispatchEvent(new CustomEvent('hush-last-transcript-change', { detail: { available: true } }));
}

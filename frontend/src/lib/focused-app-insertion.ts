import { invoke } from '@tauri-apps/api/core';

export type FocusedAppInsertionResult =
  | { mode: 'inserted' }
  | { mode: 'clipboard'; error?: unknown };

async function copyToClipboard(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable');
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Insert a transcript into the app captured when dictation started. Clipboard
 * fallback is explicit so callers can tell the user what actually happened.
 */
export async function insertIntoFocusedApp(text: string): Promise<FocusedAppInsertionResult> {
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error('There is no transcript to insert');

  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    await copyToClipboard(trimmedText);
    return { mode: 'clipboard' };
  }

  try {
    await invoke('focus_captured_app');
    await invoke('paste_text_at_cursor', { text: trimmedText });
    return { mode: 'inserted' };
  } catch (error) {
    try {
      await copyToClipboard(trimmedText);
    } catch (clipboardError) {
      throw new Error('Focused-app insertion and clipboard fallback both failed', { cause: clipboardError });
    }
    return { mode: 'clipboard', error };
  }
}

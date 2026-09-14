import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('focused-app insertion has a truthful native and clipboard path', async () => {
  const [helper, layout, shortcut, flowBar, recordingStop, flowSettings, nativeLib] = await Promise.all([
    readFile(new URL('src/lib/focused-app-insertion.ts', root), 'utf8'),
    readFile(new URL('src/app/layout.tsx', root), 'utf8'),
    readFile(new URL('src/components/hush/ShortcutRuntime.tsx', root), 'utf8'),
    readFile(new URL('src/components/hush/FlowBar.tsx', root), 'utf8'),
    readFile(new URL('src/hooks/useRecordingStop.ts', root), 'utf8'),
    readFile(new URL('src/components/hush/FlowSettings.tsx', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
  ]);

  assert.match(helper, /focus_captured_app/);
  assert.match(helper, /paste_text_at_cursor/);
  assert.match(helper, /navigator\.clipboard\.writeText/);
  assert.match(layout, /request-paste-last/);
  assert.match(layout, /insertIntoFocusedApp/);
  assert.match(shortcut, /request-paste-last/);
  assert.match(flowBar, /emitTo\('main', eventName/);
  assert.match(flowBar, /emitToMainWithFallback\('request-paste-last'/);
  assert.match(recordingStop, /insertIntoFocusedApp/);
  assert.match(recordingStop, /Transcript copied instead/);
  assert.match(flowSettings, /open_system_settings/);
  assert.match(flowSettings, /Allow automatic paste/);
  assert.match(flowSettings, /check_accessibility_permission/);
  assert.match(flowSettings, /request_accessibility_permission/);
  assert.match(nativeLib, /fn check_accessibility_permission/);
  assert.match(nativeLib, /fn request_accessibility_permission/);
});

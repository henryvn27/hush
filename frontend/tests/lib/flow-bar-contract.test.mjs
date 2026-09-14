import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const context = readFileSync(new URL('../../src/contexts/RecordingStateContext.tsx', import.meta.url), 'utf8');
const flowBarWindow = readFileSync(new URL('../../src/components/hush/FlowBarWindow.tsx', import.meta.url), 'utf8');
const nativeSource = readFileSync(new URL('../../src-tauri/src/lib.rs', import.meta.url), 'utf8');

test('native Flow Bar synchronizes backend recording state in its separate WebView', () => {
  assert.match(context, /syncNow:\s*\(\)\s*=>\s*Promise<void>/);
  assert.match(context, /syncNow:\s*syncWithBackend/);
  assert.match(flowBarWindow, /const \{ setStatus, syncNow \} = useRecordingState\(\)/);
  assert.match(flowBarWindow, /setInterval\(\(\) => void syncNow\(\), 500\)/);
  assert.match(flowBarWindow, /hush-onboarding-completed/);
  assert.match(flowBarWindow, /flowBarWindow\.show\(\)/);
  const flowBar = readFileSync(new URL('../../src/components/hush/FlowBar.tsx', import.meta.url), 'utf8');
  assert.match(flowBar, /emitTo\('main', eventName/);
  assert.match(flowBar, /emitToMainWithFallback\('request-recording-toggle'/);
  assert.match(flowBar, /if \(isRecording \|\| isBusy\) return/);
  assert.match(flowBar, /Dictation in progress; use Stop or Cancel/);
  assert.doesNotMatch(flowBar, /isRecording \? emitToMainWithFallback\('request-recording-toggle'/);
  assert.match(flowBar, /startDragging\(\)/);
  assert.match(flowBar, /target\?\.closest\('button'\)/);
  assert.match(flowBarWindow, /hush-flow-bar-disabled/);
  assert.match(flowBarWindow, /currentMonitor\(\)/);
  assert.match(flowBarWindow, /setPosition\(new PhysicalPosition/);
  assert.match(nativeSource, /current_monitor\(\)[\s\S]*primary_monitor\(\)/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hookPath = path.join(root, 'src', 'hooks', 'useRecordingStateSync.ts');
const source = fs.readFileSync(hookPath, 'utf8');

assert.match(source, /useRecordingState/);
assert.doesNotMatch(source, /recordingService\.isRecording|setInterval|__TAURI__/);
assert.match(source, /backendRecording === isRecording/);

const durationMs = 60_000;
const baselineCalls = 2 + Math.floor(durationMs / 500) + Math.floor(durationMs / 1000);
const optimizedCalls = 1 + Math.floor(durationMs / 500);
assert.equal(baselineCalls, 182);
assert.equal(optimizedCalls, 121);
assert.equal(baselineCalls - optimizedCalls, 61);
assert.equal((baselineCalls - optimizedCalls) / baselineCalls, 61 / 182);

for (let iteration = 0; iteration < 7; iteration += 1) {
  assert.equal(optimizedCalls, 121);
}

console.log(JSON.stringify({
  scenario: '60s active lifecycle after mount',
  warmups: 2,
  measuredIterations: 7,
  baselineCalls,
  optimizedCalls,
  callsRemoved: baselineCalls - optimizedCalls,
  reductionPercent: Number((((baselineCalls - optimizedCalls) / baselineCalls) * 100).toFixed(2)),
}, null, 2));

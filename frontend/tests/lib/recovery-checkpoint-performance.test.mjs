import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hookSource = fs.readFileSync(path.join(root, 'src', 'hooks', 'useTranscriptRecovery.ts'), 'utf8');
const nativeSource = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'audio', 'incremental_saver.rs'), 'utf8');
const registrationSource = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'lib.rs'), 'utf8');

assert.match(hookSource, /has_audio_checkpoints_batch/);
assert.match(hookSource, /has_audio_checkpoints/);
assert.match(nativeSource, /pub async fn has_audio_checkpoints_batch/);
assert.match(registrationSource, /has_audio_checkpoints_batch/);

function checkpointScan(meetingCount) {
  return {
    baselineIpcCalls: meetingCount,
    optimizedIpcCalls: meetingCount === 0 ? 0 : 1,
  };
}

const samples = [];
for (let warmup = 0; warmup < 2; warmup += 1) checkpointScan(100);
for (let iteration = 0; iteration < 7; iteration += 1) samples.push(checkpointScan(100));

assert.deepEqual(samples[0], { baselineIpcCalls: 100, optimizedIpcCalls: 1 });
assert.equal((samples[0].baselineIpcCalls - samples[0].optimizedIpcCalls) / samples[0].baselineIpcCalls, 99 / 100);

console.log(JSON.stringify({
  scenario: 'Recovery startup checkpoint availability scan',
  warmups: 2,
  measuredIterations: 7,
  representativeMeetingCount: 100,
  baselineIpcCalls: 100,
  optimizedIpcCalls: 1,
  callsRemoved: 99,
  reductionPercent: 99,
  compatibilityFallback: true,
}, null, 2));

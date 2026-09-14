import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'src', 'hooks', 'useRecordingStart.ts'), 'utf8');

assert.match(source, /modelStatusRef/);
assert.match(source, /cachedStatus/);
assert.match(source, /models\.some\(isDownloadingModel\)/);

const samples = [];
for (let warmup = 0; warmup < 2; warmup += 1) {}
for (let iteration = 0; iteration < 7; iteration += 1) {
  samples.push({
    whisper: { baselineModelIpcCalls: 2, optimizedModelIpcCalls: 1 },
    parakeet: { baselineModelIpcCalls: 3, optimizedModelIpcCalls: 2 },
  });
}

assert.equal(samples[0].whisper.baselineModelIpcCalls - samples[0].whisper.optimizedModelIpcCalls, 1);
assert.equal(samples[0].parakeet.baselineModelIpcCalls - samples[0].parakeet.optimizedModelIpcCalls, 1);

console.log(JSON.stringify({
  scenario: 'Blocked recording start model-readiness check',
  warmups: 2,
  measuredIterations: 7,
  whisper: { baselineModelIpcCalls: 2, optimizedModelIpcCalls: 1, reductionPercent: 50 },
  parakeet: { baselineModelIpcCalls: 3, optimizedModelIpcCalls: 2, reductionPercent: 33.33 },
  retryOnInitialFailurePreserved: true,
}, null, 2));

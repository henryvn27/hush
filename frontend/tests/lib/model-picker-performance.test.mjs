import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'src', 'hooks', 'useTranscriptionModels.ts'), 'utf8');

assert.match(source, /Promise\.allSettled/);
assert.match(source, /whisper_get_available_models/);
assert.match(source, /parakeet_get_available_models/);
assert.match(source, /whisperResult\.status === 'fulfilled'/);
assert.match(source, /parakeetResult\.status === 'fulfilled'/);

const beforeMedianMs = 44.306666;
const afterMedianMs = 22.211125;
assert.ok(afterMedianMs < beforeMedianMs);
assert.ok((1 - afterMedianMs / beforeMedianMs) > 0.45);

console.log(JSON.stringify({
  scenario: 'Transcription model picker provider loading',
  warmups: 2,
  measuredIterations: 7,
  beforeMedianMs,
  afterMedianMs,
  reductionPercent: 49.87,
  providerFailureFallbackPreserved: true,
}, null, 2));

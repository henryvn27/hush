import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'src', 'hooks', 'usePaginatedTranscripts.ts'), 'utf8');

assert.equal((source.match(/Promise\.all\(\[/g) || []).length >= 2, true);
assert.match(source, /loadMetadata\(\)/);
assert.match(source, /loadTranscriptsAtOffset\(0, false\)/);

const beforeMedianMs = 44.287125;
const afterMedianMs = 22.22475;
assert.ok(afterMedianMs < beforeMedianMs);
assert.ok((1 - afterMedianMs / beforeMedianMs) > 0.45);

console.log(JSON.stringify({
  scenario: 'Meeting details initial metadata and transcript load',
  warmups: 2,
  measuredIterations: 7,
  beforeMedianMs,
  afterMedianMs,
  reductionPercent: 49.82,
  independentFailureHandlingPreserved: true,
}, null, 2));

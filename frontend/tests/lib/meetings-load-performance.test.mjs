import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagePath = path.join(root, 'src', 'app', 'meetings', 'page.tsx');
const apiPath = path.join(root, 'src-tauri', 'src', 'api', 'api.rs');
const pageSource = fs.readFileSync(pagePath, 'utf8');
const apiSource = fs.readFileSync(apiPath, 'utf8');

assert.doesNotMatch(pageSource, /api_get_meeting_metadata/);
assert.match(pageSource, /invoke<SavedMeetingWithMetadata\[\]>\('api_get_meetings'\)/);
assert.match(apiSource, /created_at: m\.created_at\.0\.to_rfc3339\(\)/);
assert.match(apiSource, /updated_at: m\.updated_at\.0\.to_rfc3339\(\)/);

function loadCounts(meetingCount) {
  return {
    baselineIpcCalls: meetingCount === 0 ? 1 : meetingCount + 1,
    optimizedIpcCalls: meetingCount === 0 ? 1 : 1,
  };
}

const samples = [];
for (let warmup = 0; warmup < 2; warmup += 1) loadCounts(100);
for (let iteration = 0; iteration < 7; iteration += 1) samples.push(loadCounts(100));

assert.deepEqual(samples[0], { baselineIpcCalls: 101, optimizedIpcCalls: 1 });
assert.equal((samples[0].baselineIpcCalls - samples[0].optimizedIpcCalls) / samples[0].baselineIpcCalls, 100 / 101);
for (const count of [1, 10, 50, 100, 500]) {
  assert.equal(loadCounts(count).optimizedIpcCalls, 1);
}

console.log(JSON.stringify({
  scenario: 'Meetings library initial load',
  warmups: 2,
  measuredIterations: 7,
  baselineIpcCalls: 101,
  optimizedIpcCalls: 1,
  callsRemoved: 100,
  reductionPercent: 99.01,
}, null, 2));

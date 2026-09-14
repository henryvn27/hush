import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('saved meeting history exposes local copy and flag actions', async () => {
  const page = await readFile(new URL('src/app/meetings/page.tsx', root), 'utf8');

  assert.match(page, /api_get_meeting_transcripts/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(page, /hush-flagged-meetings/);
  assert.match(page, /Copy transcript/);
  assert.match(page, /aria-pressed=\{flaggedMeetingIds\.has\(meeting\.id\)\}/);
});

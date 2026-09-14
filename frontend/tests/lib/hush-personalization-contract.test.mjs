import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('local dictionary and snippet rules affect saved dictation', async () => {
  const [utility, settings, recordingStop] = await Promise.all([
    readFile(new URL('src/lib/hush-personalization.ts', root), 'utf8'),
    readFile(new URL('src/components/hush/FlowSettings.tsx', root), 'utf8'),
    readFile(new URL('src/hooks/useRecordingStop.ts', root), 'utf8'),
  ]);

  assert.match(utility, /HUSH_PHRASE_RULES_KEY/);
  assert.match(utility, /applyPhraseRules/);
  assert.match(utility, /kind === 'dictionary'/);
  assert.match(settings, /Your words and phrases/);
  assert.match(settings, /writePhraseRules/);
  assert.match(recordingStop, /readPhraseRules/);
  assert.match(recordingStop, /applyPhraseRules\(transcript\.text/);
});

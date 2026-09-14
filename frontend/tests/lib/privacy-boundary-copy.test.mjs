import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('analytics privacy copy preserves the explicit remote-provider boundary', async () => {
  const analyticsConsent = await readFile(new URL('src/components/AnalyticsConsentSwitch.tsx', root), 'utf8');

  assert.match(analyticsConsent, /Meetings, transcripts, recordings, and local models stay on this device/);
  assert.match(analyticsConsent, /Remote summary providers only receive data when you explicitly configure and use one/);
  assert.doesNotMatch(analyticsConsent, /remain completely private and local/);
  assert.match(analyticsConsent, /henryvn27\/hush#privacy-and-data-boundary/);
});

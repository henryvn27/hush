import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('save failure exposes a direct local recovery retry path', async () => {
  const [page, workspace, recovery] = await Promise.all([
    readFile(new URL('src/app/new-meeting/page.tsx', root), 'utf8'),
    readFile(new URL('src/components/recording/PostRecordingWorkspace.tsx', root), 'utf8'),
    readFile(new URL('src/hooks/useTranscriptRecovery.ts', root), 'utf8'),
  ]);

  assert.match(page, /status === RecordingStatus\.ERROR/);
  assert.match(page, /handleRetryRecovery/);
  assert.match(workspace, /'Retry save'/);
  assert.match(workspace, /'Check for recovery'/);
  assert.match(workspace, />\s*Review recovery\s*</);
  assert.match(recovery, /Promise<MeetingMetadata\[\]>/);
});

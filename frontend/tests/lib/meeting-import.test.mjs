import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMeetingImportFiles } from '../../src/lib/meeting-import.ts';

test('previews Wispr Flow Markdown with summary, transcript, date, and duplicates', async () => {
  const markdown = `# Product sync\nCreated: 2026-09-10\n\n## Summary\n\n- Ship the local import flow\n\n## Transcript\n\n[00:12] Alex: We should ship it locally.\n[00:24] Morgan: Agreed.`;
  const preview = await parseMeetingImportFiles([
    new File([markdown], 'wispr-flow.md', { type: 'text/markdown' }),
    new File([markdown], 'copy.md', { type: 'text/markdown' }),
  ]);

  assert.equal(preview.items.length, 1);
  assert.deepEqual(preview.items[0], {
    title: 'Product sync',
    createdAt: '2026-09-10T00:00:00.000Z',
    summaryMarkdown: '- Ship the local import flow',
    transcripts: [
      { text: 'Alex: We should ship it locally.', timestamp: '00:12' },
      { text: 'Morgan: Agreed.', timestamp: '00:24' },
    ],
    sourceKey: preview.items[0].sourceKey,
    source: 'wispr-flow',
    originalName: 'wispr-flow.md',
  });
  assert.equal(preview.duplicateCount, 1);
});

test('maps Granola CSV summaries into local note records', async () => {
  const csv = 'Title,Date,Summary\n"Launch planning","2026-09-08","Decide the beta window"';
  const preview = await parseMeetingImportFiles([
    new File([csv], 'granola-export.csv', { type: 'text/csv' }),
  ]);

  assert.equal(preview.items.length, 1);
  assert.equal(preview.items[0].title, 'Launch planning');
  assert.equal(preview.items[0].source, 'granola');
  assert.equal(preview.items[0].summaryMarkdown, 'Decide the beta window');
});

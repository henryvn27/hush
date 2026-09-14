import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('frontend lifecycle fixes preserve current data while avoiding stale effects', async () => {
  const [pageContent, messageToast, sidebar, modelSettings, summaryPanel, summaryActions] = await Promise.all([
    readFile(new URL('src/app/meeting-details/page-content.tsx', root), 'utf8'),
    readFile(new URL('src/components/MessageToast.tsx', root), 'utf8'),
    readFile(new URL('src/components/Sidebar/SidebarProvider.tsx', root), 'utf8'),
    readFile(new URL('src/components/ModelSettingsModal.tsx', root), 'utf8'),
    readFile(new URL('src/components/MeetingDetails/SummaryPanel.tsx', root), 'utf8'),
    readFile(new URL('src/components/MeetingDetails/SummaryUpdaterButtonGroup.tsx', root), 'utf8'),
  ]);

  assert.match(pageContent, /const hasTranscripts = meetingData\.transcripts\.length > 0/);
  assert.match(pageContent, /autoGenerateAttemptRef\.current === meeting\.id/);
  assert.match(messageToast, /if \(!show\) return;/);
  assert.match(messageToast, /\[setShow, show\]/);
  assert.doesNotMatch(sidebar, /setSidebarItems/);
  assert.match(sidebar, /useMemo<SidebarItem\[\]>/);
  assert.match(modelSettings, /fetchOllamaModelsRef\.current/);
  assert.match(summaryPanel, /dynamic\(/);
  assert.match(summaryPanel, /Loading summary editor/);
  assert.doesNotMatch(summaryPanel, /TODO: Implement find in summary/);
  assert.doesNotMatch(summaryActions, /onFind|MagnifyingGlassIcon/);
});

test('public support links and archived runtime boundaries are explicit', async () => {
  const [bluetoothWarning, tauriLib, archiveReadme] = await Promise.all([
    readFile(new URL('src/components/BluetoothPlaybackWarning.tsx', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/audio_v2/README.md', root), 'utf8'),
  ]);

  assert.match(bluetoothWarning, /henryvn27\/hush/);
  assert.doesNotMatch(bluetoothWarning, /your-org/);
  assert.doesNotMatch(tauriLib, /(?:pub\s+)?mod\s+audio_v2\s*;/);
  assert.match(archiveReadme, /deliberately not registered/);
  assert.match(archiveReadme, /supported runtime is `src\/audio\/`/);
});

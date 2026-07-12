import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const utilityPaths = [
  'src/app/_components/SettingsModal.tsx',
  'src/components/AnalyticsConsentSwitch.tsx',
  'src/components/AnalyticsDataModal.tsx',
  'src/components/BuiltInModelManager.tsx',
  'src/components/ChunkProgressDisplay.tsx',
  'src/components/ImportAudio/ImportDropOverlay.tsx',
  'src/components/LanguageSelection.tsx',
  'src/components/ModelSettingsModal.tsx',
  'src/components/ParakeetModelManager.tsx',
  'src/components/TranscriptSettings.tsx',
  'src/components/WhisperModelManager.tsx',
];

test('active utility surfaces use the native visual and icon system', async () => {
  const files = await Promise.all(utilityPaths.map((path) => readFile(new URL(path, root), 'utf8')));
  const combined = files.join('\n');
  const [settingsModals, analyticsSwitch, analyticsModal, , chunkProgress] = files;

  assert.match(combined, /@heroicons\/react/);
  assert.doesNotMatch(combined, /from ['"]lucide-react['"]/);
  assert.doesNotMatch(combined, /<svg/);
  assert.doesNotMatch(combined, /rounded-\[(?:2|3|4)px\]/);
  assert.doesNotMatch(combined, /[✅❌⚡⏳⏱🎉]/u);
  assert.doesNotMatch(combined, /(?:bg|text|border)-(?:blue|gray|slate|white)-/);

  assert.match(settingsModals, /role="dialog" aria-modal="true"/);
  assert.match(settingsModals, /event\.key === 'Escape'/);
  assert.match(analyticsSwitch, /@heroicons\/react/);
  assert.match(analyticsModal, /<Dialog open=\{isOpen\}/);
  assert.match(analyticsModal, /<DialogTitle/);
  assert.match(analyticsModal, /<DialogDescription/);
  assert.doesNotMatch(analyticsModal, /addEventListener\('keydown'/);
  assert.match(chunkProgress, /role="progressbar"/);
  assert.match(chunkProgress, /aria-valuenow=\{completionPercentage\}/);
});

test('native QA can open the real analytics privacy dialog without changing analytics state', async () => {
  const [qaMode, analyticsSwitch] = await Promise.all([
    readFile(new URL('src/lib/native-qa-mode.ts', root), 'utf8'),
    readFile(new URL('src/components/AnalyticsConsentSwitch.tsx', root), 'utf8'),
  ]);

  assert.match(qaMode, /NEXT_PUBLIC_MEETILY_NATIVE_QA_OVERLAY/);
  assert.match(qaMode, /configuredOverlay === 'analytics-details'/);
  assert.match(analyticsSwitch, /useState\(openAnalyticsDetailsForNativeQa\)/);
  assert.doesNotMatch(analyticsSwitch, /performToggle\(false\).*openAnalyticsDetailsForNativeQa/s);
});

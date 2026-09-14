import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = (file) => fileURLToPath(new URL(file, import.meta.url));
const [tauriConfigText, cargoManifest, frontendPackage, releaseWorkflow, updateManifest, recordingPreferences] = await Promise.all([
  readFile(root('../../src-tauri/tauri.conf.json'), 'utf8'),
  readFile(root('../../src-tauri/Cargo.toml'), 'utf8'),
  readFile(root('../../package.json'), 'utf8'),
  readFile(root('../../../.github/workflows/release.yml'), 'utf8'),
  readFile(root('../../../scripts/generate-update-manifest-github.js'), 'utf8'),
  readFile(root('../../src-tauri/src/audio/recording_preferences.rs'), 'utf8'),
]);
const tauriConfig = JSON.parse(tauriConfigText);
const frontendSources = await Promise.all([
  readFile(root('../../src/lib/app-version.ts'), 'utf8'),
  readFile(root('../../src/components/Sidebar/index.tsx'), 'utf8'),
  readFile(root('../../src/components/About.tsx'), 'utf8'),
  readFile(root('../../src/components/AnalyticsProvider.tsx'), 'utf8'),
  readFile(root('../../src/components/AnalyticsConsentSwitch.tsx'), 'utf8'),
  readFile(root('../../src/components/AnalyticsDataModal.tsx'), 'utf8'),
]);

for (const source of [tauriConfigText, cargoManifest, frontendPackage]) {
  assert.match(source, /0\.5\.0/, 'ships a consistent public release version');
}
assert.match(frontendSources[0], /APP_VERSION = '0\.5\.0'/, 'keeps UI-visible version aligned with release metadata');
assert.match(frontendSources[1], /APP_VERSION_LABEL/, 'sidebar renders the shared app version label');
assert.doesNotMatch(frontendSources.join('\n'), /0\.4\.0/, 'removes stale pre-release version strings from visible UI and analytics examples');

assert.equal(tauriConfig.productName, 'Hush', 'keeps the macOS-visible product name');
assert.equal(tauriConfig.identifier, 'com.meetily.ai', 'preserves the stable storage and permission identifier');
assert.equal(tauriConfig.bundle.macOS.minimumSystemVersion, '14.2', 'keeps the bundle floor aligned with the default Core Audio capture path');
assert.match(tauriConfigText, /henryvn27\/hush\/releases\/latest\/download\/latest\.json/, 'uses the fork-owned updater endpoint');
assert.match(cargoManifest, /repository = "https:\/\/github\.com\/henryvn27\/hush"/, 'publishes fork-owned Cargo metadata');
assert.match(releaseWorkflow, /Hush v/, 'names GitHub releases for the public app');
assert.match(releaseWorkflow, /asset-prefix: "hush"/, 'names release assets for the public app');
assert.match(recordingPreferences, /hush-recordings/, 'uses a Hush-owned default recordings folder');
assert.doesNotMatch(recordingPreferences, /meetily-recordings/, 'does not create new recordings under the upstream name');
assert.match(updateManifest, /henryvn27\/hush/, 'generates fork-owned update manifest links');
assert.doesNotMatch(`${tauriConfigText}\n${cargoManifest}\n${releaseWorkflow}\n${updateManifest}`, /Zackriya-Solutions\/meeting-minutes/, 'removes upstream release endpoints from active distribution metadata');

console.log('release identity source checks passed');

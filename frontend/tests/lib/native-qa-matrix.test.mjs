import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { releaseVisualMatrix } from '../e2e/helpers/release-visual-matrix.mjs';

const workspaceSpec = await readFile(
  new URL('../e2e/specs/native/workspace.spec.mjs', import.meta.url),
  'utf8',
);
const browserWorkspaceSpec = await readFile(
  new URL('../e2e/specs/browser/workspace.spec.mjs', import.meta.url),
  'utf8',
);

test('native visual QA isolates the complete release matrix into named tests', () => {
  assert.deepEqual(releaseVisualMatrix, [
    { appearance: 'Light', width: 1280, height: 820 },
    { appearance: 'Dark', width: 1280, height: 820 },
    { appearance: 'Light', width: 1100, height: 720 },
    { appearance: 'Dark', width: 1100, height: 720 },
  ]);
  assert.equal(new Set(releaseVisualMatrix.map(({ appearance, width, height }) => (
    `${appearance}-${width}x${height}`
  ))).size, 4);

  assert.match(workspaceSpec, /for \(const visualCase of releaseVisualMatrix\)/);
  assert.match(
    workspaceSpec,
    /it\(`captures every real route and settings section in \$\{appearance\} at \$\{width\}x\$\{height\}`/,
  );
  assert.doesNotMatch(workspaceSpec, /for \(const \[width, height\] of releaseSizes\)/);
});

test('browser visual QA isolates each release surface into a named test', () => {
  assert.match(browserWorkspaceSpec, /for \(const visualCase of releaseVisualMatrix\)/);
  assert.match(browserWorkspaceSpec, /for \(const route of routes\)/);
  assert.match(browserWorkspaceSpec, /for \(const section of settingsSections\)/);
  assert.match(
    browserWorkspaceSpec,
    /it\(`persists \$\{appearance\} and compares \$\{route\.nav\} at \$\{width\}x\$\{height\}`/,
  );
  assert.match(
    browserWorkspaceSpec,
    /it\(`persists \$\{appearance\} and compares Settings \$\{section\} at \$\{width\}x\$\{height\}`/,
  );
  assert.match(
    browserWorkspaceSpec,
    /it\(`persists \$\{appearance\} and compares missing-meeting recovery at \$\{width\}x\$\{height\}`/,
  );
  assert.match(
    browserWorkspaceSpec,
    /it\(`persists \$\{appearance\} and compares workspace dialogs at \$\{width\}x\$\{height\}`/,
  );
  assert.doesNotMatch(browserWorkspaceSpec, /compares every route/);
  assert.doesNotMatch(browserWorkspaceSpec, /for \(const \[width, height\] of releaseSizes\)/);

  for (const sourceMarker of [
    'checkScreen(`${slug(route.visual ?? route.nav)}-${slug(appearance)}-${width}x${height}`',
    'checkScreen(`settings-${slug(section)}-${slug(appearance)}-${width}x${height}`',
    'checkScreen(`missing-meeting-${slug(appearance)}-${width}x${height}`',
    'compareWorkspaceDialogs(appearance, width, height)',
    'checkScreen(`import-audio-${slug(appearance)}-${width}x${height}`',
    'checkScreen(`about-${slug(appearance)}-${width}x${height}`',
  ]) {
    assert.ok(browserWorkspaceSpec.includes(sourceMarker), `missing browser matrix surface: ${sourceMarker}`);
  }
});

test('each native matrix unit retains every screenshot and accessibility surface', () => {
  for (const sourceMarker of [
    'for (const route of routes)',
    'for (const section of settingsSections)',
    "window.location.assign('/meeting-details')",
    'captureWorkspaceDialogs(appearance, width, height)',
    'expectWcag22Aa(browser, \'[role="dialog"]\')',
    'import-audio-${slug(appearance)}-${width}x${height}.png',
    'about-${slug(appearance)}-${width}x${height}.png',
  ]) {
    assert.ok(workspaceSpec.includes(sourceMarker), `missing native matrix surface: ${sourceMarker}`);
  }
});

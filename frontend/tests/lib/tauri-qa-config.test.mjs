import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('QA launcher isolates the native dev instance without changing the release identity', async () => {
  const [packageJson, qaConfig, routesQaConfig, minimumQaConfig, onboardingQaConfig, wdioQaConfig, layoutSource, releaseConfig] = await Promise.all([
    readFile(new URL('package.json', root), 'utf8'),
    readFile(new URL('src-tauri/tauri.qa.conf.json', root), 'utf8'),
    readFile(new URL('src-tauri/tauri.qa.routes.conf.json', root), 'utf8'),
    readFile(new URL('src-tauri/tauri.qa.minimum.conf.json', root), 'utf8'),
    readFile(new URL('src-tauri/tauri.qa.onboarding.conf.json', root), 'utf8'),
    readFile(new URL('src-tauri/tauri.qa.wdio.conf.json', root), 'utf8'),
    readFile(new URL('src/app/layout.tsx', root), 'utf8'),
    readFile(new URL('src-tauri/tauri.conf.json', root), 'utf8'),
  ]);
  const scripts = JSON.parse(packageJson).scripts;
  const qa = JSON.parse(qaConfig);
  const routesQa = JSON.parse(routesQaConfig);
  const minimumQa = JSON.parse(minimumQaConfig);
  const onboardingQa = JSON.parse(onboardingQaConfig);
  const wdioQa = JSON.parse(wdioQaConfig);
  const release = JSON.parse(releaseConfig);

  assert.equal(scripts['tauri:dev:qa'], 'NEXT_PUBLIC_MEETILY_NATIVE_QA_MODE=routes tauri dev --config src-tauri/tauri.qa.routes.conf.json -- --features metal');
  assert.equal(scripts['tauri:build:qa'], 'NEXT_PUBLIC_MEETILY_NATIVE_QA_MODE=routes tauri build --debug --bundles app --config src-tauri/tauri.qa.routes.conf.json --features metal');
  assert.equal(scripts['tauri:dev:qa:minimum'], 'NEXT_PUBLIC_MEETILY_NATIVE_QA_MODE=routes tauri dev --config src-tauri/tauri.qa.minimum.conf.json -- --features metal');
  assert.equal(scripts['tauri:build:qa:minimum'], 'NEXT_PUBLIC_MEETILY_NATIVE_QA_MODE=routes tauri build --debug --bundles app --config src-tauri/tauri.qa.minimum.conf.json --features metal');
  assert.equal(scripts['tauri:dev:qa:onboarding'], 'NEXT_PUBLIC_MEETILY_NATIVE_QA_MODE=onboarding tauri dev --config src-tauri/tauri.qa.onboarding.conf.json -- --features metal');
  assert.equal(scripts['tauri:build:qa:onboarding'], 'NEXT_PUBLIC_MEETILY_NATIVE_QA_MODE=onboarding tauri build --debug --bundles app --config src-tauri/tauri.qa.onboarding.conf.json --features metal');
  assert.equal(qa.identifier, 'com.meetily.improved.qa');
  assert.equal(qa.productName, 'Hush QA');
  assert.equal(qa.app.windows[0].title, 'Hush QA');
  assert.equal(routesQa.identifier, 'com.meetily.improved.qa.routes');
  assert.equal(routesQa.productName, 'Hush QA Routes');
  assert.equal(routesQa.app.windows[0].title, 'Hush QA Routes');
  assert.equal(minimumQa.identifier, 'com.meetily.improved.qa.minimum');
  assert.equal(minimumQa.productName, 'Hush QA Minimum');
  assert.equal(minimumQa.app.windows[0].title, 'Hush QA Minimum');
  assert.equal(onboardingQa.identifier, 'com.meetily.improved.qa.onboarding');
  assert.equal(onboardingQa.productName, 'Hush QA Onboarding');
  assert.equal(onboardingQa.app.windows[0].title, 'Hush QA Onboarding');
  assert.equal(wdioQa.identifier, 'com.meetily.improved.qa.wdio');
  assert.equal(wdioQa.app.windows[0].title, 'Hush QA WebDriver');
  assert.equal(wdioQa.app.security.capabilities[0], 'main');
  assert.deepEqual(wdioQa.app.security.capabilities[1], {
    identifier: 'wdio',
    description: 'Test-only WebDriver capability for the isolated QA binary',
    windows: ['main'],
    permissions: [
      'wdio:allow-execute',
      'wdio:allow-get-window-states',
      'wdio-webdriver:default',
    ],
  });
  assert.match(layoutSource, /NEXT_PUBLIC_MEETILY_WDIO === 'true' \? 'Hush QA WebDriver' : 'Hush'/);
  for (const config of [qa, routesQa, minimumQa, onboardingQa, wdioQa]) {
    assert.equal(config.bundle.createUpdaterArtifacts, false);
  }
  assert.equal(release.bundle.createUpdaterArtifacts, true);
  assert.equal(release.bundle.macOS.minimumSystemVersion, '14.2');
  for (const config of [qa, routesQa, onboardingQa]) {
    assert.equal(config.app.windows[0].width, 1280);
    assert.equal(config.app.windows[0].height, 820);
    assert.equal(config.app.windows[0].minWidth, 1100);
    assert.equal(config.app.windows[0].minHeight, 720);
  }
  assert.equal(release.app.windows[0].width, 1280);
  assert.equal(release.app.windows[0].height, 820);
  assert.equal(release.app.windows[0].minWidth, 720);
  assert.equal(release.app.windows[0].minHeight, 620);
  assert.equal(minimumQa.app.windows[0].width, 1100);
  assert.equal(minimumQa.app.windows[0].height, 720);
  assert.equal(minimumQa.app.windows[0].minWidth, 1100);
  assert.equal(minimumQa.app.windows[0].minHeight, 720);
  assert.equal(release.identifier, 'com.meetily.ai');
});

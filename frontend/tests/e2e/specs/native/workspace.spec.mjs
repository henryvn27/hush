import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { $, browser, expect } from '@wdio/globals';
import { expectWcag22Aa } from '../../helpers/accessibility.mjs';
import { releaseVisualMatrix } from '../../helpers/release-visual-matrix.mjs';
import { expectPageHeading, openSidebarRoute, routes, setAppearance, waitForThemeMotionToSettle } from '../../helpers/routes.mjs';

const artifactDir = resolve(process.cwd(), 'tests/e2e/artifacts/native');
const settingsSections = ['General', 'Recordings', 'Transcription', 'Summary', 'Beta'];
const settingsHeadings = {
  General: 'General settings',
  Recordings: 'Recording settings',
  Transcription: 'Transcription settings',
  Summary: 'Summary settings',
  Beta: 'Beta settings',
};

function slug(value) {
  return value.toLowerCase().replaceAll(' ', '-');
}

async function clearTransientFocus() {
  await browser.execute(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
}

async function closeDialog() {
  const clicked = await browser.execute(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
      .filter((dialog) => dialog.getClientRects().length > 0);
    const dialog = dialogs[dialogs.length - 1];
    const close = dialog?.querySelector('button[aria-label="Close"]');
    if (!(close instanceof HTMLElement)) return false;
    close.click();
    return true;
  });
  expect(clicked).toBe(true);
  await browser.waitUntil(
    () => browser.execute(() => !document.querySelector('[role="dialog"][data-state="open"]')),
  );
}

async function resetWorkspace() {
  await browser.execute(() => window.location.reload());
  await expectPageHeading('Good to have you back.');
  await waitForThemeMotionToSettle();
}

async function captureWorkspaceDialogs(appearance, width, height) {
  await browser.execute(() => window.location.assign('/'));
  await expectPageHeading('Good to have you back.');

  await $('button[aria-label="Import audio"]').click();
  await expectPageHeading('Import a recording', 2);
  await expectWcag22Aa(browser, '[role="dialog"]');
  await browser.saveScreenshot(resolve(artifactDir, `import-audio-${slug(appearance)}-${width}x${height}.png`));
  await closeDialog();
  await resetWorkspace();

  await $('button[aria-label="About"]').click();
  await expectPageHeading('About Hush', 2);
  await expectWcag22Aa(browser, '[role="dialog"]');
  await browser.saveScreenshot(resolve(artifactDir, `about-${slug(appearance)}-${width}x${height}.png`));
  await closeDialog();
  await resetWorkspace();
}

async function captureVisualMatrixCase({ appearance, width, height }) {
  await browser.setWindowSize(width, height);
  await setAppearance(appearance);

  for (const route of routes) {
    await openSidebarRoute(route.nav, route.heading, route.path);
    await clearTransientFocus();
    await browser.saveScreenshot(resolve(artifactDir, `${slug(route.nav)}-${slug(appearance)}-${width}x${height}.png`));
  }

  await $('button[aria-label="Settings"]').click();
  await expectPageHeading('Settings');
  for (const section of settingsSections) {
    const tab = await $(`[role="tab"][aria-label="${section}"]`);
    await tab.click();
    await browser.waitUntil(
      () => browser.execute((expectedHeading) => {
        const activePanel = document.querySelector('[role="tabpanel"][data-state="active"]');
        return activePanel?.querySelector('h2')?.textContent?.trim() === expectedHeading;
      }, settingsHeadings[section]),
      { timeout: 15_000, timeoutMsg: `Settings did not activate the ${section} panel` },
    );
    await clearTransientFocus();
    await browser.saveScreenshot(resolve(artifactDir, `settings-${slug(section)}-${slug(appearance)}-${width}x${height}.png`));
  }

  await browser.execute(() => window.location.assign('/meeting-details'));
  await expectPageHeading('Meeting could not be opened', 2);
  await clearTransientFocus();
  await browser.saveScreenshot(resolve(artifactDir, `missing-meeting-${slug(appearance)}-${width}x${height}.png`));

  await captureWorkspaceDialogs(appearance, width, height);
}

describe('Meetily native macOS workspace', () => {
  before(async () => {
    await mkdir(artifactDir, { recursive: true });
  });

  beforeEach(async () => {
    await browser.execute(() => window.location.assign('/'));
    await expectPageHeading('Good to have you back.');
    await browser.waitUntil(
      async () => {
        const theme = await browser.execute(() => document.documentElement.dataset.theme);
        return theme === 'light' || theme === 'dark';
      },
      {
        timeout: 20_000,
        timeoutMsg: 'Theme hydration did not resolve before native assertions',
      },
    );
    await waitForThemeMotionToSettle();
  });

  it('uses the opt-in native bridge and walks the real empty local workspace', async () => {
    const location = await browser.tauri.execute(() => window.location.href);
    const resolvedTheme = await browser.execute(() => document.documentElement.dataset.theme);
    expect(location).toContain('tauri');
    expect(['light', 'dark']).toContain(resolvedTheme);
  await expectPageHeading('Good to have you back.');
    await expectWcag22Aa(browser);

    for (const route of routes.slice(1)) {
      await openSidebarRoute(route.nav, route.heading, route.path);
    }

    await browser.keys(['Meta', ',']);
    await expectPageHeading('Settings');
    await expectWcag22Aa(browser);

    await browser.execute(() => window.location.assign('/meeting-details'));
    await expectPageHeading('Meeting could not be opened', 2);
  });

  for (const visualCase of releaseVisualMatrix) {
    const { appearance, width, height } = visualCase;
    it(`captures every real route and settings section in ${appearance} at ${width}x${height}`, async () => {
      await captureVisualMatrixCase(visualCase);
    });
  }
});

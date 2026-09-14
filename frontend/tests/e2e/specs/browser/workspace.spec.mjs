import { $, browser, expect } from '@wdio/globals';
import { expectWcag22Aa } from '../../helpers/accessibility.mjs';
import { installEmptyBackendMocks } from '../../helpers/browser-empty-backend.mjs';
import { releaseVisualMatrix } from '../../helpers/release-visual-matrix.mjs';
import { expectPageHeading, openSidebarRoute, routes, setAppearance } from '../../helpers/routes.mjs';

const appearances = ['Light', 'Dark'];
const settingsSections = ['General', 'Recordings', 'Transcription', 'Summary', 'Beta'];
const settingsHeadings = {
  General: 'General settings',
  Recordings: 'Recording settings',
  Transcription: 'Transcription settings',
  Summary: 'Summary settings',
  Beta: 'Beta settings',
};
const screenshotOptions = {
  ignoreAntialiasing: true,
  misMatchPercentage: 0.15,
};

function slug(value) {
  return value.toLowerCase().replaceAll(' ', '-');
}

async function expectAccessible(context, selector) {
  try {
    await expectWcag22Aa(browser, selector);
  } catch (error) {
    throw new Error(`${context}: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  await browser.url('http://127.0.0.1:3120/');
  await expectPageHeading('Activity');
}

async function compareWorkspaceDialogs(appearance, width, height) {
  await browser.url('http://127.0.0.1:3120/');
  await expectPageHeading('Activity');

  await $('button[aria-label="Import audio"]').click();
  await expectPageHeading('Import a recording', 2);
  await expectAccessible(`${appearance} / Import audio dialog`, '[role="dialog"]');
  expect(await browser.checkScreen(`import-audio-${slug(appearance)}-${width}x${height}`, screenshotOptions)).toBeLessThanOrEqual(0.15);
  await closeDialog();
  await resetWorkspace();

  await $('button[aria-label="About"]').click();
  await expectPageHeading('About Hush', 2);
  await expectAccessible(`${appearance} / About dialog`, '[role="dialog"]');
  expect(await browser.checkScreen(`about-${slug(appearance)}-${width}x${height}`, screenshotOptions)).toBeLessThanOrEqual(0.15);
  await closeDialog();
  await resetWorkspace();
}

async function prepareVisualCase({ appearance, width, height }) {
  await browser.setWindowSize(width, height);
  await setAppearance(appearance);
}

describe('Meetily browser-mode workspace', () => {
  before(async () => {
    await browser.url('http://127.0.0.1:3120/');
    await installEmptyBackendMocks(browser);
    try {
      await $('button[aria-label="Settings"]').waitForDisplayed({ timeout: 60_000 });
    } catch (error) {
      await browser.saveScreenshot('/tmp/meetily-browser-qa-bootstrap-failure.png');
      const diagnostic = await browser.execute(() => ({
        url: window.location.href,
        readyState: document.readyState,
        title: document.title,
        text: document.body?.innerText.slice(0, 2_000) ?? '',
        html: document.body?.innerHTML.slice(0, 2_000) ?? '',
      }));
      throw new Error(`Empty-workspace bootstrap did not render: ${JSON.stringify(diagnostic)}. ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  for (const appearance of appearances) {
    for (const route of routes) {
      it(`passes WCAG 2.2 AA on ${appearance} ${route.nav}`, async () => {
        await setAppearance(appearance);
        await openSidebarRoute(route.nav, route.heading, route.path);
        await expectAccessible(`${appearance} / ${route.nav}`);
      });
    }

    for (const section of settingsSections) {
      it(`passes WCAG 2.2 AA on ${appearance} Settings ${section}`, async () => {
        await setAppearance(appearance);
        const selector = `[role="tab"][aria-label="${section}"]`;
        await $(selector).click();
        try {
          await browser.waitUntil(
            () => browser.execute((expectedHeading) => {
              const activePanel = document.querySelector('[role="tabpanel"][data-state="active"]');
              return activePanel?.querySelector('h2')?.textContent?.trim() === expectedHeading;
            }, settingsHeadings[section]),
            {
              timeout: 15_000,
              timeoutMsg: `Settings did not activate the ${section} panel`,
            },
          );
        } catch (error) {
          await browser.saveScreenshot(`/tmp/meetily-browser-qa-settings-${section.toLowerCase()}-failure.png`);
          const diagnostic = await browser.execute(() => ({
            activeElement: document.activeElement?.outerHTML,
            body: document.body?.innerText.slice(0, 2_000),
            tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((tab) => ({
              label: tab.getAttribute('aria-label'),
              selected: tab.getAttribute('aria-selected'),
              state: tab.getAttribute('data-state'),
            })),
            panels: Array.from(document.querySelectorAll('[role="tabpanel"]')).map((panel) => ({
              state: panel.getAttribute('data-state'),
              heading: panel.querySelector('h2')?.textContent?.trim(),
            })),
          }));
          throw new Error(`${error instanceof Error ? error.message : String(error)}: ${JSON.stringify(diagnostic)}`);
        }
        await expectAccessible(`${appearance} / Settings / ${section}`);
      });
    }

  }

  for (const visualCase of releaseVisualMatrix) {
    const { appearance, width, height } = visualCase;

    for (const route of routes) {
      it(`persists ${appearance} and compares ${route.nav} at ${width}x${height}`, async () => {
        await prepareVisualCase(visualCase);
        await openSidebarRoute(route.nav, route.heading, route.path);
        expect(await browser.checkScreen(`${slug(route.nav)}-${slug(appearance)}-${width}x${height}`, screenshotOptions)).toBeLessThanOrEqual(0.15);
      });
    }

    for (const section of settingsSections) {
      it(`persists ${appearance} and compares Settings ${section} at ${width}x${height}`, async () => {
        await prepareVisualCase(visualCase);
        await $('button[aria-label="Settings"]').click();
        await expectPageHeading('Settings');
        const tab = await $(`[role="tab"][aria-label="${section}"]`);
        await tab.click();
        await browser.waitUntil(
          () => browser.execute((expectedHeading) => {
            const activePanel = document.querySelector('[role="tabpanel"][data-state="active"]');
            return activePanel?.querySelector('h2')?.textContent?.trim() === expectedHeading;
          }, settingsHeadings[section]),
        );
        expect(await browser.checkScreen(`settings-${slug(section)}-${slug(appearance)}-${width}x${height}`, screenshotOptions)).toBeLessThanOrEqual(0.15);
      });
    }

    it(`persists ${appearance} and compares missing-meeting recovery at ${width}x${height}`, async () => {
      await prepareVisualCase(visualCase);
      await browser.url('http://127.0.0.1:3120/meeting-details');
      await expectPageHeading('Meeting could not be opened', 2);
      expect(await browser.checkScreen(`missing-meeting-${slug(appearance)}-${width}x${height}`, screenshotOptions)).toBeLessThanOrEqual(0.15);
    });

    it(`persists ${appearance} and compares workspace dialogs at ${width}x${height}`, async () => {
      await prepareVisualCase(visualCase);
      await compareWorkspaceDialogs(appearance, width, height);
    });
  }

  it('keeps keyboard focus visible, reachable, and unobscured with reduced motion', async () => {
    await browser.url('http://127.0.0.1:3120/');
    await $('#main-content').waitForDisplayed();
    await browser.execute(() => {
      document.body.tabIndex = -1;
      document.body.focus();
      document.body.removeAttribute('tabindex');
    });
    await browser.keys(['Tab']);
    const skipLinkFocused = await browser.execute(() => document.activeElement?.matches('a.skip-link') ?? false);
    expect(skipLinkFocused).toBe(true);
    await browser.keys(['Enter']);
    const mainFocused = await browser.execute(() => document.activeElement?.id === 'main-content');
    expect(mainFocused).toBe(true);

    await browser.keys(['Tab']);
    const focusBounds = await browser.execute(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const rect = active.getBoundingClientRect();
      return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    expect(focusBounds).not.toBeNull();
    expect(focusBounds.top).toBeGreaterThanOrEqual(0);
    expect(focusBounds.left).toBeGreaterThanOrEqual(0);
    expect(focusBounds.right).toBeLessThanOrEqual(await browser.execute(() => window.innerWidth));
    expect(focusBounds.bottom).toBeLessThanOrEqual(await browser.execute(() => window.innerHeight));
    expect(focusBounds.width).toBeGreaterThanOrEqual(24);
    expect(focusBounds.height).toBeGreaterThanOrEqual(24);

    expect(await browser.execute(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const timing = await browser.execute(() => {
      const target = document.querySelector('button');
      const style = target ? getComputedStyle(target) : null;
      return style ? { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration } : null;
    });
    expect(timing).not.toBeNull();
    expect(Number.parseFloat(timing.transitionDuration)).toBeLessThanOrEqual(0.00001);
  });

  for (const appearance of appearances) {
    it(`passes WCAG 2.2 AA on ${appearance} missing-meeting recovery`, async () => {
      await browser.execute((preference) => {
        window.localStorage.setItem('meetily-theme-preference', preference.toLowerCase());
      }, appearance);
      await browser.url('http://127.0.0.1:3120/meeting-details');
      await browser.waitUntil(
        () => browser.execute((theme) => document.documentElement.dataset.theme === theme, appearance.toLowerCase()),
      );
      await expectPageHeading('Meeting could not be opened', 2);
      await expectAccessible(`${appearance} / missing-meeting recovery`);
    });
  }
});

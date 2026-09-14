import { $, browser } from '@wdio/globals';

export const routes = [
  { nav: 'Home', heading: 'Good to have you back.', path: '/' },
  { nav: 'New dictation', heading: 'New meeting', path: '/new-meeting', visual: 'New meeting' },
  { nav: 'History', heading: 'Saved meetings', path: '/meetings', visual: 'Saved meetings' },
  { nav: 'Ask your archive', heading: 'Ask meetings', path: '/chat', visual: 'Ask meetings' },
];

export async function expectPageHeading(heading, level = 1) {
  await browser.waitUntil(
    () => browser.execute(({ heading, level }) => {
      return Array.from(document.querySelectorAll(`h${level}`)).some((element) => (
        element.textContent?.trim() === heading && element.getClientRects().length > 0
      ));
    }, { heading, level }),
    { timeout: 60_000, timeoutMsg: `Expected visible h${level} heading "${heading}".` },
  );
}

export async function openSidebarRoute(nav, heading, path) {
  const button = await $(`button[aria-label="${nav}"]`);
  await button.waitForClickable();
  await button.click();
  await browser.waitUntil(
    async () => await browser.execute(() => window.location.pathname) === path,
    { timeout: 30_000, timeoutMsg: `Expected route ${path} after selecting ${nav}.` },
  );
  await expectPageHeading(heading);
}

export async function waitForThemeMotionToSettle() {
  const readThemeColors = () => browser.execute(() => {
      const label = document.querySelector('button[aria-label="New dictation"] span');
      if (!(label instanceof HTMLElement)) return null;
      const probe = document.createElement('span');
      probe.style.color = 'hsl(var(--sidebar-muted))';
      const host = label.closest(".hush-sidebar") ?? document.body;
      host.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return {
        actual: getComputedStyle(label).color,
        expected,
        rootClass: document.documentElement.className,
        theme: document.documentElement.dataset.theme ?? null,
        preference: window.localStorage.getItem('meetily-theme-preference'),
      };
  });
  try {
    await browser.waitUntil(
      async () => {
        const colors = await readThemeColors();
        return colors !== null && colors.actual === colors.expected;
      },
      { timeout: 5_000 },
    );
  } catch (error) {
    const colors = await readThemeColors();
    throw new Error(`Theme transitions did not settle before visual assertions: ${JSON.stringify(colors)}`, { cause: error });
  }
}

export async function setAppearance(preference) {
  const settings = await $('button[aria-label="Settings"]');
  await settings.waitForClickable({ timeout: 60_000 });
  await settings.click();
  await browser.waitUntil(
    async () => await browser.execute(() => window.location.pathname) === '/settings',
    { timeout: 30_000, timeoutMsg: 'Expected /settings after selecting Settings.' },
  );
  await expectPageHeading('Settings');

  const generalTab = await $('[role="tab"][aria-label="General"]');
  await generalTab.click();
  await browser.waitUntil(async () => await generalTab.getAttribute('data-state') === 'active');

  const radio = await $(`[role="radio"][aria-label="${preference}"]`);
  await radio.click();
  try {
    await browser.waitUntil(async () => {
      const theme = await browser.execute(() => document.documentElement.dataset.theme);
      return preference === 'System' ? theme === 'light' || theme === 'dark' : theme === preference.toLowerCase();
    });
  } catch (error) {
    const diagnostic = await browser.execute(() => ({
      theme: document.documentElement.dataset.theme ?? null,
      rootClass: document.documentElement.className,
      storedPreference: window.localStorage.getItem('meetily-theme-preference'),
      selectedPreference: document.querySelector('[role="radio"][aria-checked="true"]')?.getAttribute('aria-label') ?? null,
    }));
    throw new Error(`Theme preference did not apply: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  await browser.waitUntil(
    async () => browser.execute(() => {
      const button = document.querySelector('button[aria-label="Open recorder"]');
      if (!(button instanceof HTMLElement)) return false;

      const parseRgb = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (value) => {
        const [red, green, blue] = parseRgb(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
      };
      const style = getComputedStyle(button);
      const lighter = Math.max(luminance(style.color), luminance(style.backgroundColor));
      const darker = Math.min(luminance(style.color), luminance(style.backgroundColor));
      return (lighter + 0.05) / (darker + 0.05) >= 4.5;
    }),
    { timeout: 5_000, timeoutMsg: `Recorder contrast did not settle after selecting ${preference}.` },
  );
  await waitForThemeMotionToSettle();
}

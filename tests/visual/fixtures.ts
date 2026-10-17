// Shared Playwright fixtures: every test blocks requests to anything but localhost,
// plus helpers to open the harness and save review pictures to artifacts/step-N/.
import { test as base, expect, type Page } from '@playwright/test';

const LOCAL = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d+)?\//;

export const test = base.extend<{ blockNetwork: void }>({
  blockNetwork: [async ({ context }, use) => {
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (LOCAL.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      return route.abort('blockedbyclient');
    });
    await use();
  }, { auto: true }],
});

export { expect };

export async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__archi?.ready === true, undefined, { timeout: 30_000 });
  const err = await page.evaluate(() => window.__archi.error);
  expect(err, 'harness reported an error').toBeUndefined();
}

export async function openHarness(page: Page, query: string): Promise<void> {
  await page.goto(`/harness.html?test=1&${query}`);
  await waitReady(page);
}

/** toHaveScreenshot + a copy in artifacts/step-N/<name>.png for review. */
export async function snap(page: Page, step: number, name: string): Promise<void> {
  await page.screenshot({ path: `artifacts/step-${step}/${name}.png` });
  await expect(page).toHaveScreenshot(`${name}.png`);
}

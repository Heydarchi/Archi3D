// Step 8 recorded the first zoom rule ('size'); the default rule is in zoom.spec.ts.
import { test, openHarness, snap, expect } from './fixtures';

type St = { containers: Record<string, string> };
const containers = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window.__archi.state!() as St).containers);

test('lod nested-deep far', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=nested-deep&cam=focus&focus=Platform&k=3.4&zoom=size');
  expect((await containers(page)).Platform).toBe('closed');
  await snap(page, 8, 'lod-nested-deep-far');
});

test('lod nested-deep mid', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=nested-deep&cam=focus&focus=Platform&k=2.2&zoom=size');
  const c = await containers(page);
  expect([c.Platform, c.Payments, c.Messaging]).toEqual(['open', 'closed', 'closed']);
  await snap(page, 8, 'lod-nested-deep-mid');
});

test('lod nested-deep near', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=nested-deep&cam=focus&focus=Billing&k=1.2&zoom=size');
  expect((await containers(page)).Billing).toBe('open');
  await snap(page, 8, 'lod-nested-deep-near');
});

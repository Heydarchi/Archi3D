// The default zoom rule ('readable'): a container opens when what is inside it is readable.
import { test, openHarness, snap, expect } from './fixtures';

type St = { containers: Record<string, string> };
const containers = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window.__archi.state!() as St).containers);

test('zoom readable: far, Platform closed', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=nested-deep&cam=focus&focus=Platform&k=6');
  expect((await containers(page)).Platform).toBe('closed');
  await snap(page, 'zoom', 'readable-far');
});

test('zoom readable: mid, Platform open, Payments (deeply nested) still closed', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=nested-deep&cam=focus&focus=Platform&k=3');
  const c = await containers(page);
  expect([c.Platform, c.Payments]).toEqual(['open', 'closed']);
  await snap(page, 'zoom', 'readable-mid');
});

test('zoom readable: near, everything open', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=nested-deep&cam=focus&focus=Platform&k=2');
  const c = await containers(page);
  expect([c.Platform, c.Payments, c.Billing, c.Risk, c.Messaging]).toEqual(['open', 'open', 'open', 'open', 'open']);
  await snap(page, 'zoom', 'readable-near');
});

test('zoom readable: more detail opens more at the same distance', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=nested-deep&cam=focus&focus=Platform&k=3&detail=2');
  const c = await containers(page);
  expect([c.Platform, c.Payments]).toEqual(['open', 'open']);
});

test('zoom readable: northwind overview opens what you can read', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=northwind&cam=far');
  expect(Object.values(await containers(page)).every((v) => v === 'open')).toBe(true);
  await snap(page, 'zoom', 'readable-northwind-far');
});

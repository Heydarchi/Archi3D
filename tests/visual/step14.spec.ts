import { test, openHarness, snap, expect } from './fixtures';

test('gen-1000 overview: bundled', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=gen-1000&cam=far&bundle=on');
  await snap(page, 14, 'overview-bundled');
});

test('gen-1000 overview: unbundled', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=gen-1000&cam=far');
  await snap(page, 14, 'overview-unbundled');
});

test('selected system: its links unbundled, the rest bundled', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=gen-1000&cam=far&bundle=on&select=Sys3');
  expect(await page.evaluate(() => (window.__archi.state!() as { selected: string }).selected)).toBe('Sys3');
  await snap(page, 14, 'overview-bundled-select-sys3');
});

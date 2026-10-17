import { test, openHarness, snap, expect } from './fixtures';

test('labels northwind near', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=northwind&cam=near');
  expect(await page.evaluate(() => (window.__archi.state!() as { labelMode: string }).labelMode)).toBe('troika');
  await snap(page, 7, 'labels-northwind-near');
});

test('labels northwind far', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=northwind&cam=far');
  await snap(page, 7, 'labels-northwind-far');
});

test('missing font falls back to CSS2D labels', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await openHarness(page, 'view=scene&fixture=northwind&cam=near&font=missing.ttf');
  expect(await page.evaluate(() => (window.__archi.state!() as { labelMode: string }).labelMode)).toBe('css2d');
  await expect(page.locator('.archi-label-component', { hasText: 'OrderAPI' })).toBeVisible();
  expect(warnings.filter((w) => w.includes('HTML labels'))).toHaveLength(1);
  await snap(page, 7, 'fallback-labels');
});

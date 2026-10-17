import { test, openHarness, snap, expect } from './fixtures';

test('parse view: northwind', async ({ page }) => {
  await openHarness(page, 'view=parse&fixture=northwind');
  await expect(page.locator('.err')).toHaveCount(0);
  await snap(page, 1, 'parse-northwind');
});

test('parse view: bad line is underlined with its message', async ({ page }) => {
  await openHarness(page, 'view=parse&fixture=errors/bad-line');
  const row = page.locator('.row[data-line="2"]');
  await expect(row.locator('.err')).toHaveCount(1);
  await expect(row.locator('.msg')).toContainText('E001');
  await snap(page, 1, 'parse-bad-line');
});

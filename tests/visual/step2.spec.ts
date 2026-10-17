import { test, openHarness, snap, expect } from './fixtures';

test('model view: nested-deep', async ({ page }) => {
  await openHarness(page, 'view=model&fixture=nested-deep');
  await snap(page, 2, 'model-nested-deep');
});

test('model view: typed-ports shows W201', async ({ page }) => {
  await openHarness(page, 'view=model&fixture=typed-ports');
  await expect(page.locator('.diags')).toContainText('W201');
  await snap(page, 2, 'model-typed-ports');
});

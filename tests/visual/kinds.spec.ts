import { test, openHarness, snap, expect, waitReady } from './fixtures';

// Every element keyword and every link kind (fixtures/kinds.arch3d).
for (const cam of ['iso', 'near'] as const) {
  test(`kinds: all shapes and link kinds (${cam})`, async ({ page }) => {
    await openHarness(page, `view=scene&fixture=kinds&cam=${cam}&lod=off`);
    await snap(page, 'kinds', `kinds-${cam}`);
  });
}

test('kinds: dark theme', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=kinds&cam=iso&lod=off&theme=dark');
  await snap(page, 'kinds', 'kinds-dark');
});

test('kinds: 2D view shows titles and link styles', async ({ page }) => {
  await openHarness(page, 'view=svg2d&fixture=kinds');
  await expect(page.locator('[data-kind="session"]')).toHaveAttribute('marker-start', 'url(#arrow)');
  await expect(page.locator('[data-kind="shared"]')).not.toHaveAttribute('marker-end', /.*/);
  await expect(page.locator('svg text', { hasText: 'Camera HAL' })).toHaveCount(1);
  await snap(page, 'kinds', 'kinds-svg2d');
});

test('app: hide the editor to give the 3D view the whole window', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await waitReady(page);
  const width = () => page.locator('#view canvas').evaluate((c) => c.getBoundingClientRect().width);
  const full = await page.evaluate(() => window.innerWidth);
  expect(await width()).toBeLessThan(full - 250);
  await page.locator('#toggle-editor').click();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#toggle-editor')).toHaveText('Show editor');
  await expect.poll(width).toBe(full);
  await page.waitForFunction(() => window.__archi.ready === true);
  await snap(page, 'kinds', 'app-editor-hidden');
  await page.keyboard.press('e');
  await expect(page.locator('#editor')).toBeVisible();
  await page.goto('/index.html?test=1&editor=0');
  await waitReady(page);
  await expect(page.locator('#editor')).toBeHidden();
});

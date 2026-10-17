import { test, openHarness, snap, expect } from './fixtures';

for (const f of ['container-links', 'nested-deep', 'northwind', 'tiny', 'typed-ports']) {
  test(`svg2d: ${f}`, async ({ page }) => {
    await openHarness(page, `view=svg2d&fixture=${f}`);
    expect(await page.locator('polyline[data-edge]').count()).toBeGreaterThan(0);
    await snap(page, 3, `svg2d-${f}`);
  });
}

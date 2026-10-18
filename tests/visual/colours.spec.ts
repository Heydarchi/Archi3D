// Colours: own colours, style lines, dark theme, "colour by" with a legend, and the selection outline.
import { test, openHarness, snap, expect } from './fixtures';

test('colours: light theme', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=colours&cam=iso&lod=off');
  await snap(page, 'colours', 'colours-light');
});

test('colours: dark theme uses the dark side of each colour', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=colours&cam=iso&lod=off&theme=dark');
  await snap(page, 'colours', 'colours-dark');
});

test('colours: colour by layer, with a legend', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=layers&cam=far&lod=off&colorby=layer');
  await expect(page.locator('.archi-legend span')).toHaveText(['Apps', 'Services', 'Kernel']);
  await snap(page, 'colours', 'colours-by-layer');
});

test('colours: a selection is lighter with an outline, not orange', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=colours&cam=iso&lod=off&select=CameraService');
  await snap(page, 'colours', 'colours-select');
});

test('app: the Colour button cycles and shows the legend', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await page.waitForFunction(() => window.__archi?.ready === true);
  const b = page.locator('#color-by');
  await expect(b).toHaveText('Colour: kind');
  await expect(page.locator('.archi-legend')).toHaveCount(0);
  await b.click();
  await expect(b).toHaveText('Colour: layer');
  await expect(page.locator('.archi-legend span')).toHaveText(['Northwind']); // no layers: top containers
  await b.click(); await b.click(); await b.click();
  await expect(b).toHaveText('Colour: kind');
  await expect(page.locator('.archi-legend')).toHaveCount(0);
});

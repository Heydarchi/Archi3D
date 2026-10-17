import { test, openHarness, snap } from './fixtures';

for (const cam of ['far', 'iso', 'near']) {
  test(`scene northwind ${cam}`, async ({ page }) => {
    await openHarness(page, `view=scene&fixture=northwind&cam=${cam}&lod=off`);
    await snap(page, 5, `scene-northwind-${cam}`);
  });
}

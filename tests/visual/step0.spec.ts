import { test, openHarness, snap, expect } from './fixtures';

test('cube is lit and shaded', async ({ page }) => {
  await openHarness(page, 'view=cube');
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2');
    return c ? (c.getParameter(c.RENDERER) as string) : null;
  });
  expect(gl, 'WebGL2 available').not.toBeNull();
  await snap(page, 0, 'cube');
});

test('external requests are blocked', async ({ page }) => {
  await page.goto('/harness.html?test=1');
  const ok = await page.evaluate(() => fetch('https://example.com/').then(() => true, () => false));
  expect(ok).toBe(false);
});

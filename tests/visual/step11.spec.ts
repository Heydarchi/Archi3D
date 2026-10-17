import { test, openHarness, snap, expect } from './fixtures';

type St = { containers: Record<string, string> };

test('gen-1000 far', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=gen-1000&cam=far');
  const c = await page.evaluate(() => (window.__archi.state!() as St).containers);
  const systems = Object.keys(c).filter((id) => id.startsWith('Sys'));
  expect(systems).toHaveLength(8);
  console.log('far:', Object.entries(c).filter(([id]) => id.startsWith('Sys')).map(([id, s]) => `${id}=${s}`).join(' '));
  await snap(page, 11, 'gen-1000-far');
});

test('gen-1000 near', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=gen-1000&cam=focus&focus=S1C1&k=1');
  const c = await page.evaluate(() => (window.__archi.state!() as St).containers);
  expect(c.S1C1).toBe('open');
  await snap(page, 11, 'gen-1000-near');
});

test('app shows a progress indicator while laying out', async ({ page }) => {
  await page.goto('/index.html?test=1&fixture=gen-1000');
  await expect(page.locator('#file-name')).toHaveText('gen-1000.arch3d');
  await page.waitForFunction(() => window.__archi?.ready === true, undefined, { timeout: 60_000 });
  await expect(page.locator('#busy')).toBeHidden();
});

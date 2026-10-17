import type { Page } from '@playwright/test';
import { test, snap, expect, waitReady } from './fixtures';

type St = { revision: number; diagnostics: string[] };
const st = (page: Page) => page.evaluate(() => window.__archi.state!() as St);
/** Wait until a layout newer than `after` is drawn for exactly the text now in the editor. */
const waitRevision = async (page: Page, after: number) => {
  await page.waitForFunction((r) => {
    const s = window.__archi.state!() as { revision: number; idle: boolean; inSync: boolean };
    return window.__archi.ready && s.idle && s.inSync && s.revision > r;
  }, after);
  await waitReady(page);
};

test('app: edit with an error, then add a component', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await waitRevision(page, 0);
  await expect(page.locator('.cm-content')).toContainText('Northwind Shop');
  await snap(page, 10, 'app-northwind');

  const before = await page.evaluate(() => window.__archi.screenPos!('OrderAPI'));
  let rev = (await st(page)).revision;
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('BFF -> Inventory');
  await waitRevision(page, rev);
  expect((await st(page)).diagnostics).toEqual(['E102@42']);
  await expect(page.locator('.cm-lintRange-error')).toHaveText('Inventory');
  await expect(page.locator('#status')).toHaveText('1 error, 0 warnings');
  await snap(page, 10, 'app-error');

  rev = (await st(page)).revision;
  for (let i = 0; i < 'BFF -> Inventory'.length; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('external Inventory in: stock\nBFF -> Inventory.stock : stock');
  await waitRevision(page, rev);
  expect((await st(page)).diagnostics).toEqual([]);
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
  const after = await page.evaluate(() => window.__archi.screenPos!('OrderAPI'));
  expect(Math.hypot(after!.x - before!.x, after!.y - before!.y)).toBeLessThan(0.15 * 880);
  expect(await page.evaluate(() => window.__archi.screenPos!('Inventory'))).not.toBeNull();
  await snap(page, 10, 'app-after-edit');
});

test('app: on narrow screens the editor becomes a bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 });
  await page.goto('/index.html?test=1');
  await waitRevision(page, 0);
  const ed = (await page.locator('#editor').boundingBox())!;
  const vw = (await page.locator('#view').boundingBox())!;
  expect(ed.y).toBeGreaterThan(vw.y + vw.height - 1);
  expect(ed.width).toBeCloseTo(500, -1);
});

import type { Page } from '@playwright/test';
import { test, openHarness, snap, expect, waitReady } from './fixtures';

type St = { selected: string | null; camera: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } } };
const state = (page: Page) => page.evaluate(() => window.__archi.state!() as St);
const distance = (s: St) => Math.hypot(s.camera.position.x - s.camera.target.x, s.camera.position.y - s.camera.target.y, s.camera.position.z - s.camera.target.z);

test('click selects OrderAPI; double-click flies in', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=northwind&cam=far&lod=off');
  const pos = await page.evaluate(() => window.__archi.screenPos!('OrderAPI'));
  expect(pos).not.toBeNull();
  await page.mouse.click(pos!.x, pos!.y);
  expect((await state(page)).selected).toBe('OrderAPI');
  await expect(page.locator('.archi-info h3')).toContainText('OrderAPI');
  await expect(page.locator('.archi-info .crumbs')).toHaveText('All › Northwind › Ordering');
  await snap(page, 9, 'select-orderapi');

  const before = distance(await state(page));
  await page.mouse.dblclick(pos!.x, pos!.y);
  await page.waitForFunction((d) => {
    const s = window.__archi.state!() as { camera: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } } };
    const now = Math.hypot(s.camera.position.x - s.camera.target.x, s.camera.position.y - s.camera.target.y, s.camera.position.z - s.camera.target.z);
    return window.__archi.ready && now < d * 0.6;
  }, before);
  await waitReady(page);
  await snap(page, 9, 'flyin-orderapi');

  // Breadcrumb "All" flies back out.
  await page.locator('.archi-info .crumbs button', { hasText: 'All' }).click();
  await page.waitForFunction((d) => {
    const s = window.__archi.state!() as { camera: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } } };
    return window.__archi.ready && Math.hypot(s.camera.position.x - s.camera.target.x, s.camera.position.y - s.camera.target.y, s.camera.position.z - s.camera.target.z) > d * 0.95;
  }, before);
});

test('selecting the Ordering container highlights links crossing its border', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=northwind&cam=far&lod=off');
  await page.evaluate(() => window.__archi.select!('Ordering'));
  await expect(page.locator('.archi-info h3')).toContainText('Ordering');
  await snap(page, 9, 'select-ordering');
});

test('clicking empty ground clears the selection', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=northwind&cam=far&lod=off&select=OrderAPI');
  await page.mouse.click(30, 30);
  expect((await state(page)).selected).toBeNull();
  await expect(page.locator('.archi-info')).toBeHidden();
});

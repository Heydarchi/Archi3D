import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, openHarness, snap, expect, waitReady } from './fixtures';

test('Mermaid northwind next to native northwind (2D)', async ({ page }) => {
  await openHarness(page, 'view=svg2d&fixture=adapters/northwind.mmd');
  const mermaidBoxes = await page.locator('g[data-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')).sort());
  const mermaidEdges = await page.locator('polyline[data-edge]').count();
  await snap(page, 13, 'mermaid-northwind');
  await openHarness(page, 'view=svg2d&fixture=northwind');
  expect(await page.locator('g[data-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')).sort())).toEqual(mermaidBoxes);
  expect(await page.locator('polyline[data-edge]').count()).toBe(mermaidEdges);
  await snap(page, 13, 'native-northwind');
});

async function importFile(page: Page, file: string) {
  await page.goto('/index.html?test=1');
  await page.waitForFunction(() => window.__archi?.ready && (window.__archi.state!() as { revision: number }).revision > 0);
  const before = await page.evaluate(() => (window.__archi.state!() as { revision: number }).revision);
  await page.locator('#import-file').setInputFiles(join(process.cwd(), 'fixtures', 'adapters', file));
  await page.waitForFunction((r) => {
    const s = window.__archi.state!() as { revision: number; idle: boolean; inSync: boolean };
    return window.__archi.ready && s.idle && s.inSync && s.revision > r;
  }, before, { timeout: 60_000 });
  await waitReady(page);
}

test('app: Import a Mermaid file', async ({ page }) => {
  await importFile(page, 'northwind.mmd');
  await expect(page.locator('#file-name')).toHaveText('northwind.mmd');
  await expect(page.locator('#import-note')).toHaveText('Imported (mermaid)');
  await expect(page.locator('.cm-content')).toContainText('group Northwind');
  expect((await page.evaluate(() => window.__archi.state!() as { diagnostics: string[] })).diagnostics).toEqual([]);
});

test('app: Import a D2 file (WASM compiler loaded lazily, offline)', async ({ page }) => {
  await importFile(page, 'northwind.d2');
  await expect(page.locator('#import-note')).toHaveText('Imported (d2)');
  await expect(page.locator('.cm-content')).toContainText('container Northwind');
});

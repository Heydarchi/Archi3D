import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { test, snap, expect, waitReady } from './fixtures';

const file = (name: string) => pathToFileURL(join(process.cwd(), 'dist', name)).href;

/** Block every request that is not the file itself or inlined data. */
async function blockAll(page: Page): Promise<string[]> {
  const tried: string[] = [];
  await page.context().route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    tried.push(url);
    return route.abort('blockedbyclient');
  });
  return tried;
}

const ids = ['OrderAPI', 'Customer', 'Carrier', 'Northwind'];
const positions = (page: Page) => page.evaluate((list) => list.map((id) => window.__archi.screenPos!(id)), ids);

async function appPositions(page: Page) {
  await page.goto('/index.html?test=1');
  await waitReady(page);
  return positions(page);
}

test('standalone file works offline from file://', async ({ page, browser }) => {
  const ref = await appPositions(await browser.newPage());
  const tried = await blockAll(page);
  await page.goto(`${file('archi3d-standalone.html')}?test=1`);
  await waitReady(page);
  const st = await page.evaluate(() => window.__archi.state!() as { elkSource: string; revision: number });
  expect(st.elkSource).toBe('inline');
  expect(st.revision).toBe(1);
  expect(tried).toEqual([]);
  // Same layout and camera as the step-10 app view.
  const got = await positions(page);
  got.forEach((p, i) => expect(Math.hypot(p!.x - ref[i]!.x, p!.y - ref[i]!.y), ids[i]).toBeLessThan(1));
  await snap(page, 12, 'standalone-offline');
});

test('CDN mode falls back to the inlined copy when the CDN is blocked', async ({ page }) => {
  const tried = await blockAll(page);
  const warnings: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto(`${file('archi3d-standalone-cdn.html')}?test=1`);
  await waitReady(page);
  const st = await page.evaluate(() => window.__archi.state!() as { elkSource: string });
  expect(st.elkSource).toBe('inline');
  expect(tried.length).toBeGreaterThan(0);
  expect(tried.every((u) => /cdn\.jsdelivr\.net|unpkg\.com/.test(u))).toBe(true);
  expect(warnings.some((w) => w.includes('CDN not reachable'))).toBe(true);
  await snap(page, 12, 'standalone-cdn-fallback');
});

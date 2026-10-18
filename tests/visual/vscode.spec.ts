// The VS Code extension's pieces in a real browser: the webview build under the webview's CSP,
// driven by the same messages the extension sends, and an exported HTML file opened offline.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { analyze, fillTemplate, previewHtml } from '../../vscode/src/host';
import { test, expect, waitReady } from './fixtures';

const dist = join(process.cwd(), 'vscode', 'dist');
const ORIGIN = 'https://webview.test';

type Out = { type: string; id?: string | null; dataUrl?: string; requestId?: number };
const outbox = (page: Page) => page.evaluate(() => (window.__archiOutbox ?? []) as Out[]);
const post = (page: Page, m: unknown) => page.evaluate((msg) => window.postMessage(msg, '*'), m);

/** Open the built preview the way VS Code does: its own HTML + CSP, dark theme class on <body>. */
async function openWebview(page: Page, csp: string[]) {
  await page.route(`${ORIGIN}/**`, (route) => {
    const url = route.request().url();
    if (url.endsWith('/media/preview.js')) return route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(dist, 'media', 'preview.js'), 'utf8') });
    const html = previewHtml({ cspSource: ORIGIN, scriptUri: `${ORIGIN}/media/preview.js`, nonce: 'testnonce', title: 'Archi3D preview' })
      .replace('<body>', '<body class="vscode-dark">');
    return route.fulfill({ contentType: 'text/html', body: html });
  });
  page.on('console', (m) => { if (/Content Security Policy|Refused to|HTML labels/i.test(m.text())) csp.push(m.text()); });
  await page.goto(`${ORIGIN}/index.html?test=1`);
  await page.waitForFunction(() => (window.__archiOutbox ?? []).some((m) => m.type === 'ready'));
}

async function sendModel(page: Page, file: string) {
  const text = readFileSync(join(process.cwd(), file), 'utf8');
  const a = analyze(file, text);
  const before = await page.evaluate(() => (window.__archi.state!() as { revision: number }).revision);
  await post(page, { type: 'update', name: file, source: a.archText });
  await page.waitForFunction((r) => {
    const s = window.__archi.state!() as { revision: number; idle: boolean };
    return window.__archi.ready && s.idle && s.revision > r;
  }, before, { timeout: 60_000 });
  await waitReady(page);
}

test('webview: live updates, click reports the element, PNG capture, under the webview CSP', async ({ page }) => {
  test.setTimeout(120_000);
  const csp: string[] = [];
  await openWebview(page, csp);
  await sendModel(page, 'examples/3-systems/android-app.arch3d');
  expect(await page.evaluate(() => (window.__archi.state!() as { elkSource: string }).elkSource)).toBe('inline');
  // Labels must be drawn in WebGL (troika), or PNG captures would miss them.
  expect(await page.evaluate(() => (window.__archi.state!() as { labelMode: string }).labelMode)).toBe('troika');
  await page.screenshot({ path: 'artifacts/vscode/preview-android-dark.png' });

  // Typing in VS Code sends the whole text again; the camera stays.
  const cam = await page.evaluate(() => window.__archi.screenPos!('MainActivity'));
  await sendModel(page, 'examples/3-systems/android-app.arch3d');
  const again = await page.evaluate(() => window.__archi.screenPos!('MainActivity'));
  expect(Math.hypot(again!.x - cam!.x, again!.y - cam!.y)).toBeLessThan(1);

  // A Mermaid file, converted by the host.
  await sendModel(page, 'examples/2-basics/mermaid.mmd');
  const pos = await page.evaluate(() => window.__archi.screenPos!('api'));
  await page.mouse.click(pos!.x, pos!.y);
  expect((await outbox(page)).filter((m) => m.type === 'pick').at(-1)).toEqual({ type: 'pick', id: 'api' });

  // "Save 3D Preview as PNG…"
  await post(page, { type: 'capture', requestId: 7 });
  await page.waitForFunction(() => (window.__archiOutbox ?? []).some((m) => m.type === 'captured'));
  const shot = (await outbox(page)).find((m) => m.type === 'captured')!;
  expect(shot.requestId).toBe(7);
  expect(shot.dataUrl!.startsWith('data:image/png;base64,')).toBe(true);
  const png = Buffer.from(shot.dataUrl!.split(',')[1], 'base64');
  expect(png.readUInt32BE(16)).toBe(1280);
  mkdirSync('artifacts/vscode', { recursive: true });
  writeFileSync('artifacts/vscode/captured-mermaid.png', png);

  expect(csp).toEqual([]);
});

test('webview: the AOSP example, light theme host messages, select from the host', async ({ page }) => {
  test.setTimeout(120_000);
  const csp: string[] = [];
  await openWebview(page, csp);
  await sendModel(page, 'examples/3-systems/aosp-camera.arch3d');
  await post(page, { type: 'select', id: 'CameraService' });
  await page.waitForFunction(() => (window.__archi.state!() as { selected: string }).selected === 'CameraService');
  await waitReady(page);
  await page.screenshot({ path: 'artifacts/vscode/preview-aosp-select.png' });
  expect(csp).toEqual([]);
});

test('"Export Standalone HTML…": the filled template works offline from disk', async ({ page }) => {
  const a = analyze('07-aosp-camera.arch3d', readFileSync('examples/3-systems/aosp-camera.arch3d', 'utf8'));
  const file = join(process.cwd(), 'test-results', 'vscode-export', 'aosp.html');
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, fillTemplate(readFileSync(join(dist, 'template.html'), 'utf8'), 'aosp', a.archText));
  const tried: string[] = [];
  await page.context().route('**/*', (r) => {
    const u = r.request().url();
    if (/^(file|data|blob):/.test(u)) return r.continue();
    tried.push(u);
    return r.abort();
  });
  await page.goto(`${pathToFileURL(file).href}?test=1`);
  await page.waitForFunction(() => window.__archi?.ready && (window.__archi.state!() as { revision: number }).revision > 0, undefined, { timeout: 60_000 });
  await expect(page.locator('#file-name')).toHaveText('aosp.arch3d');
  await expect(page.locator('.cm-content')).toContainText('CameraService');
  expect(tried).toEqual([]);
  await page.screenshot({ path: 'artifacts/vscode/exported-aosp.png' });
});

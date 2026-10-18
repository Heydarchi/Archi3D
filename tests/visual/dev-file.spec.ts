// "npm run dev -- model.arch3d": open a file from disk, edit it in the app, save it back,
// and follow the changes other programs make. Runs against a real dev server.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
// @ts-expect-error - plain .mjs script without types
import { startDev } from '../../scripts/dev.mjs';
import { test, expect, waitReady } from './fixtures';

const dir = join(process.cwd(), 'test-results', 'dev-file');
type Server = { close(): Promise<void>; httpServer: { address(): AddressInfo } };
type St = { revision: number; idle: boolean; inSync: boolean; file: { dirty: boolean; banner: string | null } | null };
const state = (page: Page) => page.evaluate(() => window.__archi.state!() as St);

async function waitLayout(page: Page, after: number) {
  await page.waitForFunction((r) => {
    const s = window.__archi.state!() as { revision: number; idle: boolean; inSync: boolean };
    return window.__archi.ready && s.idle && s.inSync && s.revision > r;
  }, after, { timeout: 60_000 });
  await waitReady(page);
}

async function open(page: Page, file: string): Promise<Server> {
  const server: Server = await startDev({ file, port: 0, logLevel: 'silent' });
  await page.goto(`http://localhost:${server.httpServer.address().port}/?test=1`);
  await waitLayout(page, 0);
  return server;
}

test.beforeAll(() => { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); });

test('edit a model file and save it back; follow changes made on disk', async ({ page }) => {
  test.setTimeout(180_000);
  const file = join(dir, 'shop.arch3d');
  writeFileSync(file, readFileSync('examples/2-basics/containers.arch3d', 'utf8'));
  const server = await open(page, file);
  try {
    await expect(page.locator('#file-name')).toHaveText('shop.arch3d');
    await expect(page.locator('#save')).toBeVisible();
    await expect(page.locator('#save')).toBeDisabled();
    await expect(page.locator('.cm-content')).toContainText('container Backend');

    // Edit → unsaved marker → Ctrl/Cmd+S writes the file.
    let rev = (await state(page)).revision;
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\nexternal Audit in: log\nOrders -> Audit.log : audit', { delay: 30 }); // human speed, see step10.spec.ts
    await waitLayout(page, rev);
    await expect(page.locator('#file-name')).toHaveText('● shop.arch3d');
    expect((await state(page)).file!.dirty).toBe(true);
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.locator('#file-name')).toHaveText('shop.arch3d');
    await expect(page.locator('#import-note')).toHaveText('Saved shop.arch3d');
    expect(readFileSync(file, 'utf8')).toContain('Orders -> Audit.log : audit');
    await page.screenshot({ path: 'artifacts/dev-file/saved.png' });

    // Another program changes the file while the editor is clean → reloaded.
    rev = (await state(page)).revision;
    writeFileSync(file, `${readFileSync(file, 'utf8')}\nexternal Mailer in: send\nOrders -> Mailer.send\n`);
    await waitLayout(page, rev);
    await expect(page.locator('.cm-content')).toContainText('external Mailer');
    await expect(page.locator('#import-note')).toHaveText('Reloaded, the file changed on disk');
    expect(await page.evaluate(() => window.__archi.screenPos!('Mailer'))).not.toBeNull();

    // A change on disk while there are unsaved edits → ask, never overwrite silently.
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\n# my unsaved note', { delay: 30 });
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n# their change\n`);
    await expect(page.locator('#file-banner')).toContainText('changed on disk and you have unsaved edits');
    await page.screenshot({ path: 'artifacts/dev-file/conflict.png' });
    await page.locator('#file-banner button', { hasText: 'Keep mine' }).click();
    await page.locator('#save').click();
    await expect(page.locator('#import-note')).toHaveText('Saved shop.arch3d');
    const disk = readFileSync(file, 'utf8');
    expect(disk).toContain('# my unsaved note');
    expect(disk).not.toContain('# their change');
  } finally {
    await server.close();
  }
});

test('a new file starts from a small example and is created on first save', async ({ page }) => {
  test.setTimeout(120_000);
  const file = join(dir, 'new-model.arch3d');
  const server = await open(page, file);
  try {
    await expect(page.locator('#import-note')).toHaveText('New file, Save creates it');
    await expect(page.locator('.cm-content')).toContainText('database Store');
    await page.locator('#save').click();
    await expect(page.locator('#import-note')).toHaveText('Saved new-model.arch3d');
    expect(existsSync(file)).toBe(true);
  } finally {
    await server.close();
  }
});

test('a Mermaid file opens converted and saves to a sibling .arch3d, untouched itself', async ({ page }) => {
  test.setTimeout(120_000);
  const file = join(dir, 'flow.mmd');
  const original = readFileSync('examples/2-basics/mermaid.mmd', 'utf8');
  writeFileSync(file, original);
  const server = await open(page, file);
  try {
    await expect(page.locator('#import-note')).toHaveText('Imported, Save writes flow.arch3d');
    await expect(page.locator('.cm-content')).toContainText('group shop "Shop" {');
    await page.locator('#save').click();
    await expect(page.locator('#import-note')).toHaveText('Saved flow.arch3d');
    expect(readFileSync(join(dir, 'flow.arch3d'), 'utf8')).toContain('group shop "Shop" {');
    expect(readFileSync(file, 'utf8')).toBe(original);
  } finally {
    await server.close();
  }
});

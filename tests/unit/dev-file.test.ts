import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs scripts without types
import { hashText, saveTarget } from '../../scripts/dev-file-plugin.mjs';
// @ts-expect-error - plain .mjs scripts without types
import { startDev } from '../../scripts/dev.mjs';

const dir = join(import.meta.dirname, '..', '..', 'test-results', 'dev-file-unit');
type Server = { close(): Promise<void>; httpServer: { address(): AddressInfo } };

async function serve(file: string) {
  const server: Server = await startDev({ file, port: 0, logLevel: 'silent' });
  const url = `http://localhost:${server.httpServer.address().port}/__archi/file`;
  return { server, url };
}
const put = (url: string, body: unknown) => fetch(url, { method: 'PUT', body: JSON.stringify(body) });

beforeAll(() => { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); });

describe('saveTarget', () => {
  it('.arch3d saves in place; other formats save to a sibling .arch3d', () => {
    expect(saveTarget('/m/shop.arch3d')).toBe('/m/shop.arch3d');
    expect(saveTarget('/m/shop.mmd')).toBe('/m/shop.arch3d');
    expect(saveTarget('/m/shop.d2')).toBe('/m/shop.arch3d');
    expect(saveTarget('/m/shop')).toBe('/m/shop.arch3d');
    expect(saveTarget('/m/old.arch')).toBe('/m/old.arch');
  });
});

describe('dev server file endpoint', () => {
  let s: Awaited<ReturnType<typeof serve>>;
  const file = join(dir, 'shop.arch3d');
  beforeAll(async () => {
    writeFileSync(file, 'component A\n');
    s = await serve(file);
  });
  afterAll(() => s.server.close());

  it('GET returns the text and its hash', async () => {
    const r = await (await fetch(s.url)).json();
    expect(r).toMatchObject({ name: 'shop.arch3d', text: 'component A\n', hash: hashText('component A\n'), exists: true, saveAs: file });
  });

  it('PUT saves when nobody changed the file meanwhile', async () => {
    const r = await put(s.url, { text: 'component A\ncomponent B\n', baseHash: hashText('component A\n') });
    expect(r.status).toBe(200);
    expect(readFileSync(file, 'utf8')).toBe('component A\ncomponent B\n');
  });

  it('PUT refuses (409) when the file changed on disk since it was loaded', async () => {
    writeFileSync(file, 'component Other\n');
    const r = await put(s.url, { text: 'component Mine\n', baseHash: hashText('component A\ncomponent B\n') });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ text: 'component Other\n' });
    expect(readFileSync(file, 'utf8')).toBe('component Other\n');
  });

  it('only this one file is served: no path parameter is honoured', async () => {
    const r = await (await fetch(`${s.url}?path=/etc/passwd`)).json();
    expect(r.name).toBe('shop.arch3d');
    expect((await fetch(s.url, { method: 'DELETE' })).status).toBe(405);
  });
});

describe('new and imported files', () => {
  it('a file that does not exist yet is created on first save', async () => {
    const file = join(dir, 'new-model.arch3d');
    const s = await serve(file);
    try {
      const r = await (await fetch(s.url)).json();
      expect(r).toMatchObject({ exists: false, text: '' });
      expect((await put(s.url, { text: 'component A\n', baseHash: r.hash })).status).toBe(200);
      expect(readFileSync(file, 'utf8')).toBe('component A\n');
    } finally { await s.server.close(); }
  });

  it('a Mermaid file is never overwritten; saves go to name.arch3d', async () => {
    const file = join(dir, 'flow.mmd');
    writeFileSync(file, 'architecture-beta\n    service a(server)[A]\n');
    const s = await serve(file);
    try {
      const r = await (await fetch(s.url)).json();
      expect(r.saveAs).toBe(join(dir, 'flow.arch3d'));
      expect((await put(s.url, { text: 'service a\n', baseHash: r.hash })).status).toBe(200);
      expect(readFileSync(file, 'utf8')).toContain('architecture-beta');
      expect(existsSync(join(dir, 'flow.arch3d'))).toBe(true);
    } finally { await s.server.close(); }
  });
});

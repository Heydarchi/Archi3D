import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs script without types
import { cdnUrlsFromManifest, exportStandalone } from '../../scripts/export-standalone.mjs';
import { fixture } from './helpers';

const outDir = join(import.meta.dirname, '..', '..', 'test-results', 'standalone');

/**
 * URL-shaped strings that are identifiers, never fetched: XML namespace URIs (SVG/XHTML for
 * createElementNS, XML Schema and Eclipse EMF namespaces inside ELK) and a citation in a
 * three.js shader comment.
 */
const IDENTIFIER_URLS = [
  /^http:\/\/www\.w3\.org\//,
  /^http:\/\/www\.eclipse\.org\/(elk|emf)\//,
  /^http:\/\/\/org\/eclipse\/emf\//,
  /^https:\/\/jcgt\.org\/published\//,
];

const urls = (html: string) => html.match(/https?:\/\/[^"'`\s)<>\\]*/g) ?? [];

let offline = '', cdn = '';
beforeAll(async () => {
  offline = readFileSync(await exportStandalone({ out: join(outDir, 'offline.html') }), 'utf8');
  cdn = readFileSync(await exportStandalone({ cdn: true, out: join(outDir, 'cdn.html') }), 'utf8');
}, 300_000);

describe('standalone export', () => {
  it('offline: no URLs except known identifiers', () => {
    const bad = urls(offline).filter((u) => !IDENTIFIER_URLS.some((re) => re.test(u)));
    expect(bad).toEqual([]);
  });

  it('CDN mode: only the pinned CDN list on top of that', () => {
    const list: string[] = cdnUrlsFromManifest();
    expect(list.every((u) => /elkjs@\d+\.\d+\.\d+\//.test(u))).toBe(true);
    const bad = urls(cdn).filter((u) => !IDENTIFIER_URLS.some((re) => re.test(u)) && !list.includes(u));
    expect(bad).toEqual([]);
    for (const u of list) expect(cdn).toContain(u);
    for (const u of list) expect(offline).not.toContain(u);
  });

  it('is under 3 MB', () => {
    expect(Buffer.byteLength(offline)).toBeLessThan(3_000_000);
    expect(Buffer.byteLength(cdn)).toBeLessThan(3_000_000);
  });

  it('is one file: no relative scripts, stylesheets or assets', () => {
    expect(offline).not.toMatch(/<script[^>]+src=/);
    expect(offline).not.toMatch(/<link[^>]+stylesheet/);
    expect(offline).not.toMatch(/\.\/assets\//);
    expect(offline).toContain('data:font/woff;base64,');
  });

  it('embeds the model', () => {
    // The minifier may re-quote the string, so look for distinctive lines rather than the exact literal.
    for (const line of ['OrderAPI.events   => EventBus.publish : OrderPlaced', 'component AuthService  in: login   out: users']) {
      expect(fixture('northwind.arch3d')).toContain(line);
      expect(offline).toContain(line);
    }
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyze, fillTemplate, isModelFile, NAME_PLACEHOLDER, previewHtml, SOURCE_PLACEHOLDER } from '../../vscode/src/host';
// @ts-expect-error - plain .mjs script without types
import { exportStandalone } from '../../scripts/export-standalone.mjs';
import { fixture } from './helpers';

describe('analyze', () => {
  it('.arch3d: diagnostics and definition locations', () => {
    const a = analyze('/w/shop.arch3d', 'component A\nA -> Missing');
    expect(a.format).toBe('arch');
    expect(a.archText).toBe('component A\nA -> Missing');
    expect(a.diagnostics.map((d) => [d.code, d.loc.line])).toEqual([['E102', 2]]);
    expect(a.locations.A).toEqual({ line: 1, col: 11, endCol: 12 });
  });
  it('Mermaid: converted to .arch3d for the preview, locations point into the Mermaid file', () => {
    const src = readFileSync(join(import.meta.dirname, '..', '..', 'examples', '2-basics', 'mermaid.mmd'), 'utf8');
    const a = analyze('/w/x.mmd', src);
    expect(a.format).toBe('mermaid');
    expect(a.archText).toContain('group shop "Shop" {'); // the [Title] is kept
    expect(a.locations.api.line).toBe(src.split('\n').findIndex((l) => l.includes('service api')) + 1);
  });
  it('D2 is reported as not previewable (no crash)', () => {
    expect(analyze('/w/x.d2', 'a -> b').unsupported).toMatch(/D2/);
  });
  it('isModelFile', () => {
    expect(isModelFile('/a/b.arch3d', 'plaintext')).toBe(true);
    expect(isModelFile('/a/b.mmd', 'plaintext')).toBe(true);
    expect(isModelFile('/a/b.txt', 'arch3d')).toBe(true);
    expect(isModelFile('/a/old.arch', 'plaintext')).toBe(false); // VS Code claims only .arch3d
    expect(isModelFile('/a/b.ts', 'typescript')).toBe(false);
  });
});

describe('previewHtml', () => {
  const html = previewHtml({ cspSource: 'vscode-webview://x', scriptUri: 'vscode-webview://x/media/preview.js', nonce: 'N0nce', title: 'A<b>' });
  it('loads one script with a nonce under a strict CSP that allows blob workers', () => {
    expect(html).toContain(`script-src 'nonce-N0nce' blob:`);
    expect(html).toContain('worker-src blob:');
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/unsafe-eval/);
    expect(html.match(/<script /g)).toHaveLength(1);
    expect(html).toContain('<title>A&lt;b&gt;</title>');
  });
});

describe('fillTemplate (the built standalone page)', () => {
  let template = '';
  beforeAll(async () => {
    const out = join(import.meta.dirname, '..', '..', 'test-results', 'vscode-template.html');
    template = readFileSync(await exportStandalone({ source: SOURCE_PLACEHOLDER, name: NAME_PLACEHOLDER, out }), 'utf8');
  }, 300_000);

  it('replaces both placeholders exactly once', () => {
    const html = fillTemplate(template, 'northwind', fixture('northwind.arch3d'));
    expect(html).not.toContain(SOURCE_PLACEHOLDER);
    expect(html).not.toContain(NAME_PLACEHOLDER);
    expect(html).toContain('OrderAPI.events   =>');
  });

  it('a model containing </script> cannot break out of the page', () => {
    const html = fillTemplate(template, 'x', 'component A # </script><script>alert(1)</script>');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('<\\/script>');
  });

  it('a damaged template is reported', () => {
    expect(() => fillTemplate('<html></html>', 'x', 'y')).toThrow(/damaged/);
  });
});

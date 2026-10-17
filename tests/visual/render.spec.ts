// The command-line renderer end to end: real files in, PNG files out.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './fixtures';

const out = join(process.cwd(), 'test-results', 'render-cli');

/** Width and height from a PNG header. */
const size = (file: string) => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('npm run render: .arch, Mermaid (2D) and D2 to PNG', async ({ page }) => {
  test.setTimeout(240_000);
  rmSync(out, { recursive: true, force: true });
  const run = (...args: string[]) => execFileSync('node', ['scripts/render.mjs', ...args], { encoding: 'utf8', env: process.env });
  expect(run('examples/03-containers.arch', '--out', join(out, 'shop.png'))).toContain('wrote');
  run('examples/05-mermaid.mmd', '--view', 'svg2d', '--out', join(out, 'mermaid.png'), '--width', '800', '--height', '500');
  run('fixtures/adapters/northwind.d2', '--out', join(out, 'd2.png'), '--cam', 'far', '--scale', '2', '--width', '600', '--height', '400');
  expect(size(join(out, 'shop.png'))).toEqual([1600, 1000]);
  expect(size(join(out, 'mermaid.png'))).toEqual([800, 500]);
  expect(size(join(out, 'd2.png'))).toEqual([1200, 800]);
  // Copy for review alongside the other pictures.
  for (const f of ['shop', 'mermaid', 'd2']) {
    await page.goto(`data:text/html,<body style="margin:0"><img src="data:image/png;base64,${readFileSync(join(out, `${f}.png`)).toString('base64')}"></body>`);
    await page.screenshot({ path: `artifacts/render/${f}.png`, fullPage: true });
  }
  expect(() => run('nope.arch')).toThrow();
});

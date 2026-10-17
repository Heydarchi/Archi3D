// Render a model to a PNG with headless Chrome — Archi3D as a command-line rendering tool.
//
//   node scripts/render.mjs <model.arch|.mmd|.d2> [options]
//
//   --out <file.png>          output (default: next to the model, .png)
//   --view scene|svg2d        3D view (default) or the flat 2D layout
//   --cam far|mid|near|iso    camera pose (default iso)
//   --focus <Id> [--k 1.5]    frame one container/component instead (k = distance in footprint diagonals)
//   --width 1600 --height 1000 --scale 1
//   --edges ortho|arc  --lod off|on (semantic zoom; off by default so every component shows)  --bundle  --select <Id>  --theme light|dark  --panel
//   --browser chromium|chrome|msedge   (default: $PW_CHANNEL, else Playwright's Chromium, else Chrome)
//
// The app is built into dist/ first when the sources are newer than the build.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const opts = { view: 'scene', cam: 'iso', width: 1600, height: 1000, scale: 1, edges: 'ortho', lod: 'off', theme: 'light', bundle: false, panel: false };
  const flags = new Set(['bundle', 'panel']);
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const key = a.slice(2);
    if (flags.has(key)) { opts[key] = true; continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error(`Missing value for ${a}`);
    opts[key] = ['width', 'height', 'scale', 'k'].includes(key) ? Number(value) : value;
  }
  if (!rest[0]) throw new Error('Usage: node scripts/render.mjs <model.arch|.mmd|.d2> [--out file.png] [options]');
  opts.model = resolve(rest[0]);
  opts.out = resolve(opts.out ?? opts.model.replace(/\.[^.]+$/, '') + '.png');
  return opts;
}

export function harnessQuery(opts) {
  const q = new URLSearchParams({ test: '1', view: opts.view, fixture: basename(opts.model) });
  if (opts.view === 'scene') {
    q.set('cam', opts.focus ? 'focus' : opts.cam);
    if (opts.focus) { q.set('focus', opts.focus); q.set('k', String(opts.k ?? 1.5)); }
    q.set('edges', opts.edges);
    if (opts.lod === 'off') q.set('lod', 'off');
    if (opts.bundle) q.set('bundle', 'on');
    if (opts.select) q.set('select', opts.select);
    if (opts.theme === 'dark') q.set('theme', 'dark');
    if (!opts.panel) q.set('panel', 'off');
  }
  return q.toString();
}

const newest = (dir) => readdirSync(dir).reduce((t, f) => {
  const p = join(dir, f);
  const s = statSync(p);
  return Math.max(t, s.isDirectory() ? newest(p) : s.mtimeMs);
}, 0);

async function ensureBuilt() {
  const built = join(root, 'dist', 'harness.html');
  const stale = !existsSync(built) || Math.max(newest(join(root, 'src')), newest(join(root, 'fixtures'))) > statSync(built).mtimeMs;
  if (stale) {
    console.log('building the app (sources changed)…');
    await build({ root, logLevel: 'warn' });
  }
}

async function launch(choice) {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const tries = choice ? [choice] : [undefined, 'chrome', 'msedge'];
  let last;
  for (const channel of tries) {
    try {
      return await chromium.launch({ channel: channel === 'chromium' ? undefined : channel, args });
    } catch (err) { last = err; }
  }
  throw new Error(`No browser found (${last?.message?.split('\n')[0]}). Install one with "npx playwright install --with-deps chromium", or pass --browser chrome.`);
}

export async function render(opts) {
  const text = readFileSync(opts.model, 'utf8');
  await ensureBuilt();
  const server = await preview({ root, logLevel: 'silent', preview: { port: 0, open: false } });
  const base = server.resolvedUrls.local[0];
  const browser = await launch(opts.browser ?? process.env.PW_CHANNEL);
  try {
    const page = await browser.newPage({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: opts.scale });
    await page.context().route('**/*', (r) => (r.request().url().startsWith(base) || /^(data|blob):/.test(r.request().url()) ? r.continue() : r.abort()));
    await page.addInitScript((src) => { window.__ARCHI_SOURCE__ = src; }, text);
    await page.goto(`${base}harness.html?${harnessQuery(opts)}`);
    await page.waitForFunction(() => window.__archi?.ready === true, undefined, { timeout: 120_000 });
    const error = await page.evaluate(() => window.__archi.error);
    if (error) throw new Error(`Could not render: ${error.split('\n')[0]}`);
    await page.screenshot({ path: opts.out });
    return opts.out;
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    console.log(`wrote ${await render(opts)}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

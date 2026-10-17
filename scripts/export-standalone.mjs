// One HTML file you can email or double-click: JS, CSS and fonts inlined, the layout worker built
// from inlined code through a Blob URL, one .arch3d model embedded. Works from file:// offline.
//
//   node scripts/export-standalone.mjs [model.arch3d] [--cdn] [--out file.html]
//
// --cdn: the page first tries ELK from pinned CDN URLs (exact version from vendor/manifest.json,
// 3 s timeout) and falls back to the inlined copy.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = (p) => join(root, 'src', 'app', p);

/** troika's fallback-font resolver URL; unreachable (labels keep to the bundled font), so blank it. */
const TROIKA_CDN = 'https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data';

export function cdnUrlsFromManifest() {
  const manifest = JSON.parse(readFileSync(join(root, 'vendor', 'manifest.json'), 'utf8'));
  const elk = manifest.files.find((f) => f.package === 'elkjs');
  return [
    `https://cdn.jsdelivr.net/npm/elkjs@${elk.version}/lib/elk.bundled.js`,
    `https://unpkg.com/elkjs@${elk.version}/lib/elk.bundled.js`,
  ];
}

export async function buildWorker(tmp, withoutElk) {
  const outDir = join(tmp, withoutElk ? 'worker-sans-elk' : 'worker');
  await build({
    configFile: false, root, logLevel: 'warn',
    build: {
      outDir, emptyOutDir: true, minify: true, target: 'es2022',
      lib: { entry: app('worker.ts'), formats: ['iife'], name: 'ArchiLayoutWorker', fileName: () => 'worker.js' },
      rollupOptions: withoutElk
        ? { external: ['elkjs/lib/elk.bundled.js'], output: { globals: { 'elkjs/lib/elk.bundled.js': 'ELK' } } }
        : {},
    },
  });
  return readFileSync(join(outDir, 'worker.js'), 'utf8');
}

/** Inline every emitted chunk and stylesheet into the HTML page. */
const inlineIntoHtml = () => ({
  name: 'archi-inline-single-file',
  enforce: 'post',
  generateBundle(_opts, bundle) {
    const htmlName = Object.keys(bundle).find((k) => k.endsWith('.html'));
    const page = bundle[htmlName];
    let html = String(page.source);
    for (const [name, item] of Object.entries(bundle)) {
      const ref = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (item.type === 'chunk') {
        const code = item.code.replace(/<\/script/gi, '<\\/script');
        html = html.replace(new RegExp(`<script[^>]*src="[^"]*${ref}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
        delete bundle[name];
      } else if (name.endsWith('.css')) {
        html = html.replace(new RegExp(`<link[^>]*href="[^"]*${ref}"[^>]*>`), () => `<style>${item.source}</style>`);
        delete bundle[name];
      }
    }
    page.source = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
  },
});

/** The virtual module + module swaps that turn the app into a self-contained bundle. */
export function standaloneModules({ workerCode, workerWithoutElk = '', cdnUrls = [], name, source }) {
  const virtual = [
    `export const workerCode = ${JSON.stringify(workerCode)};`,
    `export const workerWithoutElk = ${JSON.stringify(workerWithoutElk)};`,
    `export const cdnUrls = ${JSON.stringify(cdnUrls)};`,
    `export const embeddedName = ${JSON.stringify(name)};`,
    `export const embeddedSource = ${JSON.stringify(source)};`,
  ].join('\n');
  const swap = {
    './workerFactory': app('workerFactory.standalone.ts'),
    './fixtures': app('fixtures.standalone.ts'),
    './importD2': app('importD2.standalone.ts'),
  };
  return {
    name: 'archi-standalone-modules',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'virtual:archi-standalone') return '\0virtual:archi-standalone';
      if (importer?.startsWith(join(root, 'src', 'app')) && swap[id]) return swap[id];
      return null;
    },
    load(id) { return id === '\0virtual:archi-standalone' ? virtual : null; },
  };
}

/**
 * `model` is a file path. Or give `source` (and `name`) directly, the VS Code extension builds a
 * template with a placeholder source this way and fills it in at export time.
 */
export async function exportStandalone({ model = join(root, 'fixtures', 'northwind.arch3d'), source, name, cdn = false, out } = {}) {
  const target = out ?? join(root, 'dist', cdn ? 'archi3d-standalone-cdn.html' : 'archi3d-standalone.html');
  const tmp = join(root, 'dist', '.standalone', cdn ? 'cdn' : 'offline');
  rmSync(tmp, { recursive: true, force: true });
  const workerCode = await buildWorker(tmp, false);
  const workerWithoutElk = cdn ? await buildWorker(tmp, true) : '';
  const cdnUrls = cdn ? cdnUrlsFromManifest() : [];
  const modules = standaloneModules({
    workerCode, workerWithoutElk, cdnUrls,
    name: name ?? basename(model).replace(/\.arch(3d)?$/, ''),
    source: source ?? readFileSync(model, 'utf8'),
  });

  await build({
    configFile: false, root, base: './', logLevel: 'warn',
    plugins: [
      modules,
      inlineIntoHtml(),
    ],
    build: {
      outDir: join(tmp, 'page'), emptyOutDir: true, target: 'es2022', minify: true,
      assetsInlineLimit: () => true,          // fonts become data: URIs
      cssCodeSplit: false, modulePreload: false, chunkSizeWarningLimit: 10_000,
      rollupOptions: { input: join(root, 'index.html'), output: { codeSplitting: false } },
    },
  });

  let html = readFileSync(join(tmp, 'page', 'index.html'), 'utf8');
  html = html.split(TROIKA_CDN).join('');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  rmSync(tmp, { recursive: true, force: true });
  return target;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const cdn = args.includes('--cdn');
  const outAt = args.indexOf('--out');
  const out = outAt >= 0 ? resolve(args[outAt + 1]) : undefined;
  const model = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
  const file = await exportStandalone({ model: model ? resolve(model) : undefined, cdn, out });
  const size = readFileSync(file).length;
  console.log(`wrote ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

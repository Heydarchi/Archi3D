// Builds the VS Code extension in vscode/dist/:
//   extension.js      the extension (CommonJS, runs in VS Code's Node host)
//   media/preview.js  the 3D preview page (one script: app + layout worker + font inlined)
//   template.html     the standalone page with placeholders, filled in by "Export Standalone HTML…"
// With --package it also writes vscode/archi3d-<version>.vsix (install: code --install-extension <file>).
import { spawnSync } from 'node:child_process';
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { buildWorker, exportStandalone, standaloneModules } from './export-standalone.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ext = join(root, 'vscode');
const out = join(ext, 'dist');
const tmp = join(root, 'dist', '.vscode-build');

// Must match vscode/src/host.ts.
const SOURCE_PLACEHOLDER = '__ARCHI3D_SOURCE_PLACEHOLDER__';
const NAME_PLACEHOLDER = '__ARCHI3D_NAME_PLACEHOLDER__';

rmSync(out, { recursive: true, force: true });
const workerCode = await buildWorker(tmp, false);

await build({
  configFile: false, root, logLevel: 'warn',
  plugins: [standaloneModules({ workerCode, name: 'model', source: '' })],
  build: {
    outDir: join(out, 'media'), emptyOutDir: true, target: 'es2022', minify: true, chunkSizeWarningLimit: 10_000,
    lib: { entry: join(root, 'src', 'app', 'preview.ts'), formats: ['iife'], name: 'ArchiPreview', fileName: () => 'preview.js' },
  },
});

await build({
  configFile: false, root, logLevel: 'warn',
  build: {
    outDir: out, emptyOutDir: false, target: 'node18', minify: false, ssr: true,
    lib: { entry: join(ext, 'src', 'extension.ts'), formats: ['cjs'], fileName: () => 'extension.js' },
    rollupOptions: { external: ['vscode'], output: { exports: 'named' } },
  },
  ssr: { noExternal: true },
});

renameSync(join(out, 'extension.cjs'), join(out, 'extension.js')); // Vite names SSR CommonJS output .cjs

await exportStandalone({ source: SOURCE_PLACEHOLDER, name: NAME_PLACEHOLDER, out: join(out, 'template.html') });
rmSync(tmp, { recursive: true, force: true });
console.log(`built ${out}`);

if (process.argv.includes('--package')) {
  const { version } = JSON.parse(readFileSync(join(ext, 'package.json'), 'utf8'));
  const vsix = join(ext, `archi3d-${version}.vsix`);
  const vsce = join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
  const r = spawnSync(process.execPath, [vsce, 'package', '--no-dependencies', '--allow-missing-repository', '--out', vsix],
    { cwd: ext, stdio: ['pipe', 'inherit', 'inherit'], input: 'y\n' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

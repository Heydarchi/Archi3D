// Builds the VS Code extension in vscode/dist/:
//   extension.js      the extension (CommonJS, runs in VS Code's Node host)
//   media/preview.js  the 3D preview page (one script: app + layout worker + font inlined)
//   template.html     the standalone page with placeholders, filled in by "Export Standalone HTML…"
//
//   node scripts/build-vscode.mjs                         build only
//   node scripts/build-vscode.mjs --package               also write vscode/archi3d-<version>.vsix
//   node scripts/build-vscode.mjs --publisher <id>        set the Marketplace publisher ID in vscode/package.json
//   node scripts/build-vscode.mjs --publish               run the release checks, package and publish
//                                                         (log in once first: cd vscode && npx vsce login <id>)
import { spawnSync } from 'node:child_process';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { buildWorker, exportStandalone, standaloneModules } from './export-standalone.mjs';
import { publisherIdProblem, releaseProblems } from './release-checks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ext = join(root, 'vscode');
const out = join(ext, 'dist');
const tmp = join(root, 'dist', '.vscode-build');
const args = process.argv.slice(2);
const publish = args.includes('--publish');

// Must match vscode/src/host.ts.
const SOURCE_PLACEHOLDER = '__ARCHI3D_SOURCE_PLACEHOLDER__';
const NAME_PLACEHOLDER = '__ARCHI3D_NAME_PLACEHOLDER__';

const publisherAt = args.indexOf('--publisher');
if (publisherAt >= 0) {
  const id = args[publisherAt + 1];
  const problem = publisherIdProblem(id);
  if (problem) { console.error(`Publisher ID ${problem}`); process.exit(1); }
  const manifestFile = join(ext, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  if (manifest.publisher !== id) {
    manifest.publisher = id;
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`publisher set to "${id}" in vscode/package.json (commit this change)`);
  }
}
if (publish) {
  const problems = releaseProblems(ext);
  if (problems.length) { console.error(`Not ready to release:\n- ${problems.join('\n- ')}`); process.exit(1); }
}

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

if (args.includes('--package') || publish) {
  const { version } = JSON.parse(readFileSync(join(ext, 'package.json'), 'utf8'));
  const vsix = join(ext, `archi3d-${version}.vsix`);
  const vsce = join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
  const run = (...a) => {
    const r = spawnSync(process.execPath, [vsce, ...a], { cwd: ext, stdio: ['pipe', 'inherit', 'inherit'], input: 'y\n' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  };
  // The extension is in vscode/ of the repo, so README images and links must point there on GitHub.
  const repoBase = 'https://github.com/Heydarchi/Archi3D';
  run('package', '--no-dependencies', '--out', vsix,
    '--baseImagesUrl', `${repoBase}/raw/HEAD/vscode`, '--baseContentUrl', `${repoBase}/blob/HEAD/vscode`);
  if (publish) {
    run('publish', '--packagePath', vsix);
    console.log(`published ${vsix}`);
  }
}

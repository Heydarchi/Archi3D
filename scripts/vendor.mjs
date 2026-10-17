// Copies pinned runtime libraries and fonts from node_modules into vendor/ and
// writes vendor/manifest.json (package, version, sha256 per file).
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'vendor');

const jsm = 'examples/jsm';
const entries = [
  ['three', 'build/three.module.js', 'three/three.module.js'],
  ['three', 'build/three.core.js', 'three/three.core.js'],
  ['three', `${jsm}/controls/OrbitControls.js`, 'three/addons/controls/OrbitControls.js'],
  ['three', `${jsm}/renderers/CSS2DRenderer.js`, 'three/addons/renderers/CSS2DRenderer.js'],
  ['three', `${jsm}/lines/Line2.js`, 'three/addons/lines/Line2.js'],
  ['three', `${jsm}/lines/LineMaterial.js`, 'three/addons/lines/LineMaterial.js'],
  ['three', `${jsm}/lines/LineGeometry.js`, 'three/addons/lines/LineGeometry.js'],
  ['three', `${jsm}/lines/LineSegments2.js`, 'three/addons/lines/LineSegments2.js'],
  ['three', `${jsm}/lines/LineSegmentsGeometry.js`, 'three/addons/lines/LineSegmentsGeometry.js'],
  ['elkjs', 'lib/elk.bundled.js', 'elkjs/elk.bundled.js'],
  ['camera-controls', 'dist/camera-controls.module.js', 'camera-controls/camera-controls.module.js'],
  ['troika-three-text', 'dist/troika-three-text.esm.js', 'troika-three-text/troika-three-text.esm.js'],
  // troika reads WOFF/TTF/OTF but not WOFF2; @fontsource/inter ships WOFF (no TTF).
  ['@fontsource/inter', 'files/inter-latin-400-normal.woff', 'fonts/inter-latin-400-normal.woff'],
  ['@fontsource/inter', 'files/inter-latin-600-normal.woff', 'fonts/inter-latin-600-normal.woff'],
];

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const version = (pkg) => JSON.parse(readFileSync(join(nm, pkg, 'package.json'), 'utf8')).version;

rmSync(out, { recursive: true, force: true });
const files = [];
for (const [pkg, src, dest] of entries) {
  const from = join(nm, pkg, src);
  const to = join(out, dest);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  files.push({ path: dest, package: pkg, version: version(pkg), source: `${pkg}/${src}`, sha256: sha256(to) });
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`vendor: ${files.length} files -> ${relative(root, out)}/`);

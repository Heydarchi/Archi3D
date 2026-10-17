// Writes fixtures/gen-1000.arch3d from the seeded generator in src/core/gen.ts.
// Usage: node scripts/generate.mjs [components=1000] [seed=42]
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const components = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 42);
const { module } = await runnerImport(join(root, 'src/core/gen.ts'), { configFile: false, logLevel: 'silent' });
const out = join(root, 'fixtures', `gen-${components}.arch3d`);
writeFileSync(out, module.generateArch({ seed, components }));
console.log(`wrote ${out}`);

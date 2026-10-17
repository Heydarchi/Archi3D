// Fills offline/npm-cache so a later `npm ci --offline --cache offline/npm-cache`
// works with no internet.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'offline', 'npm-cache');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log(`> npm ci --cache ${cache}`);
const r = spawnSync(npm, ['ci', '--cache', cache], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('\nOffline install from now on:\n  npm ci --offline --cache offline/npm-cache');

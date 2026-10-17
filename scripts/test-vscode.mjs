// Runs tests/vscode/runner.cjs inside a real VS Code with the extension loaded from vscode/.
// Uses a throw-away profile and extensions folder under test-results/ (your VS Code setup is untouched).
//   VSCODE_BIN=/path/to/code node scripts/test-vscode.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.VSCODE_BIN,
  '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
  '/usr/share/code/code',
  '/usr/bin/code',
  `${process.env.LOCALAPPDATA}\\Programs\\Microsoft VS Code\\Code.exe`,
].filter(Boolean);
const bin = candidates.find((p) => existsSync(p));
if (!bin) { console.error('VS Code not found; set VSCODE_BIN.'); process.exit(1); }
if (!existsSync(join(root, 'vscode', 'dist', 'extension.js'))) { console.error('Build the extension first: npm run vscode:build'); process.exit(1); }

const it = join(root, 'test-results', 'vscode-it');
rmSync(it, { recursive: true, force: true });
const r = spawnSync(bin, [
  join(root, 'examples'),
  `--extensionDevelopmentPath=${join(root, 'vscode')}`,
  `--extensionTestsPath=${join(root, 'tests', 'vscode', 'runner.cjs')}`,
  `--user-data-dir=${join(it, 'user-data')}`,
  `--extensions-dir=${join(it, 'extensions')}`,
  '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--disable-telemetry', '--new-window',
], { stdio: 'inherit', timeout: 180_000 });

const resultFile = join(it, 'result.json');
const checks = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8')) : [];
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ''}`);
const ok = r.status === 0 && checks.length > 0 && checks.every((c) => c.ok);
console.log(ok ? `VS Code integration: ${checks.length} checks passed` : `VS Code integration FAILED (exit ${r.status})`);
process.exit(ok ? 0 : 1);

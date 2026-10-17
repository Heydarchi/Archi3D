import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs script without types
import { expectedNotices, runtimePackages } from '../../scripts/notices.mjs';

const root = join(import.meta.dirname, '..', '..');

describe('third-party notices', () => {
  const expected: Record<string, string> = expectedNotices();
  it('are up to date (run "npm run notices" after changing dependencies)', () => {
    for (const [file, text] of Object.entries(expected)) expect(readFileSync(file, 'utf8'), file).toBe(text);
  });
  it('list every runtime package with its licence text; the extension leaves out D2', () => {
    const app = readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    const ext = readFileSync(join(root, 'vscode', 'THIRD_PARTY_NOTICES.md'), 'utf8');
    for (const p of runtimePackages() as { name: string; version: string }[]) {
      expect(app).toContain(`## ${p.name} ${p.version}`);
      if (p.name !== '@terrastruct/d2') expect(ext).toContain(`## ${p.name} ${p.version}`);
    }
    expect(ext).not.toContain('@terrastruct/d2');
    expect(app).toContain('Eclipse Public License');
    expect(app).toContain('SIL OPEN FONT LICENSE');
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const core = join(import.meta.dirname, '..', '..', 'src', 'core');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('src/core stays pure', () => {
  it('has a src/core folder', () => expect(statSync(core).isDirectory()).toBe(true));
  for (const file of walk(core).filter((f) => /\.(ts|js)$/.test(f))) {
    it(file.slice(core.length + 1), () => {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/from\s+['"]three(\/[^'"]*)?['"]/);
      expect(src).not.toMatch(/\bdocument\./);
      expect(src).not.toMatch(/\bwindow\./);
    });
  }
});

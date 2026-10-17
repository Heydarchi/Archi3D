import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'vendor', 'manifest.json'), 'utf8')) as {
  files: { path: string; package: string; version: string; sha256: string }[];
};
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, { version: string }>;
};

describe('vendor/manifest.json', () => {
  it('lists files', () => expect(manifest.files.length).toBeGreaterThan(0));

  for (const f of manifest.files) {
    it(`${f.path} exists, matches its hash and the locked version`, () => {
      const file = join(root, 'vendor', f.path);
      expect(existsSync(file)).toBe(true);
      expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(f.sha256);
      expect(lock.packages[`node_modules/${f.package}`]?.version).toBe(f.version);
    });
  }

  it('ships no WOFF2 fonts (troika cannot read them)', () => {
    const fonts = manifest.files.filter((f) => f.path.startsWith('fonts/'));
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) expect(f.path).toMatch(/\.(woff|ttf|otf)$/);
  });
});

describe('package.json', () => {
  it('pins exact versions', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    for (const deps of [pkg.dependencies, pkg.devDependencies]) {
      for (const [name, v] of Object.entries(deps as Record<string, string>)) {
        expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }
  });
});

// The models in examples/ are used by docs/USER_GUIDE.md: keep them valid.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromMermaid } from '../../src/core/adapters/mermaid';
import { parse } from '../../src/core/dsl/parse';
import { buildModel } from '../../src/core/model/build';

const dir = join(import.meta.dirname, '..', '..', 'examples');

describe('examples/', () => {
  // Every model in every folder (1-tutorial, 2-basics, 3-systems...).
  const files = readdirSync(dir, { recursive: true }).map(String);
  for (const f of files.filter((x) => /\.(arch3d|mmd)$/.test(x)).sort()) {
    it(`${f} has no errors or warnings`, () => {
      const text = readFileSync(join(dir, f), 'utf8');
      const m = f.endsWith('.mmd') ? fromMermaid(text) : buildModel(parse(text));
      expect(m.diagnostics).toEqual([]);
      expect(m.edges.length).toBeGreaterThan(0);
    });
  }
  it('every folder has models, and no model sits outside a folder', () => {
    const top = readdirSync(dir, { withFileTypes: true });
    expect(top.filter((e) => e.isFile()).map((e) => e.name)).toEqual([]);
    for (const d of top.filter((e) => e.isDirectory())) expect(readdirSync(join(dir, d.name)).some((x) => /\.(arch3d|mmd)$/.test(x)), d.name).toBe(true);
  });
});

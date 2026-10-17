// The models in examples/ are used by docs/USER_GUIDE.md: keep them valid.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromMermaid } from '../../src/core/adapters/mermaid';
import { parse } from '../../src/core/dsl/parse';
import { buildModel } from '../../src/core/model/build';

const dir = join(import.meta.dirname, '..', '..', 'examples');

describe('examples/', () => {
  for (const f of readdirSync(dir).filter((x) => /\.(arch|mmd)$/.test(x)).sort()) {
    it(`${f} has no errors or warnings`, () => {
      const text = readFileSync(join(dir, f), 'utf8');
      const m = f.endsWith('.mmd') ? fromMermaid(text) : buildModel(parse(text));
      expect(m.diagnostics).toEqual([]);
      expect(m.edges.length).toBeGreaterThan(0);
    });
  }
});

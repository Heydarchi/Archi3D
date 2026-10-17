import { expect, it } from 'vitest';
import { parse } from '../../src/core/dsl/parse';
import { layout } from '../../src/core/layout';
import { buildModel } from '../../src/core/model/build';
import { fixture } from './helpers';

const edits: Record<string, (s: string) => string> = {
  'component in Catalog': (s) =>
    s.replace('    component SearchIndex  in: query', '    component SearchIndex  in: query\n    component Cache        in: get') + '\nCatalogAPI -> Cache.get\n',
  'external at top level': (s) => s + '\nexternal Audit in: log\nOrderAPI -> Audit.log\n',
  'external linked from BFF (the app test edit)': (s) => s + 'external Inventory in: stock\nBFF -> Inventory.stock : stock\n',
};

for (const [name, edit] of Object.entries(edits)) {
  it(`adding one component (${name}) moves unrelated components < 15% of the model width`, async () => {
    const src = fixture('northwind.arch3d');
    const before = buildModel(parse(src));
    const a = await layout(before);
    const b = await layout(buildModel(parse(edit(src))), {}, a);
    for (const n of Object.values(before.nodes).filter((x) => !x.container)) {
      const p = a.boxes[n.id], q = b.boxes[n.id];
      const moved = Math.hypot(p.x + p.w / 2 - (q.x + q.w / 2), p.y + p.h / 2 - (q.y + q.h / 2));
      expect(moved, n.id).toBeLessThan(0.15 * a.bounds.w);
    }
    // Sibling containers stacked in the same column keep their order (no swaps).
    for (const n of Object.values(before.nodes).filter((x) => x.container)) {
      const kids = n.children.filter((c) => before.nodes[c].container);
      for (const p of kids) for (const q of kids) {
        const [pa, qa] = [a.boxes[p], a.boxes[q]];
        const sameColumn = pa.x < qa.x + qa.w && qa.x < pa.x + pa.w;
        if (p < q && sameColumn) expect(Math.sign(b.boxes[p].y - b.boxes[q].y), `${p} / ${q}`).toBe(Math.sign(pa.y - qa.y));
      }
    }
  });
}

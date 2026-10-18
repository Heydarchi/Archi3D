import { beforeAll, describe, expect, it } from 'vitest';
import { splitEdges } from '../../src/core/lod/aggregate';
import { focusCamera } from '../../src/core/lod/focus';
import { lod as anyRule, type LodOptions } from '../../src/core/lod/lod';
import { lift } from '../../src/core/scene/lift';
import type { ArchModel, SceneSpec } from '../../src/core/types';

/** The tables in this file were written for the 'size' rule (still available as ?zoom=size). */
const lod = (...a: Parameters<typeof anyRule>) => anyRule(a[0], a[1], a[2], a[3], { rule: 'size', ...a[4] } as LodOptions);
import { laidOut } from './pipeline';

let m: ArchModel, s: SceneSpec;
beforeAll(async () => {
  const r = await laidOut('nested-deep');
  m = r.model;
  s = lift(r.model, r.layout);
});

describe('splitEdges', () => {
  it('far: links into a closed container become one aggregate per pair', () => {
    const r = lod(s, m, focusCamera(s, 'Platform', 4, 800));
    const { direct, aggregates } = splitEdges(m, r);
    expect(direct.size).toBe(0);
    expect(aggregates).toHaveLength(1);
    const [a] = aggregates;
    expect([a.from, a.to]).toEqual(['Merchant', 'Platform']);
    expect(a.ids).toEqual([m.edges.find((e) => e.from.node === 'Merchant')!.id]);
  });

  it('mid: links between two closed containers are grouped; open ends stay direct', () => {
    const r = lod(s, m, focusCamera(s, 'Platform', 2.2, 800));
    const { direct, aggregates } = splitEdges(m, r);
    const pairs = aggregates.map((a) => `${a.from}→${a.to}:${a.ids.length}`).sort();
    expect(pairs).toEqual(['Merchant→Payments:1', 'Payments→Messaging:1']);
    expect(direct.size).toBe(0);
  });

  it('near: everything open is direct', () => {
    const r = lod(s, m, focusCamera(s, 'Billing', 1.2, 800), undefined, { enabled: false });
    const { direct, aggregates } = splitEdges(m, r);
    expect(aggregates).toEqual([]);
    expect(direct.size).toBe(m.edges.length);
  });

  it('every visible link is either direct or in exactly one aggregate', () => {
    for (const k of [4, 2.2, 1.2]) {
      const r = lod(s, m, focusCamera(s, 'Platform', k, 800));
      const { direct, aggregates } = splitEdges(m, r);
      const all = [...direct, ...aggregates.flatMap((a) => a.ids)].sort();
      expect(all).toEqual([...r.visibleEdges].sort());
    }
  });
});

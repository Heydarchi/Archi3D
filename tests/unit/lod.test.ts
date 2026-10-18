import { beforeAll, describe, expect, it } from 'vitest';
import { lod } from '../../src/core/lod/lod';
import { ELEMENT_BUDGET } from '../../src/core/lod/readable';
import { focusCamera } from '../../src/core/lod/focus';
import { lift } from '../../src/core/scene/lift';
import type { ArchModel, CameraState, SceneSpec } from '../../src/core/types';
import { laidOut } from './pipeline';

let m: ArchModel, s: SceneSpec;
beforeAll(async () => {
  const { model, layout } = await laidOut('nested-deep');
  m = model;
  s = lift(model, layout);
});

/** Camera looking at a container from k × its footprint diagonal. */
const at = (id: string, k: number): CameraState => focusCamera(s, id, k, 800);

describe('lod(nested-deep) camera table', () => {
  it('far: Platform closed, everything inside hidden, Merchant → Invoicer visible', () => {
    const r = lod(s, m, at('Platform', 4));
    expect(r.containers.Platform).toBe('closed');
    for (const id of ['Payments', 'Messaging', 'Billing', 'Risk']) expect(r.containers[id], id).toBe('hidden');
    const e = m.edges.find((x) => x.from.node === 'Merchant')!;
    expect(r.visibleEdges.has(e.id)).toBe(true);
    // Edges with both ends inside closed Platform are hidden.
    const inner = m.edges.find((x) => x.from.node === 'Invoicer' && x.to.node === 'Ledger')!;
    expect(r.visibleEdges.has(inner.id)).toBe(false);
    expect(r.visibleLabels.has('Platform')).toBe(true);
    expect(r.visibleLabels.has('Invoicer')).toBe(false);
  });

  it('mid: Platform open, Payments and Messaging closed', () => {
    const r = lod(s, m, at('Platform', 2.2));
    expect(r.containers.Platform).toBe('open');
    expect(r.containers.Payments).toBe('closed');
    expect(r.containers.Messaging).toBe('closed');
    expect(r.containers.Billing).toBe('hidden');
    // Aggregated edge between two closed containers stays visible.
    const e = m.edges.find((x) => x.from.node === 'Invoicer' && x.to.node === 'Bus')!;
    expect(r.visibleEdges.has(e.id)).toBe(true);
    // ...but drawn as an aggregate, so its own label is not shown.
    expect(r.visibleLabels.has(`edge:${e.id}`)).toBe(false);
  });

  it('near Billing: Billing open, its port labels visible', () => {
    const r = lod(s, m, at('Billing', 1.2));
    expect(r.containers.Billing).toBe('open');
    expect(r.containers.Payments).toBe('open');
    expect(r.containers.Platform).toBe('open');
    expect(r.visibleLabels.has('Invoicer')).toBe(true);
    expect(r.visibleLabels.has('Invoicer.bill')).toBe(true);
    expect(r.visibleLabels.has('Ledger.post')).toBe(true);
  });

  it('near Billing: titles of the containers the camera is inside are hidden', () => {
    const r = lod(s, m, at('Billing', 1.2));
    expect(r.visibleLabels.has('Billing')).toBe(true);
    expect(r.visibleLabels.has('Payments')).toBe(false);
    expect(r.visibleLabels.has('Platform')).toBe(false);
  });

  it('far away nothing but containers get labels; port labels need size', () => {
    const r = lod(s, m, at('Platform', 2.2));
    expect([...r.visibleLabels].some((id) => id.includes('.'))).toBe(false);
  });
});

describe('hysteresis', () => {
  it('2.9 → 2.7 → 2.9 does not change state (starting closed)', () => {
    let r = lod(s, m, at('Platform', 3.5));
    expect(r.containers.Platform).toBe('closed');
    for (const k of [2.9, 2.7, 2.9]) {
      r = lod(s, m, at('Platform', k), r);
      expect(r.containers.Platform, `k=${k}`).toBe('closed');
    }
  });
  it('2.9 → 2.7 → 2.9 does not change state (starting open)', () => {
    let r = lod(s, m, at('Platform', 2));
    expect(r.containers.Platform).toBe('open');
    for (const k of [2.9, 2.7, 2.9]) {
      r = lod(s, m, at('Platform', k), r);
      expect(r.containers.Platform, `k=${k}`).toBe('open');
    }
  });
  it('crossing the thresholds does change state', () => {
    let r = lod(s, m, at('Platform', 2));
    r = lod(s, m, at('Platform', 3.1), r);
    expect(r.containers.Platform).toBe('closed');
    r = lod(s, m, at('Platform', 2.5), r);
    expect(r.containers.Platform).toBe('open');
  });
});

describe('options', () => {
  it('the selected container is forced open below ratio 3.4', () => {
    expect(lod(s, m, at('Platform', 3.2)).containers.Platform).toBe('closed');
    expect(lod(s, m, at('Platform', 3.2), undefined, { selected: 'Platform' }).containers.Platform).toBe('open');
    expect(lod(s, m, at('Platform', 3.6), undefined, { selected: 'Platform' }).containers.Platform).toBe('closed');
  });
  it('semantic zoom off: all open, all edges and labels visible', () => {
    const r = lod(s, m, at('Platform', 10), undefined, { enabled: false });
    expect(Object.values(r.containers).every((x) => x === 'open')).toBe(true);
    expect(r.visibleEdges.size).toBe(m.edges.length);
    expect(r.visibleLabels.size).toBe(s.labels.length);
  });
  it('is pure', () => {
    const before = JSON.stringify([s, m]);
    const a = lod(s, m, at('Billing', 1.2));
    expect(lod(s, m, at('Billing', 1.2))).toEqual(a);
    expect(JSON.stringify([s, m])).toBe(before);
  });
});

describe('lids', async () => {
  const { lidSpecs } = await import('../../src/core/lod/lids');
  it('cover the whole subtree of each container', () => {
    const lids = lidSpecs(s, m);
    const platform = lids.find((l) => l.id === 'Platform')!;
    const top = platform.center.y + platform.size.y / 2;
    for (const b of s.blocks.filter((x) => x.id !== 'Merchant')) expect(top).toBeGreaterThan(b.center.y + b.size.y / 2);
    const plate = s.plates.find((p) => p.id === 'Platform')!;
    expect(platform.center.y - platform.size.y / 2).toBeCloseTo(plate.center.y - plate.size.y / 2);
    expect([platform.size.x, platform.size.z]).toEqual([plate.size.x, plate.size.z]);
  });
});

describe('narrow views', () => {
  it('a tall, narrow view (aspect < 1) does not close what the same framing shows in a wide one', () => {
    const cam = at('Platform', 4);                       // closed in a wide view
    expect(lod(s, m, cam).containers.Platform).toBe('closed');
    expect(lod(s, m, { ...cam, aspect: 1.6 }).containers.Platform).toBe('closed');
    // In a half-width pane the camera has to stand twice as far back to fit the width.
    expect(lod(s, m, { ...cam, aspect: 0.4 }).containers.Platform).toBe('open');
  });
});

describe('zoom rule "readable"', () => {
  const open = (r: ReturnType<typeof lod>) => Object.entries(r.containers).filter(([, v]) => v === 'open').map(([k]) => k).sort();

  it('opens containers from further away than the size rule', () => {
    expect(open(lod(s, m, at('Platform', 3)))).toEqual([]);
    expect(open(lod(s, m, at('Platform', 3), undefined, { rule: 'readable' }))).toEqual(['Platform']);
    expect(open(lod(s, m, at('Platform', 2)))).toEqual(['Platform']);
    expect(open(lod(s, m, at('Platform', 2), undefined, { rule: 'readable' }))).toEqual(['Billing', 'Messaging', 'Payments', 'Platform', 'Risk']);
  });

  it('never puts more than the budget on screen', async () => {
    const { model, layout } = await laidOut('gen-1000');
    const big = lift(model, layout);
    const r = lod(big, model, focusCamera(big, model.roots[0], 3, 800), undefined, { rule: 'readable' });
    const onScreen = Object.values(model.nodes).filter((n) => !n.container || r.containers[n.id] === 'closed')
      .filter((n) => n.parent === null || r.containers[n.parent] === 'open').length;
    expect(onScreen).toBeLessThanOrEqual(ELEMENT_BUDGET);
  }, 60_000);
});

import { beforeAll, describe, expect, it } from 'vitest';
import { lift, DEFAULT_SCENE_OPTIONS, HEIGHT_FACTOR, PEDESTAL } from '../../src/core/scene/lift';
import type { ArchModel, Layout2D, SceneSpec, V3 } from '../../src/core/types';
import { laidOut } from './pipeline';

let m: ArchModel, l: Layout2D;
beforeAll(async () => ({ model: m, layout: l } = await laidOut('nested-deep')));

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const eqV = (a: V3, b: V3) => near(a.x, b.x) && near(a.y, b.y) && near(a.z, b.z);
const axes = (a: V3, b: V3) => [a.x !== b.x, a.y !== b.y, a.z !== b.z].filter(Boolean).length;
const allPoints = (s: SceneSpec): V3[] => [
  ...s.plates.flatMap((p) => corners(p.center, p.size)), ...s.blocks.flatMap((b) => corners(b.center, b.size)),
  ...s.ports.map((p) => p.pos), ...s.edges.flatMap((e) => e.points), ...s.labels.map((x) => x.anchor),
];
const corners = (c: V3, s: V3): V3[] => [-1, 1].flatMap((dx) => [-1, 1].flatMap((dy) => [-1, 1].map((dz) => ({ x: c.x + dx * s.x / 2, y: c.y + dy * s.y / 2, z: c.z + dz * s.z / 2 }))));

describe('lift(nested-deep)', () => {
  it('one plate per container, one block per component, one port spec per port', () => {
    const s = lift(m, l);
    const nodes = Object.values(m.nodes);
    expect(s.plates.map((p) => p.id).sort()).toEqual(nodes.filter((n) => n.container).map((n) => n.id).sort());
    expect(s.blocks.map((b) => b.id).sort()).toEqual(nodes.filter((n) => !n.container).map((n) => n.id).sort());
    expect(s.ports).toHaveLength(nodes.reduce((k, n) => k + n.ports.length, 0));
  });

  it('block bottom y equals depth × levelGap', () => {
    const s = lift(m, l, { levelGap: 60 });
    for (const b of s.blocks) expect(b.center.y - b.size.y / 2, b.id).toBeCloseTo(m.nodes[b.id].depth * 60);
  });

  it('plates sit at depth × levelGap with thickness 6', () => {
    const s = lift(m, l);
    for (const p of s.plates) {
      expect(p.size.y).toBe(6);
      expect(p.center.y - 3).toBeCloseTo(p.depth * DEFAULT_SCENE_OPTIONS.levelGap);
    }
  });

  it('is centred on the origin in x/z', () => {
    const s = lift(m, l);
    expect(s.bounds.min.x + s.bounds.max.x).toBeLessThan(80);
    expect(Math.abs(s.bounds.min.z + s.bounds.max.z)).toBeLessThan(80);
  });

  it('shapes: db and queue keep their shape; queue is lower', () => {
    const s = lift(m, l);
    const bus = s.blocks.find((b) => b.id === 'Bus')!;
    expect(bus.shape).toBe('queue');
    expect(bus.size.y).toBeLessThan(DEFAULT_SCENE_OPTIONS.blockHeight);
  });

  it('ports sit at mid-height of their block', () => {
    const s = lift(m, l);
    for (const p of s.ports) {
      const b = s.blocks.find((x) => x.id === p.owner);
      if (b) expect(p.pos.y, p.id).toBeCloseTo(b.center.y);
    }
  });

  for (const edgeMode of ['ortho', 'arc'] as const) {
    it(`${edgeMode}: each edge's first/last point equals its port's position`, () => {
      const s = lift(m, l, { edgeMode });
      for (const e of m.edges) {
        const spec = s.edges.find((x) => x.id === e.id)!;
        const pos = (id?: string) => s.ports.find((p) => p.id === id)!.pos;
        expect(eqV(spec.points[0], pos(e.from.port)), `${e.id} start`).toBe(true);
        expect(eqV(spec.points[spec.points.length - 1], pos(e.to.port)), `${e.id} end`).toBe(true);
      }
    });
  }

  it('ortho: every segment is axis-aligned in 3D', () => {
    for (const e of lift(m, l, { edgeMode: 'ortho' }).edges) {
      for (let i = 1; i < e.points.length; i++) expect(axes(e.points[i - 1], e.points[i]), `${e.id}#${i}`).toBe(1);
    }
  });

  it('ortho: runs at the higher endpoint height', () => {
    for (const e of lift(m, l, { edgeMode: 'ortho' }).edges) {
      const top = Math.max(e.points[0].y, e.points[e.points.length - 1].y);
      expect(Math.max(...e.points.map((p) => p.y)), e.id).toBeCloseTo(top);
    }
  });

  it('arc: 33 points, never below the lower end, apex above both ends', () => {
    for (const e of lift(m, l, { edgeMode: 'arc' }).edges) {
      const a = e.points[0], b = e.points[e.points.length - 1];
      expect(e.points).toHaveLength(33);
      for (const p of e.points) expect(p.y).toBeGreaterThanOrEqual(Math.min(a.y, b.y) - 1e-9);
      const apex = Math.max(...e.points.map((p) => p.y));
      const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      expect(apex).toBeGreaterThan(Math.max(a.y, b.y));
      expect(apex).toBeCloseTo(Math.max(a.y, b.y) + 0.32 * dist + 24, 0);
    }
  });

  it('doubling levelGap doubles plate y and leaves x/z unchanged', () => {
    const a = lift(m, l, { levelGap: 50 });
    const b = lift(m, l, { levelGap: 100 });
    a.plates.forEach((p, i) => {
      const q = b.plates[i];
      expect(q.center.y - 3).toBeCloseTo(2 * (p.center.y - 3));
      expect([q.center.x, q.center.z]).toEqual([p.center.x, p.center.z]);
    });
  });

  it('bounds contain every point of every element', () => {
    for (const edgeMode of ['ortho', 'arc'] as const) {
      const s = lift(m, l, { edgeMode });
      for (const p of allPoints(s)) {
        for (const k of ['x', 'y', 'z'] as const) {
          expect(p[k]).toBeGreaterThanOrEqual(s.bounds.min[k] - 1e-9);
          expect(p[k]).toBeLessThanOrEqual(s.bounds.max[k] + 1e-9);
        }
      }
    }
  });

  it('labels: container title at its front-left edge (alt: back-left), component name above its block, edge label set', () => {
    const s = lift(m, l);
    const plate = s.plates.find((p) => p.id === 'Billing')!;
    const title = s.labels.find((x) => x.id === 'Billing')!;
    expect(title.role).toBe('container');
    expect(title.anchor.x).toBeLessThan(plate.center.x - plate.size.x / 4);
    expect(title.anchor.z).toBeGreaterThan(plate.center.z + plate.size.z / 2); // just in front of the plate
    expect(title.alt!.x).toBe(title.anchor.x);
    expect(title.alt!.z).toBeLessThan(plate.center.z - plate.size.z / 4); // in the strip at the back
    const block = s.blocks.find((b) => b.id === 'Ledger')!;
    const name = s.labels.find((x) => x.id === 'Ledger')!;
    expect(name.role).toBe('component');
    expect(name.anchor.y).toBeGreaterThan(block.center.y + block.size.y / 2);
    expect(s.labels.filter((x) => x.role === 'port').map((x) => x.text)).toContain('bill');
    const e = s.edges.find((x) => x.label === 'InvoiceIssued')!;
    expect(e.labelAt).toBeDefined();
    expect(s.labels.find((x) => x.role === 'edge' && x.text === 'InvoiceIssued')).toBeDefined();
  });

  it('is deterministic and pure', () => {
    const before = JSON.stringify([m, l]);
    expect(lift(m, l)).toEqual(lift(m, l));
    expect(JSON.stringify([m, l])).toBe(before);
  });
});

describe('container links', () => {
  it('port-less container ends sit on the plate border at plate height', async () => {
    const { model, layout } = await laidOut('container-links');
    const s = lift(model, layout);
    const e = s.edges.find((x) => x.label === 'REST')!;
    const plate = s.plates.find((p) => p.id === 'Frontend')!;
    expect(e.points[0].y).toBeCloseTo(plate.center.y + plate.size.y / 2);
  });
});

describe('arcPath', async () => {
  const { arcPath, arcApex } = await import('../../src/core/scene/edgePaths');
  it('peaks at the apex height even with uneven ends', () => {
    const a = { x: 0, y: 0, z: 0 }, b = { x: 400, y: 180, z: 50 };
    const pts = arcPath(a, b);
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(arcApex(a, b), 0);
  });
});

describe('lift: kinds, titles and shapes', () => {
  let k: ArchModel, kl: Layout2D, s: SceneSpec;
  beforeAll(async () => { ({ model: k, layout: kl } = await laidOut('kinds')); s = lift(k, kl); });

  it('edges carry their kind', () => {
    expect(s.edges.map((e) => e.kind)).toEqual(k.edges.map((e) => e.kind));
    expect(new Set(s.edges.map((e) => e.kind))).toEqual(new Set(['call', 'message', 'event', 'session', 'stream', 'shared']));
  });
  it('labels show the title when there is one', () => {
    expect(s.labels.find((x) => x.id === 'Camera')!.text).toBe('Camera app');
    expect(s.labels.find((x) => x.id === 'Device')!.text).toBe('Device');
  });
  it('block heights follow the shape', () => {
    for (const b of s.blocks) expect(b.size.y, b.id).toBeCloseTo(DEFAULT_SCENE_OPTIONS.blockHeight * HEIGHT_FACTOR[b.shape]);
  });
  it('links to a person, ui or app attach at its base', () => {
    const p = s.ports.find((x) => x.owner === 'Person')!;
    const b = s.blocks.find((x) => x.id === 'Person')!;
    const bottom = b.center.y - b.size.y / 2;
    expect(p.pos.y).toBeCloseTo(bottom + (b.size.y * PEDESTAL.person!) / 2);
  });
});

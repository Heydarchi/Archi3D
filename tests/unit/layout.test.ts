import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/dsl/parse';
import { layout } from '../../src/core/layout';
import { toElk } from '../../src/core/layout/toElk';
import { buildModel } from '../../src/core/model/build';
import type { ArchModel, Layout2D, Pt, Rect } from '../../src/core/types';
import { fixture, validFixtures } from './helpers';

const model = (f: string) => buildModel(parse(fixture(f)));
const inside = (c: Rect, p: Rect, pad: number) =>
  c.x >= p.x + pad - 0.5 && c.y >= p.y + pad - 0.5 && c.x + c.w <= p.x + p.w - pad + 0.5 && c.y + c.h <= p.y + p.h - pad + 0.5;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const onBorder = (p: Pt, r: Rect) =>
  p.x >= r.x - 1 && p.x <= r.x + r.w + 1 && p.y >= r.y - 1 && p.y <= r.y + r.h + 1 &&
  (Math.abs(p.x - r.x) <= 1 || Math.abs(p.x - r.x - r.w) <= 1 || Math.abs(p.y - r.y) <= 1 || Math.abs(p.y - r.y - r.h) <= 1);

describe.each(validFixtures())('%s', (f) => {
  let m: ArchModel;
  let l: Layout2D;
  it('lays out', async () => {
    m = model(f);
    l = await layout(m);
    expect(Object.keys(l.boxes).sort()).toEqual(Object.keys(m.nodes).sort());
    expect(Object.keys(l.routes).sort()).toEqual(m.edges.map((e) => e.id).sort());
  });

  it('every child lies inside its parent (with padding)', () => {
    for (const n of Object.values(m.nodes)) {
      if (n.parent) expect(inside(l.boxes[n.id], l.boxes[n.parent], 8), `${n.id} in ${n.parent}`).toBe(true);
      else expect(inside(l.boxes[n.id], l.bounds, 0), `${n.id} in bounds`).toBe(true);
    }
  });

  it('no two siblings overlap', () => {
    const groups = [m.roots, ...Object.values(m.nodes).map((n) => n.children)];
    for (const g of groups) {
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        expect(overlap(l.boxes[g[i]], l.boxes[g[j]]), `${g[i]} / ${g[j]}`).toBe(false);
      }
    }
  });

  it('routes start and end on their ports (or the container border)', () => {
    for (const e of m.edges) {
      const r = l.routes[e.id];
      expect(r.length).toBeGreaterThanOrEqual(2);
      const first = r[0], last = r[r.length - 1];
      if (e.from.port) expect(dist(first, l.ports[e.from.port]), `${e.id} start`).toBeLessThanOrEqual(1);
      else expect(onBorder(first, l.boxes[e.from.node]), `${e.id} start on border`).toBe(true);
      if (e.to.port) expect(dist(last, l.ports[e.to.port]), `${e.id} end`).toBeLessThanOrEqual(1);
      else expect(onBorder(last, l.boxes[e.to.node]), `${e.id} end on border`).toBe(true);
    }
  });

  it('every port sits on its side of its box', () => {
    for (const n of Object.values(m.nodes)) {
      const b = l.boxes[n.id];
      for (const p of n.ports) {
        const c = l.ports[p.id];
        expect(Math.abs(c.x - (p.dir === 'in' ? b.x : b.x + b.w)), p.id).toBeLessThanOrEqual(6);
        expect(c.y > b.y && c.y < b.y + b.h, p.id).toBe(true);
      }
    }
  });

  it('every route segment is horizontal or vertical', () => {
    for (const [id, r] of Object.entries(l.routes)) {
      for (let i = 1; i < r.length; i++) {
        const dx = Math.abs(r[i].x - r[i - 1].x), dy = Math.abs(r[i].y - r[i - 1].y);
        expect(Math.min(dx, dy), `${id} segment ${i}`).toBeLessThan(0.01);
      }
    }
  });

  it('is deterministic', async () => {
    expect(await layout(m)).toEqual(l);
  });
});

describe('toElk', () => {
  const g = toElk(model('northwind.arch'));
  it('sets the layered options', () => {
    expect(g.layoutOptions).toMatchObject({
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.edgeRouting': 'ORTHOGONAL',
    });
  });
  it('puts in ports WEST and out ports EAST with FIXED_SIDE', () => {
    const nw = g.children!.find((c) => c.id === 'Northwind')!;
    const ordering = nw.children!.find((c) => c.id === 'Ordering')!;
    const api = ordering.children!.find((c) => c.id === 'OrderAPI')!;
    expect(api.layoutOptions?.['elk.portConstraints']).toBe('FIXED_SIDE');
    const side = (id: string) => api.ports!.find((p) => p.id === id)!.layoutOptions!['elk.port.side'];
    expect(side('OrderAPI.orders')).toBe('WEST');
    expect(side('OrderAPI.db')).toBe('EAST');
    expect(api.width).toBeGreaterThanOrEqual(120);
    expect(api.height).toBeGreaterThanOrEqual(3 * 24 + 24);
  });
  it('gives containers room for a title', () => {
    const nw = g.children!.find((c) => c.id === 'Northwind')!;
    expect(nw.layoutOptions?.['elk.padding']).toMatch(/top=4\d/);
  });
});

describe('edge offsets (elkjs lca gotcha)', () => {
  it('deeply nested edges land on their ports', async () => {
    const m = model('nested-deep.arch');
    const l = await layout(m);
    const e = m.edges.find((x) => x.lca === 'Billing')!;
    expect(dist(l.routes[e.id][0], l.ports[e.from.port!])).toBeLessThanOrEqual(1);
  });
});

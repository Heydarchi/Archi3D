import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from '../../src/core/dsl/parse';
import { fadedFloors, focusFloor } from '../../src/core/lod/floorFade';
import { lod } from '../../src/core/lod/lod';
import { buildModel } from '../../src/core/model/build';
import { lift } from '../../src/core/scene/lift';
import type { ArchModel, CameraState, SceneSpec, V3 } from '../../src/core/types';
import { laidOut } from './pipeline';

let m: ArchModel, s: SceneSpec;
beforeAll(async () => { const r = await laidOut('layers'); m = r.model; s = lift(m, r.layout); });

const cam = (position: V3, target: V3): CameraState => ({ position, target, fovDeg: 40, viewportH: 800, aspect: 1.6 });
const floor = (id: string) => s.floors!.find((f) => f.id === id)!;

describe('layers as floors', () => {
  it('one floor per layer, the first written on top', () => {
    expect(s.floors!.map((f) => f.id)).toEqual(['Top', 'Middle', 'Bottom']);
    expect(floor('Top').y).toBeGreaterThan(floor('Middle').y);
    expect(floor('Middle').y).toBeGreaterThan(floor('Bottom').y);
    expect(floor('Bottom').y).toBe(0);
    for (const f of s.floors!) expect(f.top).toBeGreaterThan(f.y);
  });

  it('everything stands on its floor; floors are stacked over the same centre', () => {
    const block = (id: string) => s.blocks.find((b) => b.id === id)!;
    expect(block('Screen').floor).toBe('Top');
    expect(block('Disk').floor).toBe('Bottom');
    expect(block('Screen').center.y).toBeGreaterThan(floor('Top').y);
    expect(block('Screen').center.y).toBeLessThan(floor('Top').top);
    expect(Math.abs(floor('Top').center.x - floor('Bottom').center.x)).toBeLessThan(1e-6);
  });

  it('an element outside the layers stands next to the floor it links to', () => {
    const person = s.blocks.find((b) => b.id === 'Person')!;
    expect(person.floor).toBe('Top');
    expect(person.center.x + person.size.x / 2).toBeLessThan(floor('Top').center.x - floor('Top').size.x / 2);
  });

  it('links between floors go straight from port to port; links on one floor keep their route', () => {
    const edge = (a: string, b: string) => s.edges[m.edges.findIndex((e) => e.from.node === a && e.to.node === b)];
    const down = edge('Api', 'Disk').points;
    expect(down).toHaveLength(2);
    expect(down[0].y).toBeGreaterThan(floor('Middle').y);
    expect(down[1].y).toBeLessThan(floor('Middle').y);
    // On one floor the link stays inside that floor's height band.
    for (const p of edge('Api', 'Worker').points) expect(p.y > floor('Middle').y && p.y < floor('Middle').top).toBe(true);
  });

  it('a model without layers has no floors', async () => {
    const { model, layout } = await laidOut('northwind');
    const flat = lift(model, layout);
    expect(flat.floors).toBeUndefined();
    expect(flat.blocks.every((b) => b.floor === undefined)).toBe(true);
  });

  it('W203: a layer must be a top-level container', () => {
    const inside = buildModel(parse('system S {\n  layer L {\n  }\n}'));
    expect(inside.diagnostics.map((d) => d.code)).toEqual(['W203']);
    const flat = buildModel(parse('layer L'));
    expect(flat.diagnostics.map((d) => d.code)).toEqual(['W203']);
  });
});

describe('fading the floors above', () => {
  const middle = () => floor('Middle');
  const at = () => ({ x: middle().center.x, y: middle().y + 20, z: middle().center.z });

  it('the floor you look at is the one whose band holds the camera target', () => {
    expect(focusFloor(s, cam({ x: 0, y: 900, z: 400 }, at()))).toBe('Middle');
  });
  it('close above the middle floor: the top floor fades, the bottom one does not', () => {
    const c = cam({ x: at().x, y: at().y + 250, z: at().z + 250 }, at());
    expect([...fadedFloors(s, c)]).toEqual(['Top']);
    const r = lod(s, m, c);
    expect(r.fadedFloors).toEqual(new Set(['Top']));
    expect(r.visibleLabels.has('Phone')).toBe(false);
  });
  it('from far away nothing fades', () => {
    expect(fadedFloors(s, cam({ x: at().x, y: 5000, z: 5000 }, at())).size).toBe(0);
  });
});

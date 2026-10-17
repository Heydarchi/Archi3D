import { describe, expect, it } from 'vitest';
import { focusCamera } from '../../src/core/lod/focus';
import { lod } from '../../src/core/lod/lod';
import { generateArch } from '../../src/core/gen';
import { parse } from '../../src/core/dsl/parse';
import { layout } from '../../src/core/layout';
import { buildModel } from '../../src/core/model/build';
import { lift } from '../../src/core/scene/lift';
import type { CameraState } from '../../src/core/types';
import { fixture } from './helpers';

describe('generator', () => {
  it('is deterministic for a seed', () => {
    expect(generateArch({ seed: 7, components: 200 })).toBe(generateArch({ seed: 7, components: 200 }));
    expect(generateArch({ seed: 7, components: 200 })).not.toBe(generateArch({ seed: 8, components: 200 }));
  });
  it('fixtures/gen-1000.arch3d is what the generator makes for seed 42', () => {
    expect(fixture('gen-1000.arch3d')).toBe(generateArch({ seed: 42, components: 1000 }));
  });
  it('makes a valid model with exactly 1000 components, links mostly within a system', () => {
    const m = buildModel(parse(fixture('gen-1000.arch3d')));
    expect(m.diagnostics).toEqual([]);
    const nodes = Object.values(m.nodes);
    expect(nodes.filter((n) => !n.container)).toHaveLength(1000);
    expect(m.roots).toHaveLength(8);
    const system = (id: string) => { let n = m.nodes[id]; while (n.parent) n = m.nodes[n.parent]; return n.id; };
    const inside = m.edges.filter((e) => system(e.from.node) === system(e.to.node)).length;
    expect(inside / m.edges.length).toBeGreaterThan(0.85);
  });
});

describe('gen-1000 at scale', () => {
  const model = buildModel(parse(fixture('gen-1000.arch3d')));

  it('lays out in under 8 s in Node', async () => {
    const t0 = performance.now();
    const l = await layout(model);
    const ms = performance.now() - t0;
    console.log(`gen-1000 layout: ${(ms / 1000).toFixed(2)} s`);
    expect(ms).toBeLessThan(8000);
    expect(Object.keys(l.boxes)).toHaveLength(Object.keys(model.nodes).length);

    // lod() for 1,000 nodes runs under 2 ms (median of repeated calls, after warm-up).
    const scene = lift(model, l);
    const cams: CameraState[] = [focusCamera(scene, 'Sys1', 3.5, 800), focusCamera(scene, 'Sys1', 1.5, 800), focusCamera(scene, 'S1C1', 1, 800)];
    let prev;
    for (let i = 0; i < 20; i++) prev = lod(scene, model, cams[i % 3], prev);
    const times: number[] = [];
    for (let i = 0; i < 60; i++) {
      const t = performance.now();
      prev = lod(scene, model, cams[i % 3], prev);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const median = times[times.length >> 1];
    console.log(`lod() median: ${median.toFixed(3)} ms`);
    expect(median).toBeLessThan(2);
  }, 30_000);
});

describe('label budget', () => {
  it('at most 150 labels, nearest first', async () => {
    const model = buildModel(parse(fixture('gen-1000.arch3d')));
    const scene = lift(model, await layout(model));
    const cam = focusCamera(scene, 'Sys1', 4, 800);
    const all = lod(scene, model, cam, undefined, { enabled: false });
    expect(all.visibleLabels.size).toBeGreaterThan(150);
    const capped = lod(scene, model, cam, undefined, { enabled: false, maxLabels: 150 });
    expect(capped.visibleLabels.size).toBe(150);
    const d = (id: string) => {
      const l = scene.labels.find((x) => x.id === id)!;
      return Math.hypot(l.anchor.x - cam.position.x, l.anchor.y - cam.position.y, l.anchor.z - cam.position.z);
    };
    const farthestKept = Math.max(...[...capped.visibleLabels].map(d));
    const nearestDropped = Math.min(...[...all.visibleLabels].filter((id) => !capped.visibleLabels.has(id)).map(d));
    expect(farthestKept).toBeLessThanOrEqual(nearestDropped);
    // The default applies the budget.
    expect(lod(scene, model, focusCamera(scene, 'S1C1', 0.6, 800)).visibleLabels.size).toBeLessThanOrEqual(150);
  });
});

describe('draw calls', () => {
  it('the view for gen-1000 uses fewer than 60 draw calls', async () => {
    const { buildSceneObjects, countDrawCalls } = await import('../../src/render/build');
    const model = buildModel(parse(fixture('gen-1000.arch3d')));
    const scene = lift(model, await layout(model));
    const objects = buildSceneObjects(scene, undefined, model);
    const n = countDrawCalls(objects.root);
    console.log(`gen-1000 draw calls: ${n}`);
    expect(n).toBeLessThan(60);
  });
});

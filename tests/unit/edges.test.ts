import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { lift } from '../../src/core/scene/lift';
import type { ArchModel, Layout2D } from '../../src/core/types';
import { ARROW, arrowTransform, EdgeBatch } from '../../src/render/edges';
import { LIGHT } from '../../src/render/palette';
import { laidOut } from './pipeline';

let m: ArchModel, l: Layout2D;
beforeAll(async () => ({ model: m, layout: l } = await laidOut('northwind')));

describe('edges', () => {
  it('arrowhead cone points along the last segment, tip on the port', () => {
    for (const edgeMode of ['ortho', 'arc'] as const) {
      for (const e of lift(m, l, { edgeMode }).edges) {
        const t = arrowTransform(e.points);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(t.quaternion);
        const a = e.points[e.points.length - 2], b = e.points[e.points.length - 1];
        const last = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
        expect(up.dot(last), `${edgeMode} ${e.id}`).toBeGreaterThan(0.99);
        const tip = t.position.clone().addScaledVector(up, ARROW.height / 2);
        expect(tip.distanceTo(new THREE.Vector3(b.x, b.y, b.z))).toBeLessThan(0.01);
      }
    }
  });

  it('async edges go to the dashed batch; sync edges to the solid one', () => {
    const scene = lift(m, l);
    const batch = new EdgeBatch(scene.edges, LIGHT);
    const solid = batch.solid.material as LineMaterial, dashed = batch.dashed.material as LineMaterial;
    expect([solid.dashed, dashed.dashed]).toEqual([false, true]);
    expect([solid.linewidth, solid.worldUnits]).toEqual([2, false]);
    const segments = (async: boolean) => scene.edges.filter((e) => e.async === async).reduce((k, e) => k + e.points.length - 1, 0);
    expect(batch.solid.geometry.getAttribute('instanceStart').count).toBe(segments(false));
    expect(batch.dashed.geometry.getAttribute('instanceStart').count).toBe(segments(true));
    expect(scene.edges.some((e) => e.async)).toBe(true);
  });

  it('hiding edges removes their segments and arrows', () => {
    const scene = lift(m, l);
    const batch = new EdgeBatch(scene.edges, LIGHT);
    const keep = scene.edges.filter((e) => !e.async).slice(0, 2);
    batch.update(new Set(keep.map((e) => e.id)), () => new THREE.Color(0xff0000));
    expect(batch.dashed.visible).toBe(false);
    expect(batch.solid.geometry.getAttribute('instanceStart').count).toBe(keep.reduce((k, e) => k + e.points.length - 1, 0));
    expect(batch.arrows.ids.filter((id) => batch.arrows.isShown(id))).toEqual(keep.map((e) => e.id));
  });

  it('edgeMode changes the point count: ortho ≤ 10, arc = 33', () => {
    for (const e of lift(m, l, { edgeMode: 'ortho' }).edges) expect(e.points.length, e.id).toBeLessThanOrEqual(10);
    for (const e of lift(m, l, { edgeMode: 'arc' }).edges) expect(e.points).toHaveLength(33);
  });

  it('updates the line resolution', () => {
    const batch = new EdgeBatch(lift(m, l).edges, LIGHT);
    batch.setResolution(640, 480);
    expect((batch.solid.material as LineMaterial).resolution.toArray()).toEqual([640, 480]);
    expect((batch.dashed.material as LineMaterial).resolution.toArray()).toEqual([640, 480]);
  });
});

describe('edge batch aggregates', () => {
  it('rebuilds when an aggregate changes shape but keeps its ends', () => {
    const batch = new EdgeBatch(lift(m, l).edges, LIGHT);
    const c = new THREE.Color(0x123456);
    const a = { x: 0, y: 0, z: 0 }, b = { x: 100, y: 0, z: 0 };
    batch.update(new Set(), () => c, () => 1, [{ points: [a, { x: 50, y: 10, z: 0 }, b], color: c }]);
    const before = batch.aggregate.geometry;
    batch.update(new Set(), () => c, () => 1, [{ points: [a, { x: 50, y: 80, z: 0 }, b], color: c }]);
    expect(batch.aggregate.geometry).not.toBe(before);
  });
});

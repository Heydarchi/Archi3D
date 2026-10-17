import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { lift } from '../../src/core/scene/lift';
import { corners } from '../../src/core/scene/vec';
import type { ArchModel, SceneSpec } from '../../src/core/types';
import { buildSceneObjects, countDrawCalls, SceneRoot } from '../../src/render/build';
import { cameraPose, toPerspective } from '../../src/render/poses';
import { laidOut } from './pipeline';

let scene: SceneSpec, model: ArchModel;
beforeAll(async () => {
  const r = await laidOut('northwind');
  model = r.model;
  scene = lift(r.model, r.layout);
});

describe('buildSceneObjects', () => {
  it('creates exactly one instance per plate, block and port', () => {
    const g = buildSceneObjects(scene, undefined, model);
    expect(g.plates.ids.sort()).toEqual(scene.plates.map((p) => p.id).sort());
    expect([...g.blocks.ids, ...g.cylinders.ids].sort()).toEqual(scene.blocks.map((b) => b.id).sort());
    expect(g.cylinders.ids.sort()).toEqual(scene.blocks.filter((b) => b.shape === 'db').map((b) => b.id).sort());
    expect(g.ports.ids.sort()).toEqual(scene.ports.map((p) => p.id).sort());
    expect(g.ports.mesh.count).toBe(scene.ports.length);
    expect(g.edges.ids).toEqual(scene.edges.map((e) => e.id));
  });

  it('places a block at its spec centre with its spec size', () => {
    const g = buildSceneObjects(scene, undefined, model);
    const spec = scene.blocks.find((b) => b.id === 'OrderDB')!;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    g.cylinders.matrixOf('OrderDB')!.decompose(p, q, s);
    expect(p.toArray()).toEqual([spec.center.x, spec.center.y, spec.center.z]);
    expect(s.toArray()).toEqual([spec.size.x, spec.size.y, spec.size.z]);
    expect(g.cylinders.mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
  });

  it('colours ports by direction', () => {
    const g = buildSceneObjects(scene);
    const inId = scene.ports.find((x) => x.dir === 'in')!.id;
    const outId = scene.ports.find((x) => x.dir === 'out')!.id;
    expect(g.ports.colorOf(inId).getHex()).not.toBe(g.ports.colorOf(outId).getHex());
  });

  it('lids start hidden, one per container', () => {
    const g = buildSceneObjects(scene, undefined, model);
    expect(g.lids.ids.sort()).toEqual(scene.plates.map((p) => p.id).sort());
    expect(g.lids.ids.every((id) => !g.lids.isShown(id))).toBe(true);
  });

  it('uses a handful of draw calls regardless of size', () => {
    expect(countDrawCalls(buildSceneObjects(scene, undefined, model).root)).toBeLessThanOrEqual(10);
  });
});

describe('SceneRoot', () => {
  it('disposes the old geometries and materials on setScene', () => {
    const root = new SceneRoot();
    root.setScene(scene, model);
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];
    root.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geos.push(m.geometry);
      if (m.material) mats.push(...([] as THREE.Material[]).concat(m.material));
    });
    const gSpies = geos.map((g) => vi.spyOn(g, 'dispose'));
    const mSpies = mats.map((m) => vi.spyOn(m, 'dispose'));
    root.setScene(scene, model);
    expect(geos.length).toBeGreaterThanOrEqual(8);
    for (const s of [...gSpies, ...mSpies]) expect(s).toHaveBeenCalled();
    expect(root.group.children.length).toBeGreaterThan(0);
  });

  it('dispose() empties the root', () => {
    const root = new SceneRoot();
    root.setScene(scene);
    root.dispose();
    expect(root.group.children).toHaveLength(0);
  });
});

describe('camera poses', () => {
  const frustumOf = (pose: ReturnType<typeof cameraPose>, aspect: number) => {
    const cam = toPerspective(pose, aspect);
    cam.updateMatrixWorld();
    return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  };
  const boundsCorners = () => {
    const { min, max } = scene.bounds;
    const c = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
    return corners(c, { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z });
  };

  for (const aspect of [1280 / 800, 0.6]) {
    it(`far frustum contains all eight corners of bounds (aspect ${aspect.toFixed(2)})`, () => {
      const f = frustumOf(cameraPose('far', scene, aspect, 800), aspect);
      for (const p of boundsCorners()) expect(f.containsPoint(new THREE.Vector3(p.x, p.y, p.z))).toBe(true);
    });
    it(`iso frustum contains all eight corners of bounds (aspect ${aspect.toFixed(2)})`, () => {
      const f = frustumOf(cameraPose('iso', scene, aspect, 800), aspect);
      for (const p of boundsCorners()) expect(f.containsPoint(new THREE.Vector3(p.x, p.y, p.z))).toBe(true);
    });
  }

  it('iso looks down at 45°; all poses stay above ground', () => {
    const iso = cameraPose('iso', scene, 1.6, 800);
    const d = { x: iso.position.x - iso.target.x, y: iso.position.y - iso.target.y, z: iso.position.z - iso.target.z };
    expect((Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI).toBeCloseTo(45, 5);
    for (const p of ['far', 'mid', 'near', 'iso'] as const) expect(cameraPose(p, scene, 1.6, 800).position.y).toBeGreaterThan(0);
  });

  it('mid is closer than far, near closer than mid', () => {
    const dist = (p: ReturnType<typeof cameraPose>) => Math.hypot(p.position.x - p.target.x, p.position.y - p.target.y, p.position.z - p.target.z);
    const [far, mid, near] = (['far', 'mid', 'near'] as const).map((p) => dist(cameraPose(p, scene, 1.6, 800)));
    expect(mid).toBeCloseTo(far * 0.4, 5);
    expect(near).toBeLessThan(mid);
  });
});

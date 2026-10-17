import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { breadcrumb, connectedEdges, highlightSet, isInside, neighbours } from '../../src/core/model/query';
import { lift } from '../../src/core/scene/lift';
import { corners } from '../../src/core/scene/vec';
import type { ArchModel, SceneSpec } from '../../src/core/types';
import { flyTarget, toPerspective } from '../../src/render/poses';
import { laidOut } from './pipeline';

let m: ArchModel, s: SceneSpec;
beforeAll(async () => {
  const { model, layout } = await laidOut('northwind');
  m = model;
  s = lift(model, layout);
});
const pair = (e: { from: { node: string }; to: { node: string } }) => `${e.from.node}→${e.to.node}`;

describe('connectedEdges', () => {
  it('for Ordering: exactly the links with one end inside and one outside', () => {
    const got = connectedEdges(m, 'Ordering').map(pair).sort();
    expect(got).toEqual(['BFF→OrderAPI', 'EventBus→Fulfilment', 'Fulfilment→Carrier', 'OrderAPI→EventBus', 'OrderAPI→PaymentGateway'].sort());
  });
  it('for a component: its direct links', () => {
    expect(connectedEdges(m, 'OrderAPI').map(pair).sort()).toEqual(
      ['BFF→OrderAPI', 'OrderAPI→EventBus', 'OrderAPI→OrderDB', 'OrderAPI→PaymentGateway'].sort());
  });
  it('for Northwind: links that cross its border', () => {
    expect(connectedEdges(m, 'Northwind').map(pair).sort()).toEqual(
      ['Customer→WebApp', 'Fulfilment→Carrier', 'OrderAPI→PaymentGateway'].sort());
  });
});

describe('hierarchy helpers', () => {
  it('breadcrumb for OrderDB is [Northwind, Ordering]', () => expect(breadcrumb(m, 'OrderDB')).toEqual(['Northwind', 'Ordering']));
  it('breadcrumb for a root is empty', () => expect(breadcrumb(m, 'Customer')).toEqual([]));
  it('isInside', () => {
    expect(isInside(m, 'OrderDB', 'Northwind')).toBe(true);
    expect(isInside(m, 'Ordering', 'Ordering')).toBe(true);
    expect(isInside(m, 'Customer', 'Northwind')).toBe(false);
  });
  it('neighbours: depends on / used by', () => {
    expect(neighbours(m, 'OrderAPI')).toEqual({ dependsOn: ['OrderDB', 'EventBus', 'PaymentGateway'], usedBy: ['BFF'] });
    expect(neighbours(m, 'Ordering')).toEqual({ dependsOn: ['EventBus', 'PaymentGateway', 'Carrier'], usedBy: ['BFF', 'EventBus'] });
  });
  it('highlightSet: the selection, its contents and the other ends of its links', () => {
    const h = highlightSet(m, 'OrderAPI');
    expect([...h.nodes].sort()).toEqual(['BFF', 'EventBus', 'OrderAPI', 'OrderDB', 'PaymentGateway']);
    expect(h.edges.size).toBe(4);
    const c = highlightSet(m, 'Ordering');
    for (const id of ['Ordering', 'OrderAPI', 'OrderDB', 'Fulfilment', 'BFF', 'Carrier']) expect(c.nodes.has(id), id).toBe(true);
    expect(c.nodes.has('UserDB')).toBe(false);
  });
});

describe('fly target', () => {
  it('for a component frames its block (frustum contains the block corners)', () => {
    const aspect = 1280 / 800;
    for (const id of ['OrderAPI', 'Customer', 'OrderDB']) {
      const b = s.blocks.find((x) => x.id === id)!;
      const cam = toPerspective(flyTarget(s, m, id, aspect, 800)!, aspect);
      cam.updateMatrixWorld();
      const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      for (const p of corners(b.center, b.size)) expect(f.containsPoint(new THREE.Vector3(p.x, p.y, p.z)), id).toBe(true);
      // ...and it is a close-up, not the whole model.
      const t = cam.position.distanceTo(new THREE.Vector3(b.center.x, b.center.y, b.center.z));
      expect(t).toBeLessThan(Math.hypot(s.bounds.max.x - s.bounds.min.x, s.bounds.max.z - s.bounds.min.z));
    }
  });
  it('for a container frames its plate', () => {
    expect(flyTarget(s, m, 'Ordering', 1.6, 800)).not.toBeNull();
    expect(flyTarget(s, m, 'Nope', 1.6, 800)).toBeNull();
  });
});

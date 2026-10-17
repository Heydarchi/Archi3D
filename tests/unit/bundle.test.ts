import { beforeAll, describe, expect, it } from 'vitest';
import { bundleControlPoints, bundlePath, bsplinePoints, straighten, treePath, ROOT } from '../../src/core/scene/bundle';
import { lidSpecs } from '../../src/core/lod/lids';
import { lift } from '../../src/core/scene/lift';
import type { ArchModel, SceneSpec } from '../../src/core/types';
import { laidOut } from './pipeline';

let m: ArchModel, s: SceneSpec;
beforeAll(async () => {
  const r = await laidOut('nested-deep');
  m = r.model;
  s = lift(r.model, r.layout);
});

describe('tree path', () => {
  it('goes up from the source to the lowest common container and down to the target', () => {
    expect(treePath(m, 'Invoicer', 'Scorer')).toEqual(['Billing', 'Payments', 'Risk']);
    expect(treePath(m, 'Bus', 'Mailer')).toEqual(['Messaging']);
    expect(treePath(m, 'Payments', 'Messaging')).toEqual(['Platform']);
  });
  it('passes through a virtual root when the ends share no container', () => {
    expect(treePath(m, 'Merchant', 'Invoicer')).toEqual([ROOT, 'Platform', 'Payments', 'Billing']);
  });
});

describe('bundled control points', () => {
  it('follow the tree path: each is a container centre raised above its lid', () => {
    const lids = new Map(lidSpecs(s, m).map((l) => [l.id, l]));
    const a = { x: 0, y: 0, z: 0 }, b = { x: 10, y: 0, z: 0 };
    const ctrl = bundleControlPoints(s, m, 'Invoicer', 'Scorer', a, b);
    expect(ctrl).toHaveLength(5);
    expect(ctrl[0]).toEqual(a);
    expect(ctrl[4]).toEqual(b);
    ['Billing', 'Payments', 'Risk'].forEach((id, i) => {
      const l = lids.get(id)!;
      expect([ctrl[i + 1].x, ctrl[i + 1].z]).toEqual([l.center.x, l.center.z]);
      expect(ctrl[i + 1].y).toBeGreaterThan(l.center.y + l.size.y / 2);
    });
    // Outer containers sit higher than inner ones.
    expect(ctrl[2].y).toBeGreaterThan(ctrl[1].y);
  });

  it('straighten(β=1) keeps the polygon, β=0 makes a straight line', () => {
    const ctrl = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 10, z: 0 }, { x: 10, y: 0, z: 0 }];
    expect(straighten(ctrl, 1)).toEqual(ctrl);
    expect(straighten(ctrl, 0)[1]).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('the sampled curve starts and ends on the end points', () => {
    const ctrl = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 10, z: 0 }, { x: 10, y: 10, z: 0 }, { x: 15, y: 0, z: 0 }];
    const pts = bsplinePoints(ctrl, 33);
    expect(pts).toHaveLength(33);
    expect(pts[0]).toEqual(ctrl[0]);
    expect(pts[32]).toEqual(ctrl[3]);
    expect(Math.max(...pts.map((p) => p.y))).toBeLessThan(10);
  });

  it('bundlePath: 33 points between the two ends', () => {
    const a = { x: -100, y: 13, z: 0 }, b = { x: 100, y: 13, z: 0 };
    const pts = bundlePath(s, m, 'Invoicer', 'Scorer', a, b);
    expect(pts).toHaveLength(33);
    expect(pts[0]).toEqual(a);
    expect(pts[32]).toEqual(b);
  });
});

// 3D edge paths from a 2D route: 'ortho' (cable at the higher end's height) or 'arc' (a bridge).
import type { Pt, V3 } from '../types';
import { dist3, simplify3, v3 } from './vec';

export const PORT_LEAD = 14;
export const ARC_SEGMENTS = 32;

type ToV3 = (p: Pt, y: number) => V3;

const unit = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

/**
 * Leave each port horizontally along the route for a short lead, climb to the higher
 * endpoint's height, follow the route's bends there, and drop to the lower port.
 */
export function orthoPath(route: Pt[], yA: number, yB: number, to3: ToV3): V3[] {
  const n = route.length - 1;
  const hc = Math.max(yA, yB);
  const firstLen = Math.hypot(route[1].x - route[0].x, route[1].y - route[0].y);
  const lastLen = Math.hypot(route[n].x - route[n - 1].x, route[n].y - route[n - 1].y);
  const d0 = unit(route[0], route[1]), dn = unit(route[n - 1], route[n]);
  const leadA = Math.min(PORT_LEAD, firstLen / 2), leadB = Math.min(PORT_LEAD, lastLen / 2);
  const a1 = { x: route[0].x + d0.x * leadA, y: route[0].y + d0.y * leadA };
  const b1 = { x: route[n].x - dn.x * leadB, y: route[n].y - dn.y * leadB };
  return simplify3([
    to3(route[0], yA), to3(a1, yA), to3(a1, hc),
    ...route.slice(1, n).map((p) => to3(p, hc)),
    to3(b1, hc), to3(b1, yB), to3(route[n], yB),
  ]);
}

/** Apex height of an arc between two points. */
export const arcApex = (a: V3, b: V3): number => Math.max(a.y, b.y) + 0.32 * dist3(a, b) + 24;

/** Quadratic curve whose highest point is at arcApex, sampled to ARC_SEGMENTS + 1 points. */
export function arcPath(a: V3, b: V3): V3[] {
  const apex = arcApex(a, b);
  // A quadratic with end heights a, b and control height c peaks at (ab − c²)/(a + b − 2c);
  // setting that to the apex H gives c = H + √((H − a)(H − b)).
  const cy = apex + Math.sqrt((apex - a.y) * (apex - b.y));
  const c = v3((a.x + b.x) / 2, cy, (a.z + b.z) / 2);
  const pts: V3[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS, u = 1 - t;
    pts.push(v3(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z));
  }
  pts[0] = a;
  pts[ARC_SEGMENTS] = b;
  return pts;
}

/** Middle of the longest segment. */
export function longestSegmentMid(pts: V3[]): V3 {
  let best = -1, at = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const d = dist3(pts[i], pts[i - 1]);
    if (d > best) { best = d; at = v3((pts[i].x + pts[i - 1].x) / 2, (pts[i].y + pts[i - 1].y) / 2, (pts[i].z + pts[i - 1].z) / 2); }
  }
  return at;
}

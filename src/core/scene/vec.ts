// Small V3 helpers (pure, no three.js).
import type { V3 } from '../types';

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const dist3 = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const same3 = (a: V3, b: V3, eps = 1e-6): boolean => dist3(a, b) <= eps;

/** Drop repeated points and middle points of straight runs. */
export function simplify3(pts: V3[]): V3[] {
  const dedup = pts.filter((p, i) => i === 0 || !same3(p, pts[i - 1]));
  return dedup.filter((p, i) => {
    if (i === 0 || i === dedup.length - 1) return true;
    const a = dedup[i - 1], c = dedup[i + 1];
    const ux = p.x - a.x, uy = p.y - a.y, uz = p.z - a.z;
    const wx = c.x - p.x, wy = c.y - p.y, wz = c.z - p.z;
    const cross = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
    const dot = ux * wx + uy * wy + uz * wz;
    return !(cross < 1e-6 && dot > 0);
  });
}

export interface Bounds3 { min: V3; max: V3 }

export function boundsOf(points: Iterable<V3>): Bounds3 {
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  for (const p of points) {
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
  }
  return Number.isFinite(min.x) ? { min, max } : { min: v3(0, 0, 0), max: v3(0, 0, 0) };
}

/** The eight corners of an axis-aligned box. */
export const corners = (c: V3, s: V3): V3[] =>
  [-1, 1].flatMap((dx) => [-1, 1].flatMap((dy) => [-1, 1].map((dz) => v3(c.x + dx * s.x / 2, c.y + dy * s.y / 2, c.z + dz * s.z / 2))));

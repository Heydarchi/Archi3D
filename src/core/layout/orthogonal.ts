// Route clean-up: ends on port centres, every segment axis-aligned, no redundant points.
import type { Pt } from '../types';

const EPS = 0.01;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

/** Insert an elbow wherever a segment is slightly diagonal (elkjs leaves sub-unit jogs at hierarchy crossings). */
export function orthogonalize(route: Pt[]): Pt[] {
  const out: Pt[] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const a = out[out.length - 1], b = route[i];
    if (!same(a.x, b.x) && !same(a.y, b.y)) {
      out.push(Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
    }
    out.push(b);
  }
  return simplify(out);
}

/** Drop repeated points and middle points of straight runs. */
export function simplify(route: Pt[]): Pt[] {
  const dedup = route.filter((p, i) => i === 0 || !(same(p.x, route[i - 1].x) && same(p.y, route[i - 1].y)));
  return dedup.filter((p, i) => {
    if (i === 0 || i === dedup.length - 1) return true;
    const a = dedup[i - 1], c = dedup[i + 1];
    return !((same(a.x, p.x) && same(p.x, c.x)) || (same(a.y, p.y) && same(p.y, c.y)));
  });
}

/** Replace the route's ends with the port centres they touch. */
export function snapToPorts(route: Pt[], from?: Pt, to?: Pt): Pt[] {
  const out = route.slice();
  if (from) out[0] = from;
  if (to) out[out.length - 1] = to;
  return orthogonalize(out);
}

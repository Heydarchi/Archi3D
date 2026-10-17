// Hierarchical edge bundling (Holten 2006) for links between containers in the far view:
// the control polygon follows the nesting tree from source to target through container
// centres raised above their plates, is straightened by β, and sampled as a cubic B-spline.
import { lidSpecs, type LidSpec } from '../lod/lids';
import type { ArchModel, Id, SceneSpec, V3 } from '../types';

export const ROOT = '__root__';
export const BUNDLE_BETA = 0.85;
export const BUNDLE_SAMPLES = 33;
/** How far a container's control point sits above its lid; outer containers rise one step more per level. */
export const BUNDLE_RAISE = 40;

const ancestorsOf = (model: ArchModel, id: Id): Id[] => {
  const out: Id[] = [];
  for (let p = model.nodes[id]?.parent ?? null; p !== null; p = model.nodes[p].parent) out.push(p);
  return out;
};

/** Containers on the tree path between two elements (excluding both ends); ROOT when they share none. */
export function treePath(model: ArchModel, a: Id, b: Id): Id[] {
  const up = ancestorsOf(model, a), down = ancestorsOf(model, b);
  const setB = new Set(down);
  const i = up.findIndex((x) => setB.has(x));
  if (i < 0) return [...up, ROOT, ...down.reverse()];
  const lca = up[i];
  return [...up.slice(0, i), lca, ...down.slice(0, down.indexOf(lca)).reverse()];
}

const lidCache = new WeakMap<SceneSpec, Map<Id, LidSpec>>();
const lidsOf = (scene: SceneSpec, model: ArchModel) => {
  let m = lidCache.get(scene);
  if (!m) { m = new Map(lidSpecs(scene, model).map((l) => [l.id, l])); lidCache.set(scene, m); }
  return m;
};

export function bundleControlPoints(scene: SceneSpec, model: ArchModel, a: Id, b: Id, start: V3, end: V3): V3[] {
  const lids = lidsOf(scene, model);
  const maxDepth = Math.max(0, ...scene.plates.map((p) => p.depth));
  const top = Math.max(...[...lids.values()].map((l) => l.center.y + l.size.y / 2), scene.bounds.max.y);
  const point = (id: Id): V3 => {
    if (id === ROOT) {
      // Above the whole model, rising with its size like an arc's apex (0.32 × distance).
      const { min, max } = scene.bounds;
      const diag = Math.hypot(max.x - min.x, max.z - min.z);
      return { x: (min.x + max.x) / 2, y: top + Math.max(BUNDLE_RAISE * (maxDepth + 3), 0.32 * diag), z: (min.z + max.z) / 2 };
    }
    const l = lids.get(id)!;
    const depth = model.nodes[id].depth;
    return { x: l.center.x, y: l.center.y + l.size.y / 2 + BUNDLE_RAISE * (maxDepth - depth + 1), z: l.center.z };
  };
  return [start, ...treePath(model, a, b).map(point), end];
}

/** Holten's straightening: pull control points towards the straight line by (1 − β). */
export function straighten(ctrl: V3[], beta: number): V3[] {
  const n = ctrl.length - 1, p0 = ctrl[0], pn = ctrl[n];
  return ctrl.map((p, i) => {
    const t = n ? i / n : 0;
    return {
      x: beta * p.x + (1 - beta) * (p0.x + t * (pn.x - p0.x)),
      y: beta * p.y + (1 - beta) * (p0.y + t * (pn.y - p0.y)),
      z: beta * p.z + (1 - beta) * (p0.z + t * (pn.z - p0.z)),
    };
  });
}

/** Clamped uniform cubic B-spline through the control polygon, sampled to `count` points. */
export function bsplinePoints(ctrl: V3[], count: number): V3[] {
  const k = Math.min(3, ctrl.length - 1);
  const n = ctrl.length - 1;
  const knots = [...Array(k + 1).fill(0), ...Array.from({ length: n - k }, (_, i) => (i + 1) / (n - k + 1)), ...Array(k + 1).fill(1)];
  const basis = (i: number, p: number, u: number): number => {
    if (p === 0) return (knots[i] <= u && u < knots[i + 1]) || (u === 1 && knots[i + 1] === 1 && knots[i] < 1) ? 1 : 0;
    const a = knots[i + p] - knots[i], b = knots[i + p + 1] - knots[i + 1];
    return (a ? ((u - knots[i]) / a) * basis(i, p - 1, u) : 0) + (b ? ((knots[i + p + 1] - u) / b) * basis(i + 1, p - 1, u) : 0);
  };
  const pts: V3[] = [];
  for (let s = 0; s < count; s++) {
    const u = s / (count - 1);
    const p = { x: 0, y: 0, z: 0 };
    ctrl.forEach((c, i) => { const w = basis(i, k, u); p.x += w * c.x; p.y += w * c.y; p.z += w * c.z; });
    pts.push(p);
  }
  pts[0] = ctrl[0];
  pts[count - 1] = ctrl[n];
  return pts;
}

export function bundlePath(scene: SceneSpec, model: ArchModel, a: Id, b: Id, start: V3, end: V3, beta = BUNDLE_BETA): V3[] {
  return bsplinePoints(straighten(bundleControlPoints(scene, model, a, b, start, end), beta), BUNDLE_SAMPLES);
}

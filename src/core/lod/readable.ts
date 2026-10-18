// Semantic zoom rule "readable": a container opens when what is inside it would be readable
// (its smallest child at least READABLE_PX.open pixels wide), not when the container itself is big.
// To keep the overview calm, containers open biggest first until ELEMENT_BUDGET things are on screen.
// A selected container is always open, so a click on a closed one opens it where it is.
import type { ArchModel, CameraState, ContainerState, Id, LodResult, SceneSpec, V3 } from '../types';

/** Smallest child width in pixels to open a container, and to keep it open (hysteresis). */
export const READABLE_PX = { open: 45, close: 38 };
/** At most this many blocks and closed lids on screen. */
export const ELEMENT_BUDGET = 150;

const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function readableContainers(
  scene: SceneSpec, model: ArchModel, cam: CameraState, prev: LodResult | undefined, selected: Id | null | undefined, detail = 1,
): Record<Id, ContainerState> {
  // Pixels per world unit at a point; a narrow view is limited by its width.
  const perPx = (2 * Math.tan((cam.fovDeg * Math.PI) / 360)) / Math.max(1, cam.viewportH);
  const narrow = Math.min(1, cam.aspect ?? 1);
  const px = (len: number, at: V3) => (len * narrow) / (perPx * Math.max(1e-6, dist(cam.position, at)));

  const plates = new Map(scene.plates.map((p) => [p.id, p]));
  const blocks = new Map(scene.blocks.map((b) => [b.id, b]));
  /** Width on screen of the smallest thing inside. A child container counts with half its width. */
  const childPx = (id: Id): number => {
    let min = Infinity;
    for (const c of model.nodes[id].children) {
      const b = blocks.get(c), p = plates.get(c);
      if (b) min = Math.min(min, px(b.size.x, b.center));
      else if (p) min = Math.min(min, px(p.size.x / 2, p.center));
    }
    return min;
  };
  const sizePx = (id: Id) => { const p = plates.get(id)!; return px(Math.hypot(p.size.x, p.size.z), p.center); };

  const isAncestorOf = (id: Id, other: Id | null | undefined): boolean => {
    for (let p = other ? model.nodes[other]?.parent ?? null : null; p !== null; p = model.nodes[p].parent) if (p === id) return true;
    return false;
  };

  const containers: Record<Id, ContainerState> = {};
  for (const p of scene.plates) containers[p.id] = 'hidden';
  let onScreen = model.roots.length;
  let frontier = model.roots.filter((id) => model.nodes[id].container && plates.has(id));
  while (frontier.length) {
    // Biggest on screen first, so the budget goes to what you look at.
    frontier.sort((a, b) => sizePx(b) - sizePx(a) || (a < b ? -1 : 1));
    const id = frontier.shift()!;
    const kids = model.nodes[id].children;
    const need = (prev?.containers[id] === 'open' ? READABLE_PX.close : READABLE_PX.open) / detail;
    const cost = kids.length - 1; // the lid goes, the children come
    const forced = selected === id || isAncestorOf(id, selected);
    if (forced || (childPx(id) >= need && onScreen + cost <= ELEMENT_BUDGET * detail)) {
      containers[id] = 'open';
      onScreen += cost;
      frontier = frontier.concat(kids.filter((c) => model.nodes[c].container && plates.has(c)));
    } else {
      containers[id] = 'closed';
    }
  }
  return containers;
}

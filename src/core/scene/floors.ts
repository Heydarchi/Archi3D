// Layers (prototype): top-level containers of kind "layer" become floors stacked on top of each
// other, the first one written on top. Everything inside a layer is moved onto its floor; nesting
// inside a floor rises in small steps. Elements outside every layer stand on the floor they link to most.
import type { ArchModel, Id, Layout2D } from '../types';

export const LAYER_KIND = 'layer';
/** Height of one nesting step inside a floor. */
export const NEST_STEP = 24;
/** Free space between the top of one floor's content and the next floor: at least this, */
export const FLOOR_GAP = 110;
/** or this part of the largest floor's depth, so floors seen from above don't cover each other. */
export const FLOOR_GAP_PER_DEPTH = 0.45;
/** Space between a floor and the elements placed next to it. */
export const BESIDE_GAP = 40;

export interface Floor { layer: Id; index: number; y: number; dx: number; dz: number; extraDepth: number }

/** The floor of every node, or null when the model has no layers. */
export function floorsOf(model: ArchModel, layout: Layout2D, blockHeight: number): Map<Id, Floor> | null {
  const layers = model.roots.filter((id) => model.nodes[id].kind.toLowerCase() === LAYER_KIND && layout.boxes[id]);
  if (!layers.length) return null;
  const cx = layout.bounds.x + layout.bounds.w / 2, cy = layout.bounds.y + layout.bounds.h / 2;

  const layerOf = new Map<Id, Id>();
  const mark = (id: Id, layer: Id) => { layerOf.set(id, layer); for (const c of model.nodes[id].children) mark(c, layer); };
  for (const l of layers) mark(l, l);
  // Outside every layer: the layer with the most links to it (ties: the first layer).
  for (const r of model.roots.filter((id) => !layerOf.has(id))) {
    const count = new Map<Id, number>();
    for (const e of model.edges) {
      const other = e.from.node === r ? e.to.node : e.to.node === r ? e.from.node : null;
      const l = other && layerOf.get(other);
      if (l) count.set(l, (count.get(l) ?? 0) + 1);
    }
    const best = layers.reduce((a, b) => ((count.get(b) ?? 0) > (count.get(a) ?? 0) ? b : a), layers[0]);
    mark(r, best);
  }

  const innerDepth = (id: Id): number => Math.max(0, ...model.nodes[id].children.map((c) => 1 + innerDepth(c)));
  const deepest = Math.max(...layers.map((l) => layout.boxes[l].h));
  const gap = Math.max(FLOOR_GAP, deepest * FLOOR_GAP_PER_DEPTH);
  const floorHeight = (l: Id) => innerDepth(l) * NEST_STEP + blockHeight * 2.4 + gap;
  const floors = new Map<Id, Floor>();
  let y = 0;
  layers.slice().reverse().forEach((l, k) => {
    const b = layout.boxes[l];
    const f: Floor = { layer: l, index: layers.length - 1 - k, y, dx: cx - (b.x + b.w / 2), dz: cy - (b.y + b.h / 2), extraDepth: 0 };
    floors.set(l, f);
    y += floorHeight(l);
  });
  const out = new Map<Id, Floor>();
  // Elements outside every layer: in a column just left of their floor, top to bottom.
  const nextZ = new Map<Id, number>();
  const placeBeside = (root: Id, f: Floor): Floor => {
    const lb = layout.boxes[f.layer], b = layout.boxes[root];
    const z = nextZ.get(f.layer) ?? lb.y;
    nextZ.set(f.layer, z + b.h + BESIDE_GAP / 2);
    // Move the element's box so its right edge is BESIDE_GAP left of the layer, then apply the floor shift.
    return { ...f, extraDepth: 1, dx: f.dx + (lb.x - BESIDE_GAP - b.w) - b.x, dz: f.dz + z - b.y };
  };
  for (const [id, l] of layerOf) {
    const f = floors.get(l)!;
    let root = id;
    while (model.nodes[root].parent !== null) root = model.nodes[root].parent!;
    out.set(id, root === l ? f : out.get(root) ?? placeBeside(root, f));
  }
  return out;
}

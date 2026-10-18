// lift(model, layout) → SceneSpec: the 2D layout raised into stacked 3D levels, as plain data.
// 2D (x, y) → 3D (x, z) centred on the origin; y is up. Level n sits at y = n × levelGap.
import type {
  ArchModel, BlockSpec, EdgeSpec, FloorSpec, LabelSpec, Layout2D, ModelNode, PlateSpec, PortSpec, Pt, SceneOptions, SceneSpec, Shape, V3,
} from '../types';
import { arcPath, longestSegmentMid, orthoPath } from './edgePaths';
import { floorsOf, NEST_STEP } from './floors';
import { boundsOf, corners, v3 } from './vec';

export const DEFAULT_SCENE_OPTIONS: SceneOptions = { levelGap: 60, blockHeight: 26, edgeMode: 'ortho' };
export const PLATE_THICKNESS = 6;
export const QUEUE_HEIGHT_FACTOR = 0.6;
/** Shapes drawn as a figure on a flat base; the value is the base height as a part of the block height. Links attach to the base. */
export const PEDESTAL: Partial<Record<Shape, number>> = { person: 0.16, screen: 0.16, phone: 0.16 };
/** Block height for each shape, as a factor of blockHeight. Flat things are low, a person is tall. */
export const HEIGHT_FACTOR: Record<Shape, number> = {
  box: 1, ext: 1, db: 1, screen: 2, person: 2.4, phone: 2.2, cache: 0.8, device: 0.8,
  library: 0.7, storage: 0.7, kernel: 0.6, queue: QUEUE_HEIGHT_FACTOR, topic: QUEUE_HEIGHT_FACTOR, chip: 0.5,
};

export function lift(model: ArchModel, layout: Layout2D, options: Partial<SceneOptions> = {}): SceneSpec {
  const opts = { ...DEFAULT_SCENE_OPTIONS, ...options };
  const cx = layout.bounds.x + layout.bounds.w / 2, cz = layout.bounds.y + layout.bounds.h / 2;
  const layered = floorsOf(model, layout, opts.blockHeight);
  const floors = layered?.byNode;
  const shiftOf = (id: string) => floors?.get(id) ?? { dx: 0, dz: 0 };
  const floorOf = (id: string) => (floors?.get(id) ? { floor: floors.get(id)!.layer } : {});
  /** 2D → 3D for things that belong to a node (moved onto its floor when there are layers). */
  const at3 = (id: string) => { const f = shiftOf(id); return (p: Pt, y: number): V3 => v3(p.x - cx + f.dx, y, p.y - cz + f.dz); };
  const base = (n: ModelNode) => {
    const f = floors?.get(n.id);
    return f ? f.y + (n.depth + f.extraDepth) * NEST_STEP : n.depth * opts.levelGap;
  };
  const blockHeight = (n: ModelNode) => opts.blockHeight * HEIGHT_FACTOR[n.shape];
  /** Height where links attach: block mid-height, or a container's plate top. */
  const attachY = (n: ModelNode) => (n.container ? base(n) + PLATE_THICKNESS : base(n) + (blockHeight(n) * (PEDESTAL[n.shape] ?? 1)) / 2);

  const plates: PlateSpec[] = [];
  const blocks: BlockSpec[] = [];
  const ports: PortSpec[] = [];
  const labels: LabelSpec[] = [];

  for (const n of Object.values(model.nodes)) {
    const b = layout.boxes[n.id];
    if (!b) continue;
    const mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const to3 = at3(n.id);
    if (n.container) {
      plates.push({ id: n.id, depth: n.depth, center: to3(mid, base(n) + PLATE_THICKNESS / 2), size: v3(b.w, PLATE_THICKNESS, b.h), ...floorOf(n.id), ...(n.color ? { color: n.color } : {}) });
      // Title just in front of the front-left edge, or (alt) in the strip at the back. lod/declutter.ts picks the free one.
      labels.push({
        id: n.id, text: n.title ?? n.id, role: 'container',
        anchor: to3({ x: b.x + 10, y: b.y + b.h + 9 }, base(n) + PLATE_THICKNESS), alt: to3({ x: b.x + 10, y: b.y + 18 }, base(n) + PLATE_THICKNESS + 2),
      });
    } else {
      const h = blockHeight(n);
      blocks.push({ id: n.id, shape: n.shape, center: to3(mid, base(n) + h / 2), size: v3(b.w, h, b.h), ...floorOf(n.id), ...(n.color ? { color: n.color } : {}) });
      labels.push({ id: n.id, text: n.title ?? n.id, role: 'component', anchor: to3(mid, base(n) + h + 4) });
    }
    for (const p of n.ports) {
      const c = layout.ports[p.id];
      if (!c) continue;
      const pos = to3(c, attachY(n));
      ports.push({ id: p.id, owner: n.id, dir: p.dir, pos });
      if (!p.name.startsWith('_')) {
        labels.push({ id: p.id, text: p.name, role: 'port', anchor: v3(pos.x + (p.dir === 'in' ? -8 : 8), pos.y + 8, pos.z) });
      }
    }
  }

  const portPos = new Map(ports.map((p) => [p.id, p.pos]));
  const edges: EdgeSpec[] = [];
  for (const e of model.edges) {
    const route = layout.routes[e.id];
    if (!route || route.length < 2) continue;
    const yA = attachY(model.nodes[e.from.node]), yB = attachY(model.nodes[e.to.node]);
    const to3 = at3(e.from.node);
    // Between two floors (or to an element moved next to a floor) the 2D route means nothing: go straight.
    const fa = shiftOf(e.from.node), fb = shiftOf(e.to.node);
    const crossFloor = !!floors && (floors.get(e.from.node)?.y !== floors.get(e.to.node)?.y || fa.dx !== fb.dx || fa.dz !== fb.dz);
    const start = (e.from.port && portPos.get(e.from.port)) || to3(route[0], yA);
    const end = (e.to.port && portPos.get(e.to.port)) || to3(route[route.length - 1], yB);
    const points = opts.edgeMode === 'arc' ? arcPath(start, end) : crossFloor ? [start, end] : orthoPath(route, yA, yB, to3);
    points[0] = start;
    points[points.length - 1] = end;
    if (e.label === undefined) {
      edges.push({ id: e.id, points, kind: e.kind, async: e.async, ...(e.color ? { color: e.color } : {}) });
      continue;
    }
    const at = longestSegmentMid(points);
    const labelAt = v3(at.x, at.y + 7, at.z);
    edges.push({ id: e.id, points, kind: e.kind, async: e.async, label: e.label, labelAt, ...(e.color ? { color: e.color } : {}) });
    labels.push({ id: `edge:${e.id}`, text: e.label, role: 'edge', anchor: labelAt });
  }

  const bounds = boundsOf([
    ...plates.flatMap((p) => corners(p.center, p.size)),
    ...blocks.flatMap((b) => corners(b.center, b.size)),
    ...ports.map((p) => p.pos),
    ...edges.flatMap((e) => e.points),
    ...labels.map((l) => l.anchor),
  ]);
  const floorSpecs: FloorSpec[] | undefined = layered?.bands.map((f) => {
    const p = plates.find((x) => x.id === f.layer)!;
    return { id: f.layer, index: f.index, y: f.y, top: f.top, center: p.center, size: p.size };
  });
  return { plates, blocks, ports, edges, labels, bounds, ...(floorSpecs ? { floors: floorSpecs } : {}) };
}

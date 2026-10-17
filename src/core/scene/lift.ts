// lift(model, layout) → SceneSpec: the 2D layout raised into stacked 3D levels, as plain data.
// 2D (x, y) → 3D (x, z) centred on the origin; y is up. Level n sits at y = n × levelGap.
import type {
  ArchModel, BlockSpec, EdgeSpec, LabelSpec, Layout2D, ModelNode, PlateSpec, PortSpec, Pt, SceneOptions, SceneSpec, V3,
} from '../types';
import { arcPath, longestSegmentMid, orthoPath } from './edgePaths';
import { boundsOf, corners, v3 } from './vec';

export const DEFAULT_SCENE_OPTIONS: SceneOptions = { levelGap: 60, blockHeight: 26, edgeMode: 'ortho' };
export const PLATE_THICKNESS = 6;
export const QUEUE_HEIGHT_FACTOR = 0.6;

export function lift(model: ArchModel, layout: Layout2D, options: Partial<SceneOptions> = {}): SceneSpec {
  const opts = { ...DEFAULT_SCENE_OPTIONS, ...options };
  const cx = layout.bounds.x + layout.bounds.w / 2, cz = layout.bounds.y + layout.bounds.h / 2;
  const to3 = (p: Pt, y: number): V3 => v3(p.x - cx, y, p.y - cz);
  const base = (n: ModelNode) => n.depth * opts.levelGap;
  const blockHeight = (n: ModelNode) => (n.shape === 'queue' ? opts.blockHeight * QUEUE_HEIGHT_FACTOR : opts.blockHeight);
  /** Height where links attach: block mid-height, or a container's plate top. */
  const attachY = (n: ModelNode) => (n.container ? base(n) + PLATE_THICKNESS : base(n) + blockHeight(n) / 2);

  const plates: PlateSpec[] = [];
  const blocks: BlockSpec[] = [];
  const ports: PortSpec[] = [];
  const labels: LabelSpec[] = [];

  for (const n of Object.values(model.nodes)) {
    const b = layout.boxes[n.id];
    if (!b) continue;
    const mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    if (n.container) {
      plates.push({ id: n.id, depth: n.depth, center: to3(mid, base(n) + PLATE_THICKNESS / 2), size: v3(b.w, PLATE_THICKNESS, b.h) });
      labels.push({ id: n.id, text: n.id, role: 'container', anchor: to3({ x: b.x + 10, y: b.y + 16 }, base(n) + PLATE_THICKNESS + 2) });
    } else {
      const h = blockHeight(n);
      blocks.push({ id: n.id, shape: n.shape, center: to3(mid, base(n) + h / 2), size: v3(b.w, h, b.h) });
      labels.push({ id: n.id, text: n.id, role: 'component', anchor: to3(mid, base(n) + h + 4) });
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
    const start = (e.from.port && portPos.get(e.from.port)) || to3(route[0], yA);
    const end = (e.to.port && portPos.get(e.to.port)) || to3(route[route.length - 1], yB);
    const points = opts.edgeMode === 'arc' ? arcPath(start, end) : orthoPath(route, yA, yB, to3);
    points[0] = start;
    points[points.length - 1] = end;
    if (e.label === undefined) {
      edges.push({ id: e.id, points, async: e.async });
      continue;
    }
    const at = longestSegmentMid(points);
    const labelAt = v3(at.x, at.y + 7, at.z);
    edges.push({ id: e.id, points, async: e.async, label: e.label, labelAt });
    labels.push({ id: `edge:${e.id}`, text: e.label, role: 'edge', anchor: labelAt });
  }

  const bounds = boundsOf([
    ...plates.flatMap((p) => corners(p.center, p.size)),
    ...blocks.flatMap((b) => corners(b.center, b.size)),
    ...ports.map((p) => p.pos),
    ...edges.flatMap((e) => e.points),
    ...labels.map((l) => l.anchor),
  ]);
  return { plates, blocks, ports, edges, labels, bounds };
}

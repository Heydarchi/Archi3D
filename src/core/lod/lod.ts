// Semantic zoom as a pure function: which containers are open, closed or hidden, and which
// edges and labels are visible, for a camera. Hysteresis needs the previous result.
import type { ArchModel, CameraState, ContainerState, Id, LodResult, SceneSpec, V3 } from '../types';
import { standIn } from './aggregate';
import { footprintDiagonal } from './focus';

export const CLOSE_RATIO = 3.0;
export const OPEN_RATIO = 2.6;
export const SELECTED_OPEN_RATIO = 3.4;
/** Below this ratio the camera is "inside" a container; its title is hidden (the breadcrumb shows it). */
export const INSIDE_RATIO = 0.8;
export const MIN_PX = { componentLabelWidth: 48, portLabelBlock: 120, edgeLabelLength: 160 };
/** At most this many labels at once (nearest first). */
export const LABEL_BUDGET = 150;

export interface LodOptions {
  /** A selected container is forced open while its ratio is below SELECTED_OPEN_RATIO. */
  selected?: Id | null;
  /** false = semantic zoom off: everything open and labelled. */
  enabled?: boolean;
  /** Label budget, nearest to the camera first (default LABEL_BUDGET). */
  maxLabels?: number;
}

function nearest(scene: SceneSpec, ids: Set<string>, cam: CameraState, max: number): Set<string> {
  if (ids.size <= max) return ids;
  const at = new Map(scene.labels.map((l) => [l.id, l.anchor]));
  const d = (id: string) => { const a = at.get(id)!; return dist(a, cam.position); };
  return new Set([...ids].map((id) => [id, d(id)] as const).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).slice(0, max).map(([id]) => id));
}

const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function lod(scene: SceneSpec, model: ArchModel, cam: CameraState, prev?: LodResult, opts: LodOptions = {}): LodResult {
  const containers: Record<Id, ContainerState> = {};
  if (opts.enabled === false) {
    for (const p of scene.plates) containers[p.id] = 'open';
    const labels = nearest(scene, new Set(scene.labels.map((l) => l.id)), cam, opts.maxLabels ?? Infinity);
    return { containers, visibleLabels: labels, visibleEdges: new Set(scene.edges.map((e) => e.id)) };
  }

  // World units per pixel at distance 1.
  const perPx = (2 * Math.tan((cam.fovDeg * Math.PI) / 360)) / Math.max(1, cam.viewportH);
  const px = (worldLen: number, at: V3) => worldLen / (perPx * Math.max(1e-6, dist(cam.position, at)));

  // Containers, top-down: a closed or hidden parent hides everything inside.
  const plates = new Map(scene.plates.map((p) => [p.id, p]));
  const ratios = new Map<Id, number>();
  const visit = (id: Id, parentShown: boolean): void => {
    const n = model.nodes[id];
    if (!n?.container) return;
    const plate = plates.get(id);
    let state: ContainerState = 'hidden';
    if (parentShown && plate) {
      // In a tall, narrow view the width limits what fits, so the same apparent size needs a
      // camera further back: scale the distance by the aspect when it is below 1.
      const ratio = (dist(cam.position, plate.center) * Math.min(1, cam.aspect ?? 1)) / Math.max(1e-6, footprintDiagonal(plate.size));
      ratios.set(id, ratio);
      const before = prev?.containers[id];
      if (opts.selected === id && ratio < SELECTED_OPEN_RATIO) state = 'open';
      else if (ratio > CLOSE_RATIO) state = 'closed';
      else if (ratio < OPEN_RATIO) state = 'open';
      else state = before === 'open' || before === 'closed' ? before : ratio < (CLOSE_RATIO + OPEN_RATIO) / 2 ? 'open' : 'closed';
    }
    containers[id] = state;
    for (const c of n.children) visit(c, state === 'open');
  };
  for (const r of model.roots) visit(r, true);

  const shown = (id: Id): boolean => {
    for (let p = model.nodes[id]?.parent ?? null; p !== null; p = model.nodes[p].parent) {
      if (containers[p] !== 'open') return false;
    }
    return true;
  };

  const visibleEdges = new Set<string>();
  for (const e of model.edges) {
    if (standIn(model, { containers }, e.from.node) !== standIn(model, { containers }, e.to.node)) visibleEdges.add(e.id);
  }

  const blocks = new Map(scene.blocks.map((b) => [b.id, b]));
  const edgeSpecs = new Map(scene.edges.map((e) => [e.id, e]));
  const edgeById = new Map(model.edges.map((e) => [e.id, e]));
  const ownerOf = new Map(scene.ports.map((p) => [p.id, p.owner]));
  const visibleLabels = new Set<string>();
  for (const l of scene.labels) {
    if (l.role === 'container') {
      const st = containers[l.id];
      if (st === 'closed' || (st === 'open' && (ratios.get(l.id) ?? 0) >= INSIDE_RATIO)) visibleLabels.add(l.id);
    } else if (l.role === 'component') {
      const b = blocks.get(l.id);
      if (b && shown(l.id) && px(b.size.x, b.center) > MIN_PX.componentLabelWidth) visibleLabels.add(l.id);
    } else if (l.role === 'port') {
      const owner = ownerOf.get(l.id as `${string}.${string}`);
      const b = owner ? blocks.get(owner) : undefined;
      if (b && shown(b.id) && px(b.size.z, b.center) > MIN_PX.portLabelBlock) visibleLabels.add(l.id);
    } else {
      const id = l.id.replace(/^edge:/, '');
      const e = edgeSpecs.get(id);
      const me = edgeById.get(id);
      // Only links drawn on their own route get their label (not ones folded into an aggregate).
      if (!e || !me || !visibleEdges.has(id) || !shown(me.from.node) || !shown(me.to.node)) continue;
      let len = 0;
      for (let i = 1; i < e.points.length; i++) len += dist(e.points[i], e.points[i - 1]);
      if (px(len, l.anchor) > MIN_PX.edgeLabelLength) visibleLabels.add(l.id);
    }
  }
  return { containers, visibleLabels: nearest(scene, visibleLabels, cam, opts.maxLabels ?? LABEL_BUDGET), visibleEdges };
}

/** Whether a node is drawn at all (no closed/hidden ancestor) for a lod result. */
export function nodeShown(model: ArchModel, r: LodResult, id: Id): boolean {
  for (let p = model.nodes[id]?.parent ?? null; p !== null; p = model.nodes[p].parent) {
    if (r.containers[p] !== 'open') return false;
  }
  return true;
}

// Applies semantic zoom (a LodResult) and the selection to the instanced objects:
// hidden things are switched off, lids fade in/out over 150 ms, a selection lights its element and
// links in the accent colour and fades everything unconnected to 15 %.
import * as THREE from 'three';
import { splitEdges } from '../core/lod/aggregate';
import { nodeShown } from '../core/lod/lod';
import { bundlePath } from '../core/scene/bundle';
import { arcPath } from '../core/scene/edgePaths';
import type { V3 } from '../core/types';
import { highlightSet, isInside } from '../core/model/query';
import type { ArchModel, Id, LodResult, SceneSpec } from '../core/types';
import type { SceneObjects } from './build';
import type { Palette } from './palette';
import { elementOf } from './shapes';

export const LID_FADE_MS = 150;
export const DIM_OPACITY = 0.15;

export interface Presented { animating: boolean; dimLabels: Set<string> | null; changed: boolean }

export class Presenter {
  private lidAlpha = new Map<string, number>();
  private key = '';

  constructor(private o: SceneObjects, private model: ArchModel, private pal: Palette, private scene: SceneSpec) {}

  /** Where an aggregated link attaches: the top centre of a lid or block. */
  private anchor(id: Id): V3 {
    const m = this.o.lids.matrixOf(id) ?? this.o.bodies.map((s) => s.matrixOf(id)).find(Boolean);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m?.decompose(p, q, s);
    return { x: p.x, y: p.y + s.y / 2, z: p.z };
  }

  /** `bundled`: aggregated links follow the nesting tree (step 14), except the selection's own links. */
  apply(r: LodResult, selected: Id | null, dtMs: number, instant: boolean, bundled = false): Presented {
    const { o, model, pal } = this;
    // Lids fade every frame until they reach their target.
    let animating = false;
    for (const id of o.lids.ids) {
      const target = r.containers[id] === 'closed' ? 1 : 0;
      const prev = this.lidAlpha.get(id) ?? 0;
      const step = instant ? 1 : dtMs / LID_FADE_MS;
      const next = prev < target ? Math.min(target, prev + step) : Math.max(target, prev - step);
      if (next !== target) animating = true;
      if (next !== prev || !this.lidAlpha.has(id)) {
        this.lidAlpha.set(id, next);
        o.lids.setOpacity(id, next);
        o.lids.setShown(id, next > 0.001);
      }
    }

    const key = `${selected}|${bundled}|${Object.entries(r.containers).map(([k, v]) => `${k}:${v[0]}`).join(',')}`;
    if (key === this.key) return { animating, dimLabels: null, changed: false };
    this.key = key;

    const hl = selected && model.nodes[selected] ? highlightSet(model, selected) : null;
    const accent = new THREE.Color(pal.accent);
    const bg = new THREE.Color(pal.background);
    const dimmed = new Set<string>();
    const shown = (id: Id) => nodeShown(model, r, id);

    for (const id of o.plates.ids) {
      o.plates.setShown(id, r.containers[id] !== 'hidden');
      const base = o.plates.baseColor(id)!;
      o.plates.setColor(id, hl && id === selected ? base.clone().lerp(accent, 0.25) : base);
    }
    for (const set of o.bodies) {
      for (const part of set.ids) {
        const id = elementOf(part);
        set.setShown(part, shown(id));
        const on = !hl || hl.nodes.has(id);
        set.setOpacity(part, on ? 1 : DIM_OPACITY);
        const base = set.baseColor(part)!;
        set.setColor(part, hl && isInside(model, id, selected!) ? base.clone().lerp(accent, 0.35) : base);
        if (!on) dimmed.add(id);
      }
    }
    for (const id of o.ports.ids) {
      const owner = id.slice(0, id.indexOf('.'));
      o.ports.setShown(id, model.nodes[owner]?.container ? r.containers[owner] !== 'hidden' : shown(owner));
      const on = !hl || hl.nodes.has(owner);
      o.ports.setOpacity(id, on ? 1 : DIM_OPACITY);
      if (!on) dimmed.add(id);
    }

    const edgeColor = new THREE.Color(pal.edge);
    const dimEdge = edgeColor.clone().lerp(bg, 1 - DIM_OPACITY);
    const { direct, aggregates } = splitEdges(model, r);
    o.edges.update(
      direct,
      (id) => (!hl ? edgeColor : hl.edges.has(id) ? accent : dimEdge),
      (id) => (!hl || hl.edges.has(id) ? 1 : DIM_OPACITY),
      aggregates.map((a) => {
        const mine = !!hl && a.ids.some((id) => hl.edges.has(id));
        const from = this.anchor(a.from), to = this.anchor(a.to);
        return {
          points: bundled && !mine ? bundlePath(this.scene, model, a.from, a.to, from, to) : arcPath(from, to),
          color: !hl ? edgeColor : mine ? accent : dimEdge,
        };
      }),
    );
    if (hl) for (const id of o.edges.ids) if (!hl.edges.has(id)) dimmed.add(`edge:${id}`);

    const outline = new THREE.Color(pal.outline);
    const dimOutline = outline.clone().lerp(bg, 1 - DIM_OPACITY);
    o.outlines.update(
      (id) => (id.startsWith('lid:') ? r.containers[id.slice(4)] === 'closed' : shown(elementOf(id))),
      (id) => (hl && !id.startsWith('lid:') && !hl.nodes.has(elementOf(id)) ? dimOutline : outline),
    );
    return { animating, dimLabels: hl ? dimmed : null, changed: true };
  }
}

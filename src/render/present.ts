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
/** A selected element (and everything inside a selected container) gets this much lighter and an
 * accent outline, instead of an orange tint that would clash with your own colours. */
export const SELECT_LIGHTEN = 0.3;
/** Floors above the one you look at (layers) are hidden but keep faint outlines, so they cover nothing
 * (a see-through mesh would still hide what is behind it in the depth buffer). This is how light the outlines are. */
export const FADE_OPACITY = 0.08;

export interface Presented { animating: boolean; dimLabels: Set<string> | null; changed: boolean }

export class Presenter {
  private lidAlpha = new Map<string, number>();
  private key = '';
  /** The floor (layer) each plate and block stands on. */
  private floorOf: Map<string, string | undefined>;

  constructor(private o: SceneObjects, private model: ArchModel, private pal: Palette, private scene: SceneSpec) {
    this.floorOf = new Map([...scene.plates, ...scene.blocks].map((x) => [x.id, x.floor]));
  }

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
    const fadedFloors = r.fadedFloors ?? new Set<string>();
    const faded = (id: Id) => fadedFloors.has(this.floorOf.get(id) ?? '');
    for (const id of o.lids.ids) {
      const target = r.containers[id] === 'closed' ? 1 : 0;
      const prev = this.lidAlpha.get(id) ?? 0;
      const step = instant ? 1 : dtMs / LID_FADE_MS;
      const next = prev < target ? Math.min(target, prev + step) : Math.max(target, prev - step);
      if (next !== target) animating = true;
      if (next !== prev || !this.lidAlpha.has(id)) {
        this.lidAlpha.set(id, next);
        o.lids.setOpacity(id, next);
        o.lids.setShown(id, next > 0.001 && !faded(id));
      }
    }

    const key = `${selected}|${bundled}|${[...fadedFloors].join(',')}|${Object.entries(r.containers).map(([k, v]) => `${k}:${v[0]}`).join(',')}`;
    if (key === this.key) return { animating, dimLabels: null, changed: false };
    this.key = key;

    const hl = selected && model.nodes[selected] ? highlightSet(model, selected) : null;
    const accent = new THREE.Color(pal.accent);
    const white = new THREE.Color(0xffffff);
    const bg = new THREE.Color(pal.background);
    const dimmed = new Set<string>();
    const shown = (id: Id) => nodeShown(model, r, id);

    // The lid loop above only runs while a lid fades; a floor can fade out without that.
    for (const id of o.lids.ids) o.lids.setShown(id, (this.lidAlpha.get(id) ?? 0) > 0.001 && !faded(id));
    for (const id of o.plates.ids) {
      o.plates.setShown(id, r.containers[id] !== 'hidden' && !faded(id));
      const base = o.plates.baseColor(id)!;
      o.plates.setColor(id, hl && id === selected ? base.clone().lerp(accent, 0.25) : base);
    }
    for (const set of o.bodies) {
      for (const part of set.ids) {
        const id = elementOf(part);
        set.setShown(part, shown(id) && !faded(id));
        const on = !hl || hl.nodes.has(id);
        set.setOpacity(part, on ? 1 : DIM_OPACITY);
        const base = set.baseColor(part)!;
        set.setColor(part, hl && isInside(model, id, selected!) ? base.clone().lerp(white, SELECT_LIGHTEN) : base);
        if (!on) dimmed.add(id);
      }
    }
    for (const id of o.ports.ids) {
      const owner = id.slice(0, id.indexOf('.'));
      o.ports.setShown(id, model.nodes[owner]?.container ? r.containers[owner] !== 'hidden' : shown(owner));
      const on = !hl || hl.nodes.has(owner);
      o.ports.setOpacity(id, on ? 1 : DIM_OPACITY);
      if (faded(owner)) o.ports.setShown(id, false);
      if (!on) dimmed.add(id);
    }

    const edgeColor = (id: string) => o.edges.baseColor(id);
    const dimEdge = (id: string) => edgeColor(id).lerp(bg, 1 - DIM_OPACITY);
    const fadeEdge = (id: string) => edgeColor(id).lerp(bg, 1 - FADE_OPACITY);
    const plainEdge = new THREE.Color(pal.edge);
    const edgeOf = new Map(model.edges.map((e) => [e.id, e]));
    const edgeFaded = (id: string) => { const e = edgeOf.get(id); return !!e && faded(e.from.node) && faded(e.to.node); };
    const { direct, aggregates } = splitEdges(model, r);
    o.edges.update(
      direct,
      (id) => (edgeFaded(id) ? fadeEdge(id) : !hl ? edgeColor(id) : hl.edges.has(id) ? accent : dimEdge(id)),
      (id) => (edgeFaded(id) ? FADE_OPACITY : !hl || hl.edges.has(id) ? 1 : DIM_OPACITY),
      aggregates.map((a) => {
        const mine = !!hl && a.ids.some((id) => hl.edges.has(id));
        const from = this.anchor(a.from), to = this.anchor(a.to);
        return {
          points: bundled && !mine ? bundlePath(this.scene, model, a.from, a.to, from, to) : arcPath(from, to),
          color: !hl ? plainEdge : mine ? accent : plainEdge.clone().lerp(bg, 1 - DIM_OPACITY),
        };
      }),
    );
    if (hl) for (const id of o.edges.ids) if (!hl.edges.has(id)) dimmed.add(`edge:${id}`);

    const outline = new THREE.Color(pal.outline);
    const dimOutline = outline.clone().lerp(bg, 1 - DIM_OPACITY);
    const fadeOutline = outline.clone().lerp(bg, 1 - FADE_OPACITY);
    o.outlines.update(
      (id) => (id.startsWith('lid:') ? r.containers[id.slice(4)] === 'closed' : shown(elementOf(id))),
      (id) => {
        const el = id.startsWith('lid:') ? id.slice(4) : elementOf(id);
        if (faded(el)) return fadeOutline;
        if (hl && !id.startsWith('lid:') && isInside(model, el, selected!)) return accent;
        return hl && !id.startsWith('lid:') && !hl.nodes.has(el) ? dimOutline : outline;
      },
    );
    return { animating, dimLabels: hl ? dimmed : null, changed: true };
  }
}

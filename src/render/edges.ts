// All links in one LineSegments2 batch per link kind (widths in pixels), plus instanced arrowheads,
// flow marks (stream) and end squares (shared). Rebuilt only when the visible set or colours change.
//   call     solid             arrow at the target
//   message  dashed            arrow at the target
//   event    dotted            arrow at the target
//   session  two thin lines    arrows at both ends
//   stream   thick, flow marks arrow at the target
//   shared   wide, see-through a square at both ends, no arrow
import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { EdgeSpec, LinkKind, V3 } from '../core/types';
import { InstanceSet } from './instances';
import type { Palette } from './palette';

export const EDGE_WIDTH_PX = 2;
export const ARROW = { radius: 4.5, height: 12 };
export const LINK_KINDS: LinkKind[] = ['call', 'message', 'event', 'session', 'stream', 'shared'];

interface LineStyle { width: number; dash?: [number, number]; opacity: number }
export const LINE_STYLE: Record<LinkKind, LineStyle> = {
  call: { width: EDGE_WIDTH_PX, opacity: 0.95 },
  message: { width: EDGE_WIDTH_PX, dash: [8, 6], opacity: 0.95 },
  event: { width: EDGE_WIDTH_PX, dash: [1.2, 4], opacity: 0.95 },
  session: { width: 1.5, opacity: 0.95 },
  stream: { width: 3.5, opacity: 0.95 },
  shared: { width: 6, opacity: 0.45 },
};
/** Half the gap between the two lines of a session. */
export const SESSION_OFFSET = 2.4;
export const FLOW_SPACING = 40;
export const MARKER_SIZE = 7;

const UP = new THREE.Vector3(0, 1, 0);

/** Arrowhead pose: a cone along the last segment whose tip sits on the end point. */
export function arrowTransform(points: V3[]): { position: THREE.Vector3; quaternion: THREE.Quaternion; dir: THREE.Vector3 } {
  const end = points[points.length - 1], prev = points[points.length - 2];
  const dir = new THREE.Vector3(end.x - prev.x, end.y - prev.y, end.z - prev.z).normalize();
  return {
    dir,
    quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir),
    position: new THREE.Vector3(end.x, end.y, end.z).addScaledVector(dir, -ARROW.height / 2),
  };
}

/** Points every `spacing` along the path, not too close to the ends, with the direction there. */
export function flowMarks(points: V3[], spacing = FLOW_SPACING): { at: THREE.Vector3; dir: THREE.Vector3 }[] {
  const out: { at: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  const total = points.slice(1).reduce((k, p, i) => k + Math.hypot(p.x - points[i].x, p.y - points[i].y, p.z - points[i].z), 0);
  const count = Math.floor((total - ARROW.height * 2) / spacing);
  if (count < 1) return out;
  const step = (total - ARROW.height) / (count + 1);
  let walked = 0, next = step;
  for (let i = 1; i < points.length && out.length < count; i++) {
    const a = new THREE.Vector3(points[i - 1].x, points[i - 1].y, points[i - 1].z), b = new THREE.Vector3(points[i].x, points[i].y, points[i].z);
    const len = a.distanceTo(b);
    while (next <= walked + len && out.length < count) {
      out.push({ at: a.clone().lerp(b, (next - walked) / len), dir: b.clone().sub(a).normalize() });
      next += step;
    }
    walked += len;
  }
  return out;
}

/** A sideways unit vector for a segment (horizontal if possible). */
function side(a: V3, b: V3): THREE.Vector3 {
  const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
  const n = new THREE.Vector3().crossVectors(d, UP);
  return n.lengthSq() > 1e-6 ? n.normalize() : new THREE.Vector3(1, 0, 0);
}

function lineBatch(name: string, s: LineStyle): LineSegments2 {
  const mat = new LineMaterial({
    linewidth: s.width, worldUnits: false, vertexColors: true, transparent: true, opacity: s.opacity,
    dashed: !!s.dash, dashSize: s.dash?.[0] ?? 8, gapSize: s.dash?.[1] ?? 6,
  });
  const line = new LineSegments2(new LineSegmentsGeometry(), mat);
  line.name = name;
  line.frustumCulled = false;
  return line;
}

const pose = (at: THREE.Vector3, dir: THREE.Vector3) => new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromUnitVectors(UP, dir), new THREE.Vector3(1, 1, 1));
const reversed = (points: V3[]) => [...points].reverse();

export class EdgeBatch {
  readonly group = new THREE.Group();
  readonly lines = Object.fromEntries(LINK_KINDS.map((k) => [k, lineBatch(`edges-${k}`, LINE_STYLE[k])])) as Record<LinkKind, LineSegments2>;
  /** One arc per pair of closed containers (see core/lod/aggregate.ts). */
  readonly aggregate = lineBatch('edges-aggregate', LINE_STYLE.call);
  /** Arrowheads: "<id>" at the target, and "<id><" at the source of a session. */
  readonly arrows: InstanceSet;
  /** Flow marks along streams: "<id>~<n>". */
  readonly flow: InstanceSet;
  /** Squares at both ends of a shared link: "<id>[a" and "<id>[b". */
  readonly markers: InstanceSet;
  private readonly specs: EdgeSpec[];
  private readonly base: Map<string, THREE.Color>;
  private key = '';

  constructor(edges: EdgeSpec[], private pal: Palette) {
    this.specs = edges;
    const color = new THREE.Color(pal.edge);
    this.base = new Map(edges.map((e) => [e.id, new THREE.Color(e.color ? e.color[pal.name] : pal.edge)]));
    const item = (id: string, matrix: THREE.Matrix4) => ({ id, matrix, color, opacity: 0.95 });
    const arrowAt = (id: string, points: V3[]) => {
      const t = arrowTransform(points);
      return item(id, new THREE.Matrix4().compose(t.position, t.quaternion, new THREE.Vector3(1, 1, 1)));
    };
    const arrows = edges.flatMap((e) => (e.kind === 'shared' ? []
      : e.kind === 'session' ? [arrowAt(e.id, e.points), arrowAt(`${e.id}<`, reversed(e.points))] : [arrowAt(e.id, e.points)]));
    const flow = edges.filter((e) => e.kind === 'stream').flatMap((e) => flowMarks(e.points).map((f, i) => item(`${e.id}~${i}`, pose(f.at, f.dir))));
    const markers = edges.filter((e) => e.kind === 'shared').flatMap((e) => [
      item(`${e.id}[a`, new THREE.Matrix4().makeTranslation(e.points[0].x, e.points[0].y, e.points[0].z)),
      item(`${e.id}[b`, new THREE.Matrix4().makeTranslation(e.points[e.points.length - 1].x, e.points[e.points.length - 1].y, e.points[e.points.length - 1].z)),
    ]);
    this.arrows = new InstanceSet('arrows', new THREE.ConeGeometry(ARROW.radius, ARROW.height, 14), new THREE.MeshBasicMaterial(), arrows);
    this.flow = new InstanceSet('flow', new THREE.ConeGeometry(3.2, 7, 3), new THREE.MeshBasicMaterial(), flow);
    this.markers = new InstanceSet('markers', new THREE.BoxGeometry(MARKER_SIZE, MARKER_SIZE, MARKER_SIZE), new THREE.MeshBasicMaterial(), markers);
    this.group.name = 'edges';
    this.group.add(...LINK_KINDS.map((k) => this.lines[k]), this.aggregate, this.arrows.mesh, this.flow.mesh, this.markers.mesh);
    this.aggregate.visible = false;
    this.update(new Set(edges.map((e) => e.id)), (id) => this.baseColor(id));
  }

  get ids(): string[] { return this.specs.map((e) => e.id); }
  /** A link's own colour ([color: …] or a link style), else the palette's link colour. */
  baseColor(id: string): THREE.Color { return this.base.get(id)?.clone() ?? new THREE.Color(this.pal.edge); }
  /** Solid batch (calls) and dashed batch (messages), the names used before link kinds. */
  get solid(): LineSegments2 { return this.lines.call; }
  get dashed(): LineSegments2 { return this.lines.message; }

  /**
   * Show only `visible`, coloured by `colorOf`; dimmed edges get `opacityOf` < 1 on their arrow.
   * `aggregates` are drawn as extra polylines (no arrowheads).
   */
  update(
    visible: Set<string>, colorOf: (id: string) => THREE.Color, opacityOf: (id: string) => number = () => 1,
    aggregates: { points: V3[]; color: THREE.Color }[] = [],
  ): void {
    const key = this.specs.map((e) => (visible.has(e.id) ? `${colorOf(e.id).getHexString()}${opacityOf(e.id)}` : '-')).join('|')
      + aggregates.map((a) => {
        // The middle point tells an arc from a bundled curve between the same ends.
        const [p, m, q] = [a.points[0], a.points[a.points.length >> 1], a.points[a.points.length - 1]];
        return `${p.x},${p.z}~${m.x.toFixed(1)},${m.y.toFixed(1)},${m.z.toFixed(1)}>${q.x},${q.z}${a.color.getHexString()}`;
      }).join('|');
    if (key === this.key) return;
    this.key = key;
    const setLines = (line: LineSegments2, pos: number[], col: number[]) => {
      line.geometry.dispose();
      const g = new LineSegmentsGeometry();
      if (pos.length) { g.setPositions(pos); g.setColors(col); }
      line.geometry = g;
      line.visible = pos.length > 0;
      if (pos.length) line.computeLineDistances();
    };
    for (const kind of LINK_KINDS) {
      const pos: number[] = [], col: number[] = [];
      for (const e of this.specs) {
        if (e.kind !== kind || !visible.has(e.id)) continue;
        const c = colorOf(e.id);
        const offsets = kind === 'session' ? [SESSION_OFFSET, -SESSION_OFFSET] : [0];
        for (const o of offsets) {
          for (let i = 1; i < e.points.length; i++) {
            const a = e.points[i - 1], b = e.points[i];
            const n = o ? side(a, b).multiplyScalar(o) : { x: 0, y: 0, z: 0 };
            pos.push(a.x + n.x, a.y + n.y, a.z + n.z, b.x + n.x, b.y + n.y, b.z + n.z);
            col.push(c.r, c.g, c.b, c.r, c.g, c.b);
          }
        }
      }
      setLines(this.lines[kind], pos, col);
    }
    const pos: number[] = [], col: number[] = [];
    for (const a of aggregates) {
      for (let i = 1; i < a.points.length; i++) {
        const p = a.points[i - 1], q = a.points[i];
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        col.push(a.color.r, a.color.g, a.color.b, a.color.r, a.color.g, a.color.b);
      }
    }
    setLines(this.aggregate, pos, col);
    for (const set of [this.arrows, this.flow, this.markers]) {
      for (const id of set.ids) {
        const edge = id.replace(/(<|~\d+|\[a|\[b)$/, '');
        const on = visible.has(edge);
        set.setShown(id, on);
        if (on) { set.setColor(id, colorOf(edge)); set.setOpacity(id, opacityOf(edge)); }
      }
    }
  }

  setResolution(w: number, h: number): void {
    for (const l of [...Object.values(this.lines), this.aggregate]) (l.material as LineMaterial).resolution.set(w, h);
  }

  dispose(): void {
    for (const l of [...Object.values(this.lines), this.aggregate]) { l.geometry.dispose(); (l.material as LineMaterial).dispose(); }
    for (const set of [this.arrows, this.flow, this.markers]) set.dispose();
  }
}

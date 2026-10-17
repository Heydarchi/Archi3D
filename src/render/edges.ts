// All links in two batches — solid and dashed LineSegments2 (constant 2 px width) — plus one
// instanced cone per link as its arrowhead. Rebuilt only when the visible set or colours change.
import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { EdgeSpec, V3 } from '../core/types';
import { InstanceSet } from './instances';
import type { Palette } from './palette';

export const EDGE_WIDTH_PX = 2;
export const ARROW = { radius: 4.5, height: 12 };

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

function lineBatch(name: string, dashed: boolean): LineSegments2 {
  const mat = new LineMaterial({
    linewidth: EDGE_WIDTH_PX, worldUnits: false, vertexColors: true, transparent: true, opacity: 0.95,
    dashed, dashSize: 8, gapSize: 6,
  });
  const line = new LineSegments2(new LineSegmentsGeometry(), mat);
  line.name = name;
  line.frustumCulled = false;
  return line;
}

export class EdgeBatch {
  readonly group = new THREE.Group();
  readonly solid = lineBatch('edges-solid', false);
  readonly dashed = lineBatch('edges-dashed', true);
  /** One arc per pair of closed containers (see core/lod/aggregate.ts). */
  readonly aggregate = lineBatch('edges-aggregate', false);
  readonly arrows: InstanceSet;
  private readonly specs: EdgeSpec[];
  private key = '';

  constructor(edges: EdgeSpec[], private pal: Palette) {
    this.specs = edges;
    const items = edges.map((e) => {
      const t = arrowTransform(e.points);
      return { id: e.id, matrix: new THREE.Matrix4().compose(t.position, t.quaternion, new THREE.Vector3(1, 1, 1)), color: new THREE.Color(pal.edge), opacity: 0.95 };
    });
    this.arrows = new InstanceSet('arrows', new THREE.ConeGeometry(ARROW.radius, ARROW.height, 14), new THREE.MeshBasicMaterial(), items);
    this.group.name = 'edges';
    this.group.add(this.solid, this.dashed, this.aggregate, this.arrows.mesh);
    this.aggregate.visible = false;
    this.update(new Set(edges.map((e) => e.id)), () => new THREE.Color(pal.edge));
  }

  get ids(): string[] { return this.specs.map((e) => e.id); }
  isAsync(id: string): boolean { return !!this.specs.find((e) => e.id === id)?.async; }

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
    const fill = (line: LineSegments2, async: boolean) => {
      const pos: number[] = [], col: number[] = [];
      for (const e of this.specs) {
        if (e.async !== async || !visible.has(e.id)) continue;
        const c = colorOf(e.id);
        for (let i = 1; i < e.points.length; i++) {
          const a = e.points[i - 1], b = e.points[i];
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
      line.geometry.dispose();
      const g = new LineSegmentsGeometry();
      if (pos.length) {
        g.setPositions(pos);
        g.setColors(col);
      }
      line.geometry = g;
      line.visible = pos.length > 0;
      if (pos.length) line.computeLineDistances();
    };
    fill(this.solid, false);
    fill(this.dashed, true);
    const pos: number[] = [], col: number[] = [];
    for (const a of aggregates) {
      for (let i = 1; i < a.points.length; i++) {
        const p = a.points[i - 1], q = a.points[i];
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        col.push(a.color.r, a.color.g, a.color.b, a.color.r, a.color.g, a.color.b);
      }
    }
    this.aggregate.geometry.dispose();
    const g = new LineSegmentsGeometry();
    if (pos.length) { g.setPositions(pos); g.setColors(col); }
    this.aggregate.geometry = g;
    this.aggregate.visible = pos.length > 0;
    for (const e of this.specs) {
      const on = visible.has(e.id);
      this.arrows.setShown(e.id, on);
      if (on) { this.arrows.setColor(e.id, colorOf(e.id)); this.arrows.setOpacity(e.id, opacityOf(e.id)); }
    }
  }

  setResolution(w: number, h: number): void {
    for (const l of [this.solid, this.dashed, this.aggregate]) (l.material as LineMaterial).resolution.set(w, h);
  }

  dispose(): void {
    for (const l of [this.solid, this.dashed, this.aggregate]) { l.geometry.dispose(); (l.material as LineMaterial).dispose(); }
    this.arrows.dispose();
  }
}

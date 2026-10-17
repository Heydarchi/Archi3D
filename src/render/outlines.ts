// Thin outlines of every shown block and closed lid in one LineSegments batch.
import * as THREE from 'three';

/** `edges`: the outline of the unit shape, placed with `matrix`. */
export interface OutlineItem { id: string; matrix: THREE.Matrix4; edges: THREE.BufferGeometry }

export class OutlineBatch {
  readonly lines: THREE.LineSegments;
  private key = '';

  constructor(private items: OutlineItem[]) {
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true }));
    this.lines.name = 'outlines';
    this.lines.frustumCulled = false;
  }

  /** Rebuild for the given shown ids and colours (no-op if nothing changed). */
  update(shown: (id: string) => boolean, colorOf: (id: string) => THREE.Color): void {
    const visible = this.items.filter((it) => shown(it.id));
    const key = visible.map((it) => `${it.id}:${colorOf(it.id).getHexString()}`).join('|');
    if (key === this.key) return;
    this.key = key;
    const pos: number[] = [], col: number[] = [];
    const v = new THREE.Vector3();
    for (const it of visible) {
      const src = it.edges.attributes.position;
      const c = colorOf(it.id);
      for (let i = 0; i < src.count; i++) {
        v.fromBufferAttribute(src, i).applyMatrix4(it.matrix);
        pos.push(v.x, v.y, v.z);
        col.push(c.r, c.g, c.b);
      }
    }
    this.lines.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.lines.geometry = g;
  }

  dispose(): void {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}

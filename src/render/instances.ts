// One InstancedMesh for many elements of the same kind, addressed by id: show/hide (zero scale),
// per-instance colour and per-instance opacity (a small shader patch on the material).
import * as THREE from 'three';

/** Adds a per-instance `instanceOpacity` attribute to a built-in material. */
export function withInstanceOpacity<M extends THREE.Material>(m: M): M {
  m.transparent = true;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= vInstanceOpacity;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'instanceOpacity';
  return m;
}

export interface InstanceItem { id: string; matrix: THREE.Matrix4; color: THREE.Color; opacity?: number }

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class InstanceSet {
  readonly mesh: THREE.InstancedMesh;
  readonly ids: string[];
  private readonly index = new Map<string, number>();
  private readonly matrices: THREE.Matrix4[];
  private readonly baseColors: THREE.Color[];
  private readonly baseOpacity: number[];
  private readonly shown: boolean[];
  private readonly opacity: THREE.InstancedBufferAttribute;

  constructor(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, items: InstanceItem[]) {
    const n = Math.max(1, items.length);
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1);
    geometry.setAttribute('instanceOpacity', this.opacity);
    this.mesh = new THREE.InstancedMesh(geometry, withInstanceOpacity(material), n);
    this.mesh.name = name;
    this.mesh.count = items.length;
    this.mesh.frustumCulled = false;
    this.ids = items.map((i) => i.id);
    this.matrices = items.map((i) => i.matrix.clone());
    this.baseColors = items.map((i) => i.color.clone());
    this.baseOpacity = items.map((i) => i.opacity ?? 1);
    this.shown = items.map(() => true);
    items.forEach((it, i) => {
      this.index.set(it.id, i);
      this.mesh.setMatrixAt(i, it.matrix);
      this.mesh.setColorAt(i, it.color);
      this.opacity.setX(i, it.opacity ?? 1);
    });
    this.commit();
  }

  get size(): number { return this.ids.length; }
  has(id: string): boolean { return this.index.has(id); }
  indexOf(id: string): number | undefined { return this.index.get(id); }
  matrixOf(id: string): THREE.Matrix4 | undefined { const i = this.index.get(id); return i === undefined ? undefined : this.matrices[i]; }
  baseColor(id: string): THREE.Color | undefined { const i = this.index.get(id); return i === undefined ? undefined : this.baseColors[i]; }
  isShown(id: string): boolean { const i = this.index.get(id); return i !== undefined && this.shown[i]; }
  opacityOf(id: string): number { const i = this.index.get(id); return i === undefined ? 0 : this.opacity.getX(i); }
  colorOf(id: string): THREE.Color { const c = new THREE.Color(); const i = this.index.get(id); if (i !== undefined) this.mesh.getColorAt(i, c); return c; }

  setShown(id: string, on: boolean): void {
    const i = this.index.get(id);
    if (i === undefined || this.shown[i] === on) return;
    this.shown[i] = on;
    this.mesh.setMatrixAt(i, on ? this.matrices[i] : ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Opacity as a fraction of the instance's base opacity. */
  setOpacity(id: string, a: number): void {
    const i = this.index.get(id);
    if (i === undefined) return;
    this.opacity.setX(i, a * this.baseOpacity[i]);
    this.opacity.needsUpdate = true;
  }

  setColor(id: string, c: THREE.Color): void {
    const i = this.index.get(id);
    if (i === undefined) return;
    this.mesh.setColorAt(i, c);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  commit(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.opacity.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.mesh.computeBoundingBox();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    ([] as THREE.Material[]).concat(this.mesh.material).forEach((m) => m.dispose());
    this.mesh.dispose();
  }
}

export const boxMatrix = (c: { x: number; y: number; z: number }, s: { x: number; y: number; z: number }): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(c.x, c.y, c.z), new THREE.Quaternion(), new THREE.Vector3(s.x, s.y, s.z));

// SceneSpec → three.js objects. Needs no renderer, so it runs in Node for unit tests.
// Every kind of element is one instanced draw (or one line batch), so 1,000 components stay
// well under 60 draw calls: plates, lids, blocks, cylinders, ports, outlines, two edge batches,
// arrowheads and the ground grid.
import * as THREE from 'three';
import { lidSpecs } from '../core/lod/lids';
import type { ArchModel, SceneSpec } from '../core/types';
import { EdgeBatch } from './edges';
import { boxMatrix, InstanceSet } from './instances';
import { OutlineBatch } from './outlines';
import { LIGHT, type Palette } from './palette';

export interface SceneObjects {
  root: THREE.Group;
  plates: InstanceSet;
  /** One lid per container, shown (faded in) when it is closed. */
  lids: InstanceSet;
  /** Box-like blocks (box, queue, ext). */
  blocks: InstanceSet;
  /** Database blocks. */
  cylinders: InstanceSet;
  ports: InstanceSet;
  edges: EdgeBatch;
  outlines: OutlineBatch;
  labels: THREE.Group;
  ground: THREE.Object3D;
}

export const PORT_RADIUS = 4.5;
export const EXT_OPACITY = 0.85;

function ground(scene: SceneSpec, pal: Palette): THREE.GridHelper {
  const { min, max } = scene.bounds;
  const size = Math.ceil((Math.max(max.x - min.x, max.z - min.z) * 1.6) / 100) * 100 || 400;
  // Coarser cells for big models, so the ground does not turn into moiré from far away.
  const grid = new THREE.GridHelper(size, Math.max(10, Math.min(60, Math.round(size / 40))), pal.grid, pal.grid);
  grid.position.set((min.x + max.x) / 2, -1, (min.z + max.z) / 2);
  grid.userData = { kind: 'ground' };
  return grid;
}

export function buildSceneObjects(scene: SceneSpec, pal: Palette = LIGHT, model?: ArchModel): SceneObjects {
  const color = (hex: number) => new THREE.Color(hex);
  const plates = new InstanceSet('plates', new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    scene.plates.map((p) => ({ id: p.id, matrix: boxMatrix(p.center, p.size), color: color(pal.plates[p.depth % pal.plates.length]), opacity: pal.plateOpacity })));

  const depthOf = new Map(scene.plates.map((p) => [p.id, p.depth]));
  const lidList = model ? lidSpecs(scene, model) : [];
  const lids = new InstanceSet('lids', new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    lidList.map((l) => ({
      id: l.id, matrix: boxMatrix(l.center, l.size), opacity: 0.96,
      color: color(pal.plates[(depthOf.get(l.id) ?? 0) % pal.plates.length]).lerp(color(pal.ink), 0.08),
    })));
  for (const l of lidList) { lids.setShown(l.id, false); lids.setOpacity(l.id, 0); }

  const blockItem = (b: SceneSpec['blocks'][number]) => ({
    id: b.id, matrix: boxMatrix(b.center, b.size), color: color(pal.block[b.shape]), opacity: b.shape === 'ext' ? EXT_OPACITY : 1,
  });
  const blocks = new InstanceSet('blocks', new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), scene.blocks.filter((b) => b.shape !== 'db').map(blockItem));
  const cylinders = new InstanceSet('cylinders', new THREE.CylinderGeometry(0.5, 0.5, 1, 40),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), scene.blocks.filter((b) => b.shape === 'db').map(blockItem));

  const ports = new InstanceSet('ports', new THREE.SphereGeometry(PORT_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ roughness: 0.4 }),
    scene.ports.map((p) => ({ id: p.id, matrix: new THREE.Matrix4().makeTranslation(p.pos.x, p.pos.y, p.pos.z), color: color(p.dir === 'in' ? pal.in : pal.out) })));

  const edges = new EdgeBatch(scene.edges, pal);
  const outlines = new OutlineBatch([
    ...scene.blocks.map((b) => ({ id: b.id, matrix: boxMatrix(b.center, b.size), cylinder: b.shape === 'db' })),
    ...lidList.map((l) => ({ id: `lid:${l.id}`, matrix: boxMatrix(l.center, l.size), cylinder: false })),
  ]);
  outlines.update((id) => !id.startsWith('lid:'), () => color(pal.outline));

  plates.mesh.renderOrder = 0;
  blocks.mesh.renderOrder = 1;
  cylinders.mesh.renderOrder = 1;
  ports.mesh.renderOrder = 1;
  lids.mesh.renderOrder = 2;

  const labels = new THREE.Group();
  labels.name = 'labels';
  const grid = ground(scene, pal);
  const root = new THREE.Group();
  root.name = 'archi';
  root.add(grid, plates.mesh, blocks.mesh, cylinders.mesh, ports.mesh, outlines.lines, edges.group, lids.mesh, labels);
  return { root, plates, lids, blocks, cylinders, ports, edges, outlines, labels, ground: grid };
}

/** Free every geometry and material under `obj`. */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    if (m.material) ([] as THREE.Material[]).concat(m.material).forEach((x) => x.dispose());
  });
}

/** Holds the current scene's objects; setScene() replaces them and disposes the old ones. */
export class SceneRoot {
  readonly group = new THREE.Group();
  objects: SceneObjects | null = null;
  constructor(private palette: Palette = LIGHT) {}

  setScene(scene: SceneSpec, model?: ArchModel): SceneObjects {
    this.clear();
    this.objects = buildSceneObjects(scene, this.palette, model);
    this.group.add(this.objects.root);
    return this.objects;
  }

  clear(): void {
    if (!this.objects) return;
    this.group.remove(this.objects.root);
    disposeObject(this.objects.root);
    this.objects = null;
  }

  dispose(): void { this.clear(); }
}

/** Renderable draws in a tree: meshes, instanced meshes and line batches that are visible. */
export function countDrawCalls(root: THREE.Object3D): number {
  let n = 0;
  const visit = (o: THREE.Object3D) => {
    if (!o.visible || o.name === 'labels') return;
    if ((o as THREE.InstancedMesh).isInstancedMesh) { if ((o as THREE.InstancedMesh).count > 0) n++; }
    else if ((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.LineSegments).isLineSegments) n++;
    o.children.forEach(visit);
  };
  visit(root);
  return n;
}

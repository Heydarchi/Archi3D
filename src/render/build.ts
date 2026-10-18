// SceneSpec → three.js objects. Needs no renderer, so it runs in Node for unit tests.
// Every kind of element is one instanced draw (or one line batch), so 1,000 components stay
// well under 60 draw calls: plates, lids, one mesh per block shape in use, ports, outlines, the
// edge batches, arrowheads and the ground grid.
import * as THREE from 'three';
import { lidSpecs } from '../core/lod/lids';
import { colorGroups, type ColorBy, type ColorGroups } from '../core/model/colorBy';
import type { ArchModel, ColorPair, Id, SceneSpec } from '../core/types';
import { EdgeBatch } from './edges';
import { boxMatrix, InstanceSet } from './instances';
import { OutlineBatch } from './outlines';
import { LIGHT, type Palette } from './palette';
import { BODIES, blockParts, bodyEdges, bodyGeometry, meshName, type Body } from './shapes';

export interface SceneObjects {
  root: THREE.Group;
  plates: InstanceSet;
  /** One lid per container, shown (faded in) when it is closed. */
  lids: InstanceSet;
  /** Box-like blocks (box, queue, ext) and the bases of person, ui and app. */
  blocks: InstanceSet;
  /** Database blocks. */
  cylinders: InstanceSet;
  /** Every block mesh, one per body (see shapes.ts), blocks and cylinders first. Ids may end in "#base". */
  bodies: InstanceSet[];
  ports: InstanceSet;
  edges: EdgeBatch;
  outlines: OutlineBatch;
  labels: THREE.Group;
  ground: THREE.Object3D;
  /** Groups and their colours when colouring by layer, container or tag (null: the normal look). */
  legend: ColorGroups['legend'] | null;
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

/** How much of your colour goes into a container's plate (the rest is the normal plate colour). */
export const PLATE_TINT = 0.5;

export function buildSceneObjects(scene: SceneSpec, pal: Palette = LIGHT, model?: ArchModel, colorBy: ColorBy = 'kind'): SceneObjects {
  const color = (hex: number) => new THREE.Color(hex);
  // Your colour for an element: its group colour when colouring by group, else its own [color: …].
  const groups = model ? colorGroups(model, colorBy) : null;
  const own = (id: Id, spec?: ColorPair): THREE.Color | null => {
    const pair = groups ? groups.colorOf[id] : spec;
    return pair ? new THREE.Color(pair[pal.name]) : null;
  };
  const plateColor = (id: Id, depth: number, spec?: ColorPair) => {
    const base = color(pal.plates[depth % pal.plates.length]);
    const c = own(id, spec);
    return c ? base.lerp(c, PLATE_TINT) : base;
  };
  const specOf = new Map(scene.plates.map((p) => [p.id, p.color]));
  const plates = new InstanceSet('plates', new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    scene.plates.map((p) => ({ id: p.id, matrix: boxMatrix(p.center, p.size), color: plateColor(p.id, p.depth, p.color), opacity: pal.plateOpacity })));

  const depthOf = new Map(scene.plates.map((p) => [p.id, p.depth]));
  const lidList = model ? lidSpecs(scene, model) : [];
  const lids = new InstanceSet('lids', new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    lidList.map((l) => ({
      id: l.id, matrix: boxMatrix(l.center, l.size), opacity: 0.96,
      color: plateColor(l.id, depthOf.get(l.id) ?? 0, specOf.get(l.id)).lerp(color(pal.ink), 0.08),
    })));
  for (const l of lidList) { lids.setShown(l.id, false); lids.setOpacity(l.id, 0); }

  const parts = scene.blocks.flatMap((b) => blockParts(b).map((p) => ({ ...p, shape: b.shape, own: own(b.id, b.color) })));
  const bodies = BODIES.map((body: Body) => new InstanceSet(meshName(body), bodyGeometry(body),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }),
    parts.filter((p) => p.body === body).map((p) => ({
      id: p.id, matrix: p.matrix, color: p.own ?? color(pal.block[p.shape]), opacity: p.shape === 'ext' ? EXT_OPACITY : 1,
    }))));
  const [blocks, cylinders] = bodies;

  const ports = new InstanceSet('ports', new THREE.SphereGeometry(PORT_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ roughness: 0.4 }),
    scene.ports.map((p) => ({ id: p.id, matrix: new THREE.Matrix4().makeTranslation(p.pos.x, p.pos.y, p.pos.z), color: color(p.dir === 'in' ? pal.in : pal.out) })));

  const edges = new EdgeBatch(scene.edges, pal);
  const outlines = new OutlineBatch([
    ...parts.map((p) => ({ id: p.id, matrix: p.matrix, edges: bodyEdges(p.body) })),
    ...lidList.map((l) => ({ id: `lid:${l.id}`, matrix: boxMatrix(l.center, l.size), edges: bodyEdges('box') })),
  ]);
  outlines.update((id) => !id.startsWith('lid:'), () => color(pal.outline));

  plates.mesh.renderOrder = 0;
  for (const set of bodies) set.mesh.renderOrder = 1;
  ports.mesh.renderOrder = 1;
  lids.mesh.renderOrder = 2;

  const labels = new THREE.Group();
  labels.name = 'labels';
  const grid = ground(scene, pal);
  const root = new THREE.Group();
  root.name = 'archi';
  root.add(grid, plates.mesh, ...bodies.map((set) => set.mesh), ports.mesh, outlines.lines, edges.group, lids.mesh, labels);
  return { root, plates, lids, blocks, cylinders, bodies, ports, edges, outlines, labels, ground: grid, legend: groups?.legend ?? null };
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

  setScene(scene: SceneSpec, model?: ArchModel, colorBy: ColorBy = 'kind'): SceneObjects {
    this.clear();
    this.objects = buildSceneObjects(scene, this.palette, model, colorBy);
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

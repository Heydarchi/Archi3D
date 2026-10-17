// One unit-size geometry (inside the -0.5..0.5 cube) per kind of block. A block's matrix scales it
// to the block size. person, screen and phone are a figure on a flat base (a separate "<id>#base"
// box), so the figure keeps its proportions on a wide footprint.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PEDESTAL } from '../core/scene/lift';
import type { BlockSpec, Shape } from '../core/types';
import { boxMatrix } from './instances';

export type Body = 'box' | 'cylinder' | 'hex' | 'octagon' | 'library' | 'chip' | 'device' | 'storage' | 'topic' | 'person' | 'screen' | 'phone';

export const BODY_OF: Record<Shape, Body> = {
  box: 'box', ext: 'box', queue: 'box', db: 'cylinder', cache: 'hex', kernel: 'octagon', library: 'library', chip: 'chip',
  device: 'device', storage: 'storage', topic: 'topic', person: 'person', screen: 'screen', phone: 'phone',
};
/** Order of the instanced meshes; "box" and "cylinder" keep their old names. */
export const BODIES: Body[] = ['box', 'cylinder', 'hex', 'octagon', 'library', 'chip', 'device', 'storage', 'topic', 'person', 'screen', 'phone'];
export const meshName = (b: Body) => (b === 'box' ? 'blocks' : b === 'cylinder' ? 'cylinders' : `blocks-${b}`);

export const BASE_SUFFIX = '#base';
/** The element a picked or shown instance belongs to ("Cam#base" → "Cam"). */
export const elementOf = (id: string) => (id.endsWith(BASE_SUFFIX) ? id.slice(0, -BASE_SUFFIX.length) : id);

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r: number, h: number, seg: number, y = 0) => new THREE.CylinderGeometry(r, r, h, seg).translate(0, y, 0);
const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map((p) => p.toNonIndexed()))!;

function makeGeometry(b: Body): THREE.BufferGeometry {
  switch (b) {
    case 'box': return new THREE.BoxGeometry(1, 1, 1);
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 40);
    case 'hex': return new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateY(Math.PI / 6);
    case 'octagon': return new THREE.CylinderGeometry(0.5, 0.5, 1, 8).rotateY(Math.PI / 8);
    // Three steps, each one smaller: layers of code.
    case 'library': return merge([box(1, 0.34, 1, 0, -0.33), box(0.86, 0.34, 0.86, 0, 0), box(0.72, 0.32, 0.72, 0, 0.34)]);
    // A flat body with pins on the long sides.
    case 'chip': {
      const pins = [-0.32, -0.16, 0, 0.16, 0.32].flatMap((x) => [box(0.07, 0.35, 0.12, x, -0.325, 0.44), box(0.07, 0.35, 0.12, x, -0.325, -0.44)]);
      return merge([box(0.86, 1, 0.76), ...pins]);
    }
    // A box on four feet.
    case 'device': {
      const feet = [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z]) => box(0.1, 0.18, 0.1, x, -0.41, z));
      return merge([box(1, 0.82, 1, 0, 0.09), ...feet]);
    }
    // Three disks.
    case 'storage': return merge([cyl(0.5, 0.28, 40, -0.36), cyl(0.5, 0.28, 40, 0), cyl(0.5, 0.28, 40, 0.36)]);
    // A pipe lying along x.
    case 'topic': return new THREE.CylinderGeometry(0.5, 0.5, 1, 32).rotateZ(Math.PI / 2);
    case 'person': return merge([new THREE.CylinderGeometry(0.3, 0.5, 0.56, 28).translate(0, -0.22, 0), new THREE.SphereGeometry(0.22, 24, 16).translate(0, 0.28, 0)]);
    // A panel on a short stand.
    case 'screen': return merge([box(1, 0.74, 1, 0, 0.13), box(0.12, 0.28, 0.5, 0, -0.36)]);
    case 'phone': return new THREE.BoxGeometry(1, 1, 1);
  }
}

const geometries = new Map<Body, THREE.BufferGeometry>();
/** A new copy of the body's geometry (each InstanceSet owns and disposes its own). */
export const bodyGeometry = (b: Body): THREE.BufferGeometry => {
  if (!geometries.has(b)) geometries.set(b, makeGeometry(b));
  return geometries.get(b)!.clone();
};

const edges = new Map<Body, THREE.EdgesGeometry>();
/** Outline segments of the unit body, shared and never disposed. */
export const bodyEdges = (b: Body): THREE.EdgesGeometry => {
  if (!edges.has(b)) edges.set(b, new THREE.EdgesGeometry(makeGeometry(b), 30));
  return edges.get(b)!;
};

export interface BlockPart { id: string; body: Body; matrix: THREE.Matrix4 }

/** The instances one block is drawn with: its body, and for person/screen/phone a base below it. */
export function blockParts(b: BlockSpec): BlockPart[] {
  const body = BODY_OF[b.shape];
  const frac = PEDESTAL[b.shape];
  if (frac === undefined) return [{ id: b.id, body, matrix: boxMatrix(b.center, b.size) }];
  const { x: w, y: h, z: d } = b.size;
  const bottom = b.center.y - h / 2;
  const baseH = h * frac, figH = h - baseH;
  const fig = { x: b.center.x, y: bottom + baseH + figH / 2, z: b.center.z };
  const size = body === 'person' ? { x: Math.min(w, d) * 0.8, y: figH, z: Math.min(w, d) * 0.8 }
    : body === 'screen' ? { x: Math.min(w * 0.8, figH * 1.9), y: figH, z: Math.min(d * 0.25, 8) }
      : { x: Math.min(w * 0.4, figH * 0.62), y: figH, z: Math.min(d * 0.25, 7) };
  return [
    { id: `${b.id}${BASE_SUFFIX}`, body: 'box', matrix: boxMatrix({ x: b.center.x, y: bottom + baseH / 2, z: b.center.z }, { x: w, y: baseH, z: d }) },
    { id: b.id, body, matrix: boxMatrix(fig, size) },
  ];
}

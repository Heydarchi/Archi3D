// Layers: when you look at one floor from close by, the floors above it (and below the camera)
// would cover it. They fade out, and their labels go. From far away nothing fades.
import type { CameraState, Id, SceneSpec, V3 } from '../types';
import { footprintDiagonal } from './focus';

/** Fade only when the camera is within this many footprint diagonals of the floor you look at. */
export const FADE_WITHIN = 1.6;

const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The floor you look at: the one whose height band holds the camera target (else the nearest). */
export function focusFloor(scene: SceneSpec, cam: CameraState): Id | null {
  const floors = scene.floors;
  if (!floors?.length) return null;
  const t = cam.target.y;
  const inside = floors.find((f) => t >= f.y && t < f.top);
  if (inside) return inside.id;
  const lowest = floors[floors.length - 1];
  return t < lowest.y ? lowest.id : floors[0].id;
}

export function fadedFloors(scene: SceneSpec, cam: CameraState): Set<Id> {
  const id = focusFloor(scene, cam);
  const focus = scene.floors?.find((f) => f.id === id);
  if (!focus || dist(cam.position, cam.target) > FADE_WITHIN * footprintDiagonal(focus.size)) return new Set();
  return new Set(scene.floors!.filter((f) => f.y > focus.y && f.y < cam.position.y).map((f) => f.id));
}

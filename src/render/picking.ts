// Raycast picking against blocks and plates, and lids only while a container is closed.
import * as THREE from 'three';
import type { Id } from '../core/types';
import type { SceneObjects } from './build';
import { elementOf } from './shapes';
import type { InstanceSet } from './instances';

/** The id under a pixel (x, y in CSS pixels from the canvas's top-left), or null. */
export function pick(objects: SceneObjects, camera: THREE.Camera, x: number, y: number, w: number, h: number): Id | null {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), camera);
  const sets: InstanceSet[] = [objects.lids, ...objects.bodies, objects.plates].filter((s) => s.size > 0);
  for (const s of sets) s.mesh.computeBoundingSphere();
  const hits = ray.intersectObjects(sets.map((s) => s.mesh), false);
  for (const hit of hits) {
    const set = sets.find((s) => s.mesh === hit.object);
    if (set && hit.instanceId !== undefined) {
      const id = set.ids[hit.instanceId];
      if (set === objects.lids && set.opacityOf(id) < 0.5) continue; // a fading-out lid
      return elementOf(id);
    }
  }
  return null;
}

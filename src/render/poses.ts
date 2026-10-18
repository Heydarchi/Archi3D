// Camera poses computed from a scene's bounds: far, mid, near, iso.
import * as THREE from 'three';
import { lidSpecs } from '../core/lod/lids';
import type { ArchModel, CameraState, Id, SceneSpec, V3 } from '../core/types';

export type PoseName = 'far' | 'mid' | 'near' | 'iso' | 'stack';
export const FOV = 40;
const FAR_ELEVATION = 50, ISO_ELEVATION = 45, ISO_AZIMUTH = 45;
/** Low and from the side, to see floors (layers) above each other. */
const STACK_ELEVATION = 18, STACK_AZIMUTH = 30;

const deg = THREE.MathUtils.degToRad;

/** Unit vector from target to camera for an elevation above ground and an azimuth around y (0 = from +z). */
function direction(elevationDeg: number, azimuthDeg: number): V3 {
  const e = deg(elevationDeg), a = deg(azimuthDeg);
  return { x: Math.cos(e) * Math.sin(a), y: Math.sin(e), z: Math.cos(e) * Math.cos(a) };
}

/** Distance at which a sphere of `radius` fits the narrower of the two fields of view. */
export function fitDistance(radius: number, aspect: number, fovDeg = FOV): number {
  const v = deg(fovDeg) / 2;
  const h = Math.atan(Math.tan(v) * aspect);
  return (radius / Math.sin(Math.min(v, h))) * 1.04;
}

const centreOf = (s: SceneSpec): V3 => ({
  x: (s.bounds.min.x + s.bounds.max.x) / 2, y: (s.bounds.min.y + s.bounds.max.y) / 2, z: (s.bounds.min.z + s.bounds.max.z) / 2,
});

/**
 * Smallest distance along `dir` from which every corner of the box lies inside the view
 * (a tight fit, unlike a bounding sphere). Camera-space x/y of a point p relative to the
 * target are p·right and p·up; its depth is dist − p·dir.
 */
export function fitBoxDistance(center: V3, size: V3, dir: V3, aspect: number, fovDeg = FOV, margin = 1.06): number {
  const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
  const up = new THREE.Vector3().crossVectors(d, right);
  const tanV = Math.tan(deg(fovDeg) / 2) / margin, tanH = tanV * aspect;
  let dist = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.Vector3(sx * size.x / 2, sy * size.y / 2, sz * size.z / 2);
    const depth = p.dot(d);
    dist = Math.max(dist, Math.abs(p.dot(right)) / tanH + depth, Math.abs(p.dot(up)) / tanV + depth);
  }
  return dist;
}

const sizeOf = (s: SceneSpec): V3 => ({
  x: s.bounds.max.x - s.bounds.min.x, y: s.bounds.max.y - s.bounds.min.y, z: s.bounds.max.z - s.bounds.min.z,
});

const place = (target: V3, dir: V3, dist: number, viewportH: number): CameraState => ({
  position: { x: target.x + dir.x * dist, y: target.y + dir.y * dist, z: target.z + dir.z * dist },
  target, fovDeg: FOV, viewportH,
});

/** Frame a box (centre + size) from the far direction. */
export function framePose(center: V3, size: V3, aspect: number, viewportH: number, scale = 1): CameraState {
  const r = (Math.hypot(size.x, size.y, size.z) / 2) * scale;
  return place(center, direction(FAR_ELEVATION, 0), fitDistance(r, aspect), viewportH);
}

export function cameraPose(pose: PoseName, scene: SceneSpec, aspect: number, viewportH: number): CameraState {
  const c = centreOf(scene), size = sizeOf(scene);
  const far = direction(FAR_ELEVATION, 0), iso = direction(ISO_ELEVATION, ISO_AZIMUTH);
  const farDist = Math.max(fitBoxDistance(c, size, far, aspect), 10);
  switch (pose) {
    case 'far': return place(c, far, farDist, viewportH);
    case 'mid': return place(c, far, farDist * 0.4, viewportH);
    case 'iso': return place(c, iso, Math.max(fitBoxDistance(c, size, iso, aspect), 10), viewportH);
    case 'stack': { const d = direction(STACK_ELEVATION, STACK_AZIMUTH); return place(c, d, Math.max(fitBoxDistance(c, size, d, aspect), 10), viewportH); }
    case 'near': {
      const block = [...scene.blocks].sort((a, b) =>
        Math.hypot(a.center.x - c.x, a.center.z - c.z) - Math.hypot(b.center.x - c.x, b.center.z - c.z) || a.id.localeCompare(b.id))[0];
      if (!block) return cameraPose('far', scene, aspect, viewportH);
      return framePose(block.center, block.size, aspect, viewportH, 1.9);
    }
  }
}

/** A perspective camera for a CameraState, with near/far planes that hold the scene. */
export function toPerspective(state: CameraState, aspect: number, camera = new THREE.PerspectiveCamera()): THREE.PerspectiveCamera {
  const { position: p, target: t } = state;
  const dist = Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
  camera.fov = state.fovDeg;
  camera.aspect = aspect;
  camera.near = Math.max(0.5, dist / 200);
  camera.far = dist * 20 + 5000;
  camera.position.set(p.x, p.y, p.z);
  camera.up.set(0, 1, 0);
  camera.lookAt(t.x, t.y, t.z);
  camera.updateProjectionMatrix();
  return camera;
}

/** Context kept around a component when flying in, as a multiple of its footprint. */
export const FLY_COMPONENT_CONTEXT = 2.6;

/**
 * Where to fly for an element: a component is framed with some context around it, a container
 * with its whole subtree (its lid box). Null if the id is unknown.
 */
export function flyTarget(scene: SceneSpec, model: ArchModel, id: Id, aspect: number, viewportH: number): CameraState | null {
  const dir = direction(FAR_ELEVATION, 0);
  const block = scene.blocks.find((b) => b.id === id);
  if (block) {
    const k = FLY_COMPONENT_CONTEXT;
    const size = { x: block.size.x * k, y: block.size.y, z: block.size.z * k };
    return place(block.center, dir, fitBoxDistance(block.center, size, dir, aspect), viewportH);
  }
  const lid = lidSpecs(scene, model).find((l) => l.id === id);
  if (!lid) return null;
  return place(lid.center, dir, fitBoxDistance(lid.center, lid.size, dir, aspect), viewportH);
}

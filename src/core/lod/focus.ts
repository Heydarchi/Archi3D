// A camera looking at one element from k × its footprint diagonal (for tests and fly-to).
import type { CameraState, Id, SceneSpec, V3 } from '../types';

export const FOCUS_ELEVATION_DEG = 50;
export const FOCUS_FOV_DEG = 40;

export const footprintDiagonal = (size: V3): number => Math.hypot(size.x, size.z);

export function focusCamera(scene: SceneSpec, id: Id, k: number, viewportH: number): CameraState {
  const el = scene.plates.find((p) => p.id === id) ?? scene.blocks.find((b) => b.id === id);
  if (!el) throw new Error(`No plate or block "${id}"`);
  const e = (FOCUS_ELEVATION_DEG * Math.PI) / 180;
  const d = k * footprintDiagonal(el.size);
  const t = el.center;
  return {
    position: { x: t.x, y: t.y + Math.sin(e) * d, z: t.z + Math.cos(e) * d },
    target: { ...t }, fovDeg: FOCUS_FOV_DEG, viewportH,
  };
}

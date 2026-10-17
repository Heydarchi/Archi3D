// Lid boxes for closed containers: same footprint as the plate, tall enough to cover the subtree.
import type { ArchModel, Id, PlateSpec, SceneSpec, V3 } from '../types';

export interface LidSpec { id: Id; center: V3; size: V3 }

export const LID_CLEARANCE = 6;

export function lidSpecs(scene: SceneSpec, model: ArchModel): LidSpec[] {
  const tops = new Map<Id, number>();
  for (const b of scene.blocks) tops.set(b.id, b.center.y + b.size.y / 2);
  for (const p of scene.plates) tops.set(p.id, p.center.y + p.size.y / 2);
  const subtreeTop = (id: Id): number =>
    Math.max(tops.get(id) ?? -Infinity, ...(model.nodes[id]?.children ?? []).map(subtreeTop));
  return scene.plates.map((p: PlateSpec) => {
    const bottom = p.center.y - p.size.y / 2;
    const top = Math.max(subtreeTop(p.id), bottom + p.size.y) + LID_CLEARANCE;
    return { id: p.id, center: { x: p.center.x, y: (bottom + top) / 2, z: p.center.z }, size: { x: p.size.x, y: top - bottom, z: p.size.z } };
  });
}

/** Where a closed container's title goes: the top-left corner of its lid's top face. */
export const lidTitleAnchor = (l: LidSpec): V3 =>
  ({ x: l.center.x - l.size.x / 2 + 10, y: l.center.y + l.size.y / 2 + 2, z: l.center.z - l.size.z / 2 + 16 });

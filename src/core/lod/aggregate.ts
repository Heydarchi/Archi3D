// Links whose end is inside a closed container are drawn as one aggregated link per pair of
// stand-ins (the outermost closed container, or the component itself), not one route each.
import type { ArchModel, Id, LodResult } from '../types';

export interface AggregateLink { from: Id; to: Id; ids: string[]; async: boolean }

/** The outermost closed container holding a node (what stands in for it on screen), or the node. */
export function standIn(model: ArchModel, r: Pick<LodResult, 'containers'>, id: Id): Id {
  let rep = id;
  for (let p = model.nodes[id]?.parent ?? null; p !== null; p = model.nodes[p].parent) {
    if (r.containers[p] === 'closed') rep = p;
  }
  return rep;
}

export function splitEdges(model: ArchModel, r: LodResult): { direct: Set<string>; aggregates: AggregateLink[] } {
  const direct = new Set<string>();
  const groups = new Map<string, AggregateLink>();
  for (const e of model.edges) {
    if (!r.visibleEdges.has(e.id)) continue;
    const a = standIn(model, r, e.from.node), b = standIn(model, r, e.to.node);
    if (a === e.from.node && b === e.to.node) { direct.add(e.id); continue; }
    const key = `${a}\u0000${b}`;
    const g = groups.get(key);
    if (g) { g.ids.push(e.id); g.async &&= e.async; }
    else groups.set(key, { from: a, to: b, ids: [e.id], async: e.async });
  }
  return { direct, aggregates: [...groups.values()] };
}

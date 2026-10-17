// Questions about a model used by selection, the info panel and the breadcrumb.
import type { ArchModel, Id, ModelEdge } from '../types';

/** `id` is `container` or lies somewhere inside it. */
export function isInside(model: ArchModel, id: Id, container: Id): boolean {
  for (let n: Id | null = id; n !== null; n = model.nodes[n]?.parent ?? null) if (n === container) return true;
  return false;
}

/** Links with exactly one end inside `id` (for a component: its own links). */
export function connectedEdges(model: ArchModel, id: Id): ModelEdge[] {
  return model.edges.filter((e) => isInside(model, e.from.node, id) !== isInside(model, e.to.node, id));
}

/** Containers from the top down to the node's parent: OrderDB → ['Northwind', 'Ordering']. */
export function breadcrumb(model: ArchModel, id: Id): Id[] {
  const path: Id[] = [];
  for (let p = model.nodes[id]?.parent ?? null; p !== null; p = model.nodes[p].parent) path.unshift(p);
  return path;
}

const unique = (ids: Id[]) => [...new Set(ids)];

/** What the selection calls (depends on) and what calls it (used by), in link order. */
export function neighbours(model: ArchModel, id: Id): { dependsOn: Id[]; usedBy: Id[] } {
  const crossing = connectedEdges(model, id);
  return {
    dependsOn: unique(crossing.filter((e) => isInside(model, e.from.node, id)).map((e) => e.to.node)),
    usedBy: unique(crossing.filter((e) => isInside(model, e.to.node, id)).map((e) => e.from.node)),
  };
}

/** Everything drawn bright for a selection: the element, its contents, its links and their other ends. */
export function highlightSet(model: ArchModel, id: Id): { nodes: Set<Id>; edges: Set<string> } {
  const nodes = new Set(Object.keys(model.nodes).filter((n) => isInside(model, n, id)));
  const edges = new Set<string>();
  for (const e of connectedEdges(model, id)) {
    edges.add(e.id);
    nodes.add(e.from.node);
    nodes.add(e.to.node);
  }
  return { nodes, edges };
}

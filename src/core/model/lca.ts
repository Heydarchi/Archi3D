import type { Id, ModelNode } from '../types';

/** Strict ancestors of a node, nearest first. */
export function ancestors(nodes: Record<Id, ModelNode>, id: Id): Id[] {
  const out: Id[] = [];
  for (let p = nodes[id]?.parent ?? null; p !== null; p = nodes[p].parent) out.push(p);
  return out;
}

/**
 * Lowest container holding both ends (null = top level). If one end is a container
 * holding the other, that container is the lca.
 */
export function lowestCommonContainer(nodes: Record<Id, ModelNode>, a: Id, b: Id): Id | null {
  const ua = ancestors(nodes, a);
  const ub = ancestors(nodes, b);
  if (ub.includes(a)) return a;
  if (ua.includes(b)) return b;
  const setB = new Set(ub);
  return ua.find((x) => setB.has(x)) ?? null;
}

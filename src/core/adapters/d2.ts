// A compiled D2 diagram (from @terrastruct/d2, loaded lazily by the app) → ArchModel.
// Shape ids are dotted paths ("Northwind.Ordering.OrderAPI"); the last segment is the name.
import { buildModel } from '../model/build';
import type { ArchModel, AstEdge, AstItem, AstNode, Loc } from '../types';

/** The parts of d2target.Diagram this adapter reads. */
export interface D2Diagram {
  shapes: { id: string; type: string; label?: string }[];
  connections: { src: string; dst: string; srcArrow: string; dstArrow: string; label?: string; strokeDash: number }[];
}

const KIND_BY_TYPE: Record<string, string> = {
  cylinder: 'database', stored_data: 'database', queue: 'queue', person: 'actor', 'c4-person': 'actor',
};

const NOWHERE: Loc = { line: 1, col: 1, endCol: 1 };
const last = (id: string) => id.slice(id.lastIndexOf('.') + 1);
const parentOf = (id: string) => (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null);

export function fromD2Diagram(diagram: D2Diagram): ArchModel {
  const ids = new Set(diagram.shapes.map((s) => s.id));
  const isContainer = (id: string) => diagram.shapes.some((s) => s.id.startsWith(`${id}.`));
  const nodes = new Map<string, AstNode>();
  for (const s of diagram.shapes) {
    const container = isContainer(s.id);
    nodes.set(s.id, {
      type: 'node', kind: container ? 'container' : KIND_BY_TYPE[s.type] ?? 'component', name: last(s.id),
      container, ins: [], outs: [], children: [], loc: NOWHERE,
    });
  }
  const items: AstItem[] = [];
  for (const s of diagram.shapes) {
    const p = parentOf(s.id);
    (p && ids.has(p) ? nodes.get(p)!.children : items).push(nodes.get(s.id)!);
  }
  for (const c of diagram.connections) {
    const backwards = c.srcArrow !== 'none' && c.dstArrow === 'none';
    const [a, b] = backwards ? [c.dst, c.src] : [c.src, c.dst];
    const edge: AstEdge = { type: 'edge', from: { name: last(a), loc: NOWHERE }, to: { name: last(b), loc: NOWHERE }, async: c.strokeDash > 0, loc: NOWHERE };
    items.push(c.label ? { ...edge, label: c.label } : edge);
  }
  return buildModel({ items, diagnostics: [] });
}

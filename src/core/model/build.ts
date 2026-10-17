// AST → ArchModel: resolves names, creates implicit ports, computes depth and lca,
// and reports semantic diagnostics. Invalid links are dropped; everything else is kept.
import { byLocation, diag } from '../dsl/diagnostics';
import type {
  ArchModel, AstEdge, AstItem, AstNode, AstRef, Diagnostic, Id, ModelEdge, ModelNode, ParseResult, Port, PortId,
} from '../types';
import { lowestCommonContainer } from './lca';
import { shapeOf } from './shape';

type Dir = Port['dir'];
const portId = (node: Id, name: string): PortId => `${node}.${name}`;

function collectNodes(items: AstItem[], diagnostics: Diagnostic[]) {
  const nodes: Record<Id, ModelNode> = {};
  const roots: Id[] = [];
  const edges: AstEdge[] = [];

  const declare = (n: AstNode, parent: Id | null, depth: number): Id | null => {
    if (nodes[n.name]) {
      diagnostics.push(diag('E101', `"${n.name}" is defined twice (first on line ${nodes[n.name].loc.line}). Names must be unique.`, n.loc));
      return null;
    }
    const ports: Port[] = [];
    const add = (dir: Dir) => (p: AstNode['ins'][number]) => {
      if (ports.some((x) => x.name === p.name)) return;
      ports.push({ id: portId(n.name, p.name), name: p.name, dir, ...(p.iface ? { iface: p.iface } : {}), ...(p.side ? { side: p.side } : {}), implicit: false });
    };
    n.ins.forEach(add('in'));
    n.outs.forEach(add('out'));
    nodes[n.name] = {
      id: n.name, kind: n.kind, shape: shapeOf(n.kind), container: n.container,
      parent, depth, children: [], ports, loc: n.loc,
    };
    if (parent === null) roots.push(n.name);
    else nodes[parent].children.push(n.name);
    return n.name;
  };

  const walk = (list: AstItem[], parent: Id | null, depth: number): void => {
    for (const it of list) {
      if (it.type === 'edge') { edges.push(it); continue; }
      const id = declare(it, parent, depth);
      // Children of a duplicate are kept at the duplicate's level.
      walk(it.children, id ?? parent, id ? depth + 1 : depth);
    }
  };
  walk(items, null, 0);
  return { nodes, roots, edges };
}

/** Find or create the port an edge end attaches to. Undefined for a port-less container end. */
function resolvePort(node: ModelNode, ref: AstRef, side: Dir, diagnostics: Diagnostic[]): Port | undefined {
  if (ref.port !== undefined) {
    const found = node.ports.find((p) => p.name === ref.port);
    if (found) {
      if (found.dir !== side) {
        const role = side === 'out' ? 'source' : 'target';
        diagnostics.push(diag('W202', `Port "${found.id}" is declared "${found.dir}" but used as a link ${role}.`, ref.loc));
      }
      return found;
    }
    const created: Port = { id: portId(node.id, ref.port), name: ref.port, dir: side, implicit: true };
    node.ports.push(created);
    return created;
  }
  const first = node.ports.find((p) => p.dir === side);
  if (first) return first;
  if (node.container) return undefined;
  const anon: Port = { id: portId(node.id, `_${side}`), name: `_${side}`, dir: side, implicit: true };
  node.ports.push(anon);
  return anon;
}

export function buildModel(parsed: ParseResult): ArchModel {
  const diagnostics: Diagnostic[] = [];
  const { nodes, roots, edges: astEdges } = collectNodes(parsed.items, diagnostics);
  const edges: ModelEdge[] = [];

  for (const e of astEdges) {
    const a = nodes[e.from.name];
    const b = nodes[e.to.name];
    const missing: AstRef[] = [...(a ? [] : [e.from]), ...(b ? [] : [e.to])];
    if (missing.length) {
      for (const r of missing) diagnostics.push(diag('E102', `Unknown name "${r.name}".`, { ...r.loc, endCol: r.loc.col + r.name.length }));
      continue;
    }
    if (a === b) {
      diagnostics.push(diag('E103', `"${a.id}" links to itself.`, e.loc));
      continue;
    }
    const pa = resolvePort(a, e.from, 'out', diagnostics);
    const pb = resolvePort(b, e.to, 'in', diagnostics);
    if (pa?.iface && pb?.iface && pa.iface !== pb.iface) {
      diagnostics.push(diag('W201', `Interface types differ: ${pa.id} is ${pa.iface}, ${pb.id} is ${pb.iface}.`, e.loc));
    }
    edges.push({
      id: `e${edges.length}`,
      from: pa ? { node: a.id, port: pa.id } : { node: a.id },
      to: pb ? { node: b.id, port: pb.id } : { node: b.id },
      async: e.async,
      ...(e.label !== undefined ? { label: e.label } : {}),
      lca: lowestCommonContainer(nodes, a.id, b.id),
    });
  }

  return { nodes, roots, edges, diagnostics: [...parsed.diagnostics, ...diagnostics].sort(byLocation) };
}

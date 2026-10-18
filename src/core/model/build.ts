// AST → ArchModel: resolves names, creates implicit ports, computes depth and lca,
// and reports semantic diagnostics. Invalid links are dropped; everything else is kept.
import { byLocation, diag } from '../dsl/diagnostics';
import type {
  ArchModel, AstEdge, AstItem, AstNode, AstRef, AstStyle, Attrs, ColorPair, Diagnostic, Id, ModelEdge, ModelNode, ParseResult, Port, PortId,
} from '../types';
import { colorPair } from './colors';
import { lowestCommonContainer } from './lca';
import { shapeOf } from './shape';

type Dir = Port['dir'];
const portId = (node: Id, name: string): PortId => `${node}.${name}`;

function collectNodes(items: AstItem[], diagnostics: Diagnostic[]) {
  const nodes: Record<Id, ModelNode> = {};
  const roots: Id[] = [];
  const edges: AstEdge[] = [];
  const styles: AstStyle[] = [];
  const attrsOf = new Map<Id, Attrs>();

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
      id: n.name, kind: n.kind, ...(n.title !== undefined ? { title: n.title } : {}), shape: shapeOf(n.kind), container: n.container,
      parent, depth, children: [], ports, loc: n.loc,
    };
    if (n.kind.toLowerCase() === 'layer' && (parent !== null || !n.container)) {
      const why = parent !== null ? 'is inside a container' : 'has no "{ }"';
      diagnostics.push(diag('W203', `Layer "${n.name}" ${why}, so it is drawn as a normal ${n.container ? 'container' : 'element'}. A layer must be a top-level container.`, n.loc));
    }
    if (n.attrs) attrsOf.set(n.name, n.attrs);
    if (parent === null) roots.push(n.name);
    else nodes[parent].children.push(n.name);
    return n.name;
  };

  const walk = (list: AstItem[], parent: Id | null, depth: number): void => {
    for (const it of list) {
      if (it.type === 'edge') { edges.push(it); continue; }
      if (it.type === 'style') { styles.push(it); continue; }
      const id = declare(it, parent, depth);
      // Children of a duplicate are kept at the duplicate's level.
      walk(it.children, id ?? parent, id ? depth + 1 : depth);
    }
  };
  walk(items, null, 0);
  return { nodes, roots, edges, styles, attrsOf };
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
  const { nodes, roots, edges: astEdges, styles, attrsOf } = collectNodes(parsed.items, diagnostics);

  // Colours: the element's own [color: …], else a "style tag", else a "style kind". Links: own, else "style link".
  const pairOf = (a?: Attrs): ColorPair | undefined => (a?.color ? colorPair(a.color, a.dark) : undefined);
  const styleFor = (target: AstStyle['target'], name: string) =>
    pairOf(styles.filter((s) => s.target === target && s.name.toLowerCase() === name.toLowerCase()).pop()?.attrs);
  for (const n of Object.values(nodes)) {
    const a = attrsOf.get(n.id);
    if (a?.tags?.length) n.tags = a.tags;
    const color = pairOf(a) ?? (a?.tags ?? []).map((t) => styleFor('tag', t)).find(Boolean) ?? styleFor('kind', n.kind);
    if (color) n.color = color;
  }
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
      kind: e.kind,
      async: e.async,
      ...(e.label !== undefined ? { label: e.label } : {}),
      ...((pairOf(e.attrs) ?? styleFor('link', e.kind)) ? { color: pairOf(e.attrs) ?? styleFor('link', e.kind) } : {}),
      lca: lowestCommonContainer(nodes, a.id, b.id),
    });
  }

  return { nodes, roots, edges, diagnostics: [...parsed.diagnostics, ...diagnostics].sort(byLocation) };
}

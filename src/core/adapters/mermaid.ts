// Mermaid `architecture-beta` → ArchModel. A small hand-written reader (no Mermaid package):
//   group id(icon)[Title] [in parent]      → container
//   service id(icon)[Title] [in parent]    → component (kind from the icon)
//   a:R --> L:b   (also --, <--, <-->)     → link; sides become port sides (unnamed ports _out_R, _in_L)
// Anything else (junction, title, …) gives a W301 warning and is skipped.
import { diag } from '../dsl/diagnostics';
import { buildModel } from '../model/build';
import type { ArchModel, AstEdge, AstItem, AstNode, Diagnostic, Loc, PortSide } from '../types';

const ID = '[A-Za-z_][A-Za-z0-9_-]*';
const NODE_RE = new RegExp(`^(group|service)\\s+(${ID})\\s*(?:\\(([^)]*)\\))?\\s*(?:\\[([^\\]]*)\\])?\\s*(?:in\\s+(${ID}))?\\s*$`);
const EDGE_RE = new RegExp(`^(${ID})(?:\\{group\\})?\\s*:\\s*([LRTB])\\s*(<-->|<--|-->|--)\\s*([LRTB])\\s*:\\s*(${ID})(?:\\{group\\})?\\s*$`);

const SIDE: Record<string, PortSide> = { L: 'W', R: 'E', T: 'N', B: 'S' };
const KIND_BY_ICON: Record<string, string> = { database: 'database', disk: 'database', internet: 'external', server: 'service', cloud: 'service' };

export function fromMermaid(src: string): ArchModel {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Map<string, { node: AstNode; parent?: string; parentLoc?: Loc }>();
  const edges: AstEdge[] = [];
  let sawHeader = false;

  src.split(/\r\n|\r|\n/).forEach((raw, i) => {
    const line = i + 1;
    const text = raw.replace(/%%.*$/, '').trim();
    if (!text) return;
    const col = raw.indexOf(text) + 1;
    const loc = (from = col, len = text.length): Loc => ({ line, col: from, endCol: from + len });
    if (!sawHeader && text === 'architecture-beta') { sawHeader = true; return; }
    if (!sawHeader) {
      sawHeader = true;
      diagnostics.push(diag('W301', 'Expected "architecture-beta" on the first line.', loc()));
    }
    const n = NODE_RE.exec(text);
    if (n) {
      const [, what, id, icon = '', , parent] = n;
      const idCol = col + text.indexOf(id, what.length);
      const node: AstNode = {
        type: 'node', kind: what === 'group' ? 'group' : KIND_BY_ICON[icon] ?? 'component', name: id,
        container: what === 'group', ins: [], outs: [], children: [], loc: loc(idCol, id.length),
      };
      nodes.set(id, { node, parent, parentLoc: parent ? loc(col + text.lastIndexOf(parent), parent.length) : undefined });
      return;
    }
    const e = EDGE_RE.exec(text);
    if (e) {
      const [, a, sa, arrow, sb, b] = e;
      // "_" marks the port as unnamed: no label, and not written back when printed as .arch.
      const ref = (name: string, side: string, dir: 'in' | 'out') => ({ name, port: `_${dir}_${side}`, loc: loc(col + text.indexOf(name), name.length) });
      const swap = arrow === '<--';
      const from = swap ? ref(b, sb, 'out') : ref(a, sa, 'out');
      const to = swap ? ref(a, sa, 'in') : ref(b, sb, 'in');
      edges.push({ type: 'edge', from, to, async: false, loc: loc() });
      return;
    }
    diagnostics.push(diag('W301', `Unsupported Mermaid line, skipped: "${text.length > 40 ? `${text.slice(0, 39)}…` : text}"`, loc()));
  });

  // Declare the side ports each node uses, so they carry their side into the model.
  for (const e of edges) {
    for (const [ref, dir] of [[e.from, 'out'], [e.to, 'in']] as const) {
      const n = nodes.get(ref.name)?.node;
      const side = SIDE[ref.port!.slice(-1)];
      const list = dir === 'out' ? n?.outs : n?.ins;
      if (list && !list.some((p) => p.name === ref.port)) list.push({ name: ref.port!, side, loc: ref.loc });
    }
  }

  // Nest by "in parent"; an unknown parent is reported and the node kept at the top level.
  const items: AstItem[] = [];
  for (const { node, parent, parentLoc } of nodes.values()) {
    const p = parent ? nodes.get(parent)?.node : undefined;
    if (parent && !p?.container) diagnostics.push(diag('W301', `"${parent}" is not a group; "${node.name}" is placed at the top level.`, parentLoc!));
    (p?.container ? p.children : items).push(node);
  }
  items.push(...edges);
  return buildModel({ items, diagnostics });
}

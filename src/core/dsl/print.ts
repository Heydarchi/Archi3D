// ArchModel → .arch3d text (used to put an imported model into the editor).
import type { ArchModel, LinkKind, ModelEdge, ModelNode, Port } from '../types';

const ARROW: Record<LinkKind, string> = { call: '->', message: '=>', event: '~>', session: '<=>', stream: '>>', shared: '<>' };
const quote = (s: string) => `"${s.replace(/["\\]/g, (c) => `\\${c}`)}"`;

const portList = (ports: Port[]) => ports.map((p) => (p.iface ? `${p.name}:${p.iface}` : p.name)).join(', ');

function nodeLine(n: ModelNode): string {
  const declared = n.ports.filter((p) => !p.name.startsWith('_'));
  const ins = declared.filter((p) => p.dir === 'in');
  const outs = declared.filter((p) => p.dir === 'out');
  const kind = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(n.kind) ? n.kind : 'component';
  return [kind, n.id, n.title !== undefined ? quote(n.title) : '', ins.length ? `in: ${portList(ins)}` : '', outs.length ? `out: ${portList(outs)}` : '', n.container ? '{' : '']
    .filter(Boolean).join(' ');
}

function edgeLine(e: ModelEdge): string {
  const ref = (end: ModelEdge['from']) => {
    const name = end.port?.slice(end.node.length + 1);
    return name && !name.startsWith('_') ? `${end.node}.${name}` : end.node;
  };
  return `${ref(e.from)} ${ARROW[e.kind]} ${ref(e.to)}${e.label ? ` : ${e.label}` : ''}`;
}

export function printArch(model: ArchModel, header?: string): string {
  const lines: string[] = header ? [`# ${header}`] : [];
  const walk = (id: string, indent: string) => {
    const n = model.nodes[id];
    lines.push(indent + nodeLine(n));
    if (!n.container) return;
    for (const c of n.children) walk(c, `${indent}  `);
    lines.push(`${indent}}`);
  };
  for (const r of model.roots) walk(r, '');
  if (model.edges.length) lines.push('');
  for (const e of model.edges) lines.push(edgeLine(e));
  return `${lines.join('\n')}\n`;
}

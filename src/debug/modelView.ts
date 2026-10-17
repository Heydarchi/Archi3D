// view=model: counts, diagnostics, a table of nodes and a table of links.
import type { ArchModel, ModelNode } from '../core/types';
import { h, withStyles } from './html';

const portList = (n: ModelNode) =>
  h('span', {}, ...n.ports.flatMap((p, i) => [
    i ? ', ' : '',
    h('span', { class: p.dir === 'in' ? 'p' : 'o' }, `${p.dir === 'in' ? '▸' : '◂'}${p.name}${p.iface ? `:${p.iface}` : ''}${p.implicit ? '*' : ''}`),
  ]));

const table = (head: string[], rows: (Node | string)[][]) =>
  h('table', {}, h('thead', {}, h('tr', {}, ...head.map((x) => h('th', {}, x)))),
    h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c))))));

export function renderModelView(root: HTMLElement, model: ArchModel): void {
  withStyles(root);
  const nodes = Object.values(model.nodes);
  const errors = model.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = model.diagnostics.length - errors;
  const count = (n: number, label: string) => h('div', {}, h('b', {}, String(n)), label);

  const pane = h('div', { class: 'pane', style: 'flex:1' },
    h('div', { class: 'counts' },
      count(nodes.filter((n) => !n.container).length, 'components'),
      count(nodes.filter((n) => n.container).length, 'containers'),
      count(nodes.reduce((s, n) => s + n.ports.length, 0), 'ports'),
      count(model.edges.length, 'links'),
      count(errors, 'errors'),
      count(warnings, 'warnings')),
    model.diagnostics.length
      ? h('div', { class: 'diags', style: 'margin-bottom:12px' }, ...model.diagnostics.map((d) =>
        h('div', { class: d.severity === 'error' ? 'msg' : 'msg w', style: 'margin:0' }, `${d.severity === 'error' ? '✖' : '⚠'} ${d.code} line ${d.loc.line}:${d.loc.col} — ${d.message}`)))
      : null,
    h('h2', {}, 'Nodes'),
    table(['id', 'kind', 'shape', 'depth', 'parent', 'ports'], nodes.map((n) => [
      h('span', { class: 'n' }, `${'  '.repeat(n.depth)}${n.id}${n.container ? ' { }' : ''}`),
      h('span', { class: 'k' }, n.kind), n.shape, String(n.depth), n.parent ?? '—', portList(n),
    ])),
    h('h2', { style: 'margin-top:14px' }, 'Links'),
    table(['id', 'from', '', 'to', 'label', 'lca'], model.edges.map((e) => [
      e.id, e.from.port ?? e.from.node, e.async ? '⇒' : '→', e.to.port ?? e.to.node, e.label ?? '', e.lca ?? '(top)',
    ])),
    h('div', { class: 'lab', style: 'margin-top:8px;font-family:system-ui' }, '▸ in port, ◂ out port, * created implicitly'),
  );
  root.append(pane);
}

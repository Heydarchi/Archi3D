// view=parse: source with line numbers on the left, the AST as an indented tree on the right.
import type { AstItem, ParseResult, PortDecl } from '../core/types';
import { h, plural, withStyles } from './html';
import { sourcePane } from './sourcePane';

const ports = (dir: string, list: PortDecl[], cls: string): (Node | string)[] =>
  list.length ? [` ${dir}: `, ...list.flatMap((p, i) => [i ? ', ' : '', h('span', { class: cls }, p.iface ? `${p.name}:${p.iface}` : p.name)])] : [];

function item(it: AstItem): HTMLElement {
  if (it.type === 'edge') {
    const ref = (r: { name: string; port?: string }) => (r.port ? `${r.name}.${r.port}` : r.name);
    return h('li', {},
      h('span', { class: 'n' }, ref(it.from)),
      h('span', { class: 'ar' }, it.async ? ' ⇒ ' : ' → '),
      h('span', { class: 'n' }, ref(it.to)),
      it.label ? h('span', { class: 'lab' }, ` : ${it.label}`) : null,
      h('span', { class: 'lab' }, `  @${it.loc.line}`));
  }
  const li = h('li', {},
    h('span', { class: 'k' }, it.kind + ' '),
    h('span', { class: 'n' }, it.name),
    ...ports('in', it.ins, 'p'),
    ...ports('out', it.outs, 'o'),
    it.container ? ' {' : null,
    h('span', { class: 'lab' }, `  @${it.loc.line}`));
  if (it.children.length) li.append(h('ul', {}, ...it.children.map(item)));
  return li;
}

export function renderParseView(root: HTMLElement, src: string, parsed: ParseResult): void {
  withStyles(root);
  const tree = h('div', { class: 'pane tree' }, h('h2', {}, `AST — ${plural(parsed.items.length, "top-level item")}, ${plural(parsed.diagnostics.length, "diagnostic")}`), h('ul', {}, ...parsed.items.map(item)));
  root.append(sourcePane(src, parsed.diagnostics), tree);
}

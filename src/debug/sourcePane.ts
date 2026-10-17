// Source text with line numbers; diagnostics underlined with their message beside the line.
import type { Diagnostic } from '../core/types';
import { h } from './html';

export function sourcePane(src: string, diagnostics: Diagnostic[]): HTMLElement {
  const pane = h('div', { class: 'pane src' }, h('h2', {}, 'Source'));
  src.split(/\r\n|\r|\n/).forEach((text, i) => {
    const line = i + 1;
    const here = diagnostics.filter((d) => d.loc.line === line);
    const row = h('div', { class: 'row', 'data-line': String(line) }, h('span', { class: 'ln' }, String(line)));
    const d = here[0];
    if (d) {
      const from = d.loc.col - 1;
      const to = Math.max(from + 1, Math.min(d.loc.endCol - 1, text.length || from + 1));
      const body = text.length ? text : ' ';
      const cls = d.severity === 'error' ? 'err' : 'warn';
      row.append(body.slice(0, from), h('span', { class: cls }, body.slice(from, to) || ' '), body.slice(to));
      for (const x of here) {
        row.append(h('span', { class: x.severity === 'error' ? 'msg' : 'msg w' }, `${x.code} ${x.message}`));
      }
    } else {
      row.append(text);
    }
    pane.append(row);
  });
  return pane;
}

// Info panel for the selection: breadcrumb (All › Northwind › Ordering), name, kind, ports,
// depends on, used by. Breadcrumb buttons call back to fly out.
import { breadcrumb, neighbours } from '../core/model/query';
import type { ArchModel, Id } from '../core/types';

const CSS = `
.archi-info { position: absolute; left: 12px; bottom: 12px; max-width: 340px; background: rgba(255,255,255,.94);
  border: 1px solid #d9e2ec; border-radius: 8px; padding: 10px 12px; font: 12px/1.45 system-ui, sans-serif; color: #1f2933;
  box-shadow: 0 2px 10px rgba(31,41,51,.08); }
.archi-info[hidden] { display: none; }
.archi-info .crumbs { display: flex; flex-wrap: wrap; gap: 2px 4px; color: #7b8794; font-size: 11px; margin-bottom: 4px; }
.archi-info .crumbs button { all: unset; cursor: pointer; color: #486581; }
.archi-info .crumbs button:hover { text-decoration: underline; }
.archi-info h3 { margin: 0 0 6px; font-size: 15px; }
.archi-info h3 small { font-weight: 400; color: #7b8794; margin-left: 6px; font-size: 12px; }
.archi-info dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
.archi-info dt { color: #7b8794; }
.archi-info dd { margin: 0; }
.archi-info .in { color: #0f8b8d; } .archi-info .out { color: #c4473a; }
`;

export interface InfoPanel {
  show(model: ArchModel, id: Id | null): void;
  element: HTMLElement;
}

export function createInfoPanel(host: HTMLElement, onCrumb: (id: Id | null) => void): InfoPanel {
  if (!document.getElementById('archi-info-css')) {
    const style = document.createElement('style');
    style.id = 'archi-info-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const el = document.createElement('div');
  el.className = 'archi-info';
  el.hidden = true;
  host.append(el);

  const crumbButton = (label: string, id: Id | null) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => onCrumb(id));
    return b;
  };

  return {
    element: el,
    show(model, id) {
      const n = id ? model.nodes[id] : undefined;
      el.replaceChildren();
      el.hidden = !n;
      if (!n) return;
      const crumbs = document.createElement('div');
      crumbs.className = 'crumbs';
      crumbs.append(crumbButton('All', null));
      for (const c of breadcrumb(model, n.id)) crumbs.append(' › ', crumbButton(c, c));
      const h = document.createElement('h3');
      const kind = document.createElement('small');
      kind.textContent = n.kind;
      h.append(n.id, kind);
      const dl = document.createElement('dl');
      const row = (label: string, value: Node | string) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.append(value);
        dl.append(dt, dd);
      };
      const named = n.ports.filter((p) => !p.implicit || !p.name.startsWith('_'));
      if (named.length) {
        const span = document.createElement('span');
        named.forEach((p, i) => {
          const s = document.createElement('span');
          s.className = p.dir;
          s.textContent = `${p.dir === 'in' ? '▸' : '◂'}${p.name}${p.iface ? `:${p.iface}` : ''}`;
          span.append(i ? ', ' : '', s);
        });
        row('Ports', span);
      }
      if (n.container) row('Holds', `${n.children.length} item${n.children.length === 1 ? '' : 's'}`);
      const { dependsOn, usedBy } = neighbours(model, n.id);
      row('Depends on', dependsOn.join(', ') || '—');
      row('Used by', usedBy.join(', ') || '—');
      el.append(crumbs, h, dl);
    },
  };
}

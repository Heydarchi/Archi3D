// "Colour: kind / layer / container / tag" button and the legend that goes with it.
import { COLOR_BY, type ColorBy } from '../core/model/colorBy';

interface ColorView { setColorBy(by: ColorBy): void; legend(): { name: string; color: string }[] | null }

const CSS = `
.archi-legend { position: absolute; right: 12px; bottom: 12px; z-index: 2; max-width: 240px; max-height: 40%; overflow: auto;
  background: rgba(255,255,255,.94); border: 1px solid #d9e2ec; border-radius: 8px; padding: 8px 10px;
  font: 12px system-ui, sans-serif; color: #1f2933; display: grid; gap: 4px; }
.archi-legend span { display: flex; align-items: center; gap: 6px; }
.archi-legend i { width: 12px; height: 12px; border-radius: 3px; flex: none; }
`;

/** The next mode after `by` (kind → layer → container → tag → kind). */
export const nextColorBy = (by: ColorBy): ColorBy => COLOR_BY[(COLOR_BY.indexOf(by) + 1) % COLOR_BY.length];

/** Shows the legend for the view's current groups in `host` (hidden for the normal look). */
export function renderLegend(host: HTMLElement, view: ColorView): void {
  if (!document.getElementById('archi-legend-css')) {
    const style = document.createElement('style');
    style.id = 'archi-legend-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  let el = host.querySelector<HTMLElement>('.archi-legend');
  const groups = view.legend();
  if (!groups?.length) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'archi-legend'; host.append(el); }
  el.replaceChildren(...groups.map((g) => {
    const row = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.style.background = g.color;
    row.append(swatch, g.name);
    return row;
  }));
}

/** Wires a button that cycles the colour mode and keeps the legend in `host` up to date. */
export function setupColorBy(button: HTMLButtonElement, host: HTMLElement, view: ColorView, start: ColorBy = 'kind'): void {
  let by = start;
  const apply = () => { button.textContent = `Colour: ${by}`; view.setColorBy(by); renderLegend(host, view); };
  button.addEventListener('click', () => { by = nextColorBy(by); apply(); });
  button.textContent = `Colour: ${by}`;
  if (by !== 'kind') apply();
}

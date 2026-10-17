// view=svg2d: the 2D layout as SVG with containers, components (with shape hints), ports and routes.
import type { ArchModel, Layout2D, ModelNode, Pt, Rect } from '../core/types';
import { LINK_SVG } from './linkStyle';
import { fitSvg, s } from './svg';

const DEPTH_FILL = ['#f3f6fa', '#e9eff6', '#dfe8f2', '#d5e1ee'];
const COLORS = { box: '#ffffff', stroke: '#52606d', title: '#334e68', in: '#14a3a3', out: '#d64545', edge: '#486581', label: '#52606d' };

function component(n: ModelNode, b: Rect): SVGGElement {
  const g = s('g', { 'data-id': n.id });
  const common = { fill: COLORS.box, stroke: COLORS.stroke, 'stroke-width': 1.2 };
  if (n.shape === 'db') {
    const ry = Math.min(9, b.h / 6);
    g.append(
      s('path', { ...common, d: `M${b.x},${b.y + ry} v${b.h - 2 * ry} a${b.w / 2},${ry} 0 0 0 ${b.w},0 v${-(b.h - 2 * ry)}` }),
      s('ellipse', { ...common, cx: b.x + b.w / 2, cy: b.y + ry, rx: b.w / 2, ry }),
    );
  } else if (n.shape === 'queue') {
    g.append(s('rect', { ...common, x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h / 2 }));
    for (const f of [0.3, 0.5, 0.7]) g.append(s('line', { x1: b.x + b.w * f, x2: b.x + b.w * f, y1: b.y + 6, y2: b.y + b.h - 6, stroke: '#cbd2d9' }));
  } else {
    g.append(s('rect', { ...common, x: b.x, y: b.y, width: b.w, height: b.h, rx: 4, ...(n.shape === 'ext' ? { 'stroke-dasharray': '5 3', fill: '#f8f4ec' } : {}) }));
  }
  g.append(s('text', { x: b.x + b.w / 2, y: b.y + b.h / 2 + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: '#1f2933' }, n.title ?? n.id));
  return g;
}

function container(n: ModelNode, b: Rect): SVGGElement {
  return s('g', { 'data-id': n.id },
    s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 6, fill: DEPTH_FILL[Math.min(n.depth, 3)], stroke: '#9fb3c8', 'stroke-width': 1.2 }),
    s('text', { x: b.x + 10, y: b.y + 20, 'font-size': 13, 'font-weight': 700, fill: COLORS.title }, n.title ?? n.id),
    s('text', { x: b.x + 10, y: b.y + 34, 'font-size': 10.5, fill: '#829ab1' }, n.kind));
}

/** Middle of the longest segment: where an edge label goes. */
export function labelPoint(r: Pt[]): Pt {
  let best = 0, at = r[0];
  for (let i = 1; i < r.length; i++) {
    const len = Math.abs(r[i].x - r[i - 1].x) + Math.abs(r[i].y - r[i - 1].y);
    if (len > best) { best = len; at = { x: (r[i].x + r[i - 1].x) / 2, y: (r[i].y + r[i - 1].y) / 2 }; }
  }
  return at;
}

export function renderSvg2d(root: HTMLElement, model: ArchModel, layout: Layout2D): void {
  const svg = fitSvg(root, layout.bounds);
  svg.append(s('defs', {}, s('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
    s('path', { d: 'M0,0 L10,5 L0,10 z', fill: COLORS.edge }))));

  const nodes = Object.values(model.nodes).sort((a, b) => a.depth - b.depth);
  for (const n of nodes.filter((x) => x.container)) svg.append(container(n, layout.boxes[n.id]));
  for (const n of nodes.filter((x) => !x.container)) svg.append(component(n, layout.boxes[n.id]));

  for (const e of model.edges) {
    const r = layout.routes[e.id];
    if (!r) continue;
    const st = LINK_SVG[e.kind];
    svg.append(s('polyline', {
      'data-edge': e.id, 'data-kind': e.kind, points: r.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: COLORS.edge, 'stroke-width': st.width,
      ...(st.end ? { 'marker-end': 'url(#arrow)' } : {}), ...(st.start ? { 'marker-start': 'url(#arrow)' } : {}),
      ...(st.dash ? { 'stroke-dasharray': st.dash } : {}), ...(st.opacity ? { 'stroke-opacity': st.opacity } : {}),
    }));
    if (e.label) {
      const at = labelPoint(r);
      svg.append(s('text', { x: at.x, y: at.y - 5, 'text-anchor': 'middle', 'font-size': 10.5, fill: COLORS.label, 'paint-order': 'stroke', stroke: '#fbfcfd', 'stroke-width': 3 }, e.label));
    }
  }
  for (const n of nodes) {
    for (const p of n.ports) {
      const c = layout.ports[p.id];
      svg.append(s('circle', { 'data-port': p.id, cx: c.x, cy: c.y, r: 4.5, fill: p.dir === 'in' ? COLORS.in : COLORS.out, stroke: '#fff', 'stroke-width': 1 }));
    }
  }
}

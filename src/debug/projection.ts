// view=proj: a SceneSpec as two orthographic SVG views, top (x-z) and side (x-y, y up).
import type { SceneSpec, V3 } from '../core/types';
import { h, withStyles } from './html';
import { LINK_SVG } from './linkStyle';
import { s } from './svg';

const PLATE_STROKE = ['#486581', '#627d98', '#829ab1', '#9fb3c8'];
const BLOCK_FILL: Record<string, string> = { box: '#d9e2ec', db: '#c6dbf0', queue: '#f0e2c6', ext: '#e4dcef' };

type Axis = 'y' | 'z';

function panel(scene: SceneSpec, axis: Axis, title: string, width: number, height: number): HTMLElement {
  const { min, max } = scene.bounds;
  const m = 24;
  // Side view: screen y is -y so up is up. Top view: screen y is z.
  const vy = (p: V3) => (axis === 'z' ? p.z : -p.y);
  const y0 = axis === 'z' ? min.z : -max.y, y1 = axis === 'z' ? max.z : -min.y;
  const svg = s('svg', {
    width, height, viewBox: `${min.x - m} ${y0 - m} ${max.x - min.x + 2 * m} ${y1 - y0 + 2 * m}`,
    preserveAspectRatio: 'xMidYMid meet', style: 'display:block;background:#fbfcfd',
  });
  const rect = (c: V3, size: V3, attrs: Record<string, string | number>) => {
    const sy = axis === 'z' ? size.z : size.y;
    return s('rect', { x: c.x - size.x / 2, y: vy(c) - sy / 2, width: size.x, height: sy, ...attrs });
  };
  if (axis === 'y') svg.append(s('line', { x1: min.x - m, x2: max.x + m, y1: 0, y2: 0, stroke: '#bcccdc', 'stroke-dasharray': '4 4' }));
  for (const p of [...scene.plates].sort((a, b) => a.depth - b.depth)) {
    svg.append(rect(p.center, p.size, { fill: axis === 'z' ? 'none' : '#d9e2ec', stroke: PLATE_STROKE[Math.min(p.depth, 3)], 'stroke-width': 1.5, 'data-plate': p.id }));
  }
  for (const b of scene.blocks) {
    svg.append(rect(b.center, b.size, { fill: BLOCK_FILL[b.shape] ?? BLOCK_FILL.box, stroke: '#52606d', 'stroke-width': 1, rx: b.shape === 'db' || b.shape === 'storage' || b.shape === 'cache' ? 6 : 1, 'data-block': b.id }));
  }
  for (const e of scene.edges) {
    svg.append(s('polyline', {
      points: e.points.map((p) => `${p.x},${vy(p)}`).join(' '), fill: 'none', stroke: '#243b53', 'stroke-width': 1.4,
      ...(LINK_SVG[e.kind].dash ? { 'stroke-dasharray': LINK_SVG[e.kind].dash } : {}), 'data-edge': e.id,
    }));
  }
  for (const p of scene.ports) {
    svg.append(s('circle', { cx: p.pos.x, cy: vy(p.pos), r: 3, fill: p.dir === 'in' ? '#14a3a3' : '#d64545' }));
  }
  if (axis === 'z') {
    for (const l of scene.labels.filter((x) => x.role === 'component' || x.role === 'container')) {
      const below = l.role === 'component';
      svg.append(s('text', { x: l.anchor.x, y: l.anchor.z + (below ? 4 : 0), 'font-size': 11, 'font-family': 'system-ui', 'text-anchor': below ? 'middle' : 'start', fill: below ? '#1f2933' : '#334e68', 'font-weight': 600 }, l.text));
    }
  }
  return h('div', { class: 'pane', style: 'padding:6px 16px' }, h('h2', {}, title), svg);
}

export function renderProjection(root: HTMLElement, scene: SceneSpec, caption: string): void {
  withStyles(root);
  root.style.flexDirection = 'column';
  const w = (root.clientWidth || 1280) - 32;
  const H = (root.clientHeight || 800) - 70;
  root.append(
    panel(scene, 'z', `Top (x–z) — ${caption}`, w, Math.round(H * 0.62)),
    panel(scene, 'y', 'Side (x–y)', w, Math.round(H * 0.38)),
  );
}

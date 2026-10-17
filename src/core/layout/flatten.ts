// ELK result → Layout2D with absolute coordinates.
// Gotcha: elkjs 0.9.3 ignores edgeCoords=ROOT; edge points come back relative to the
// edge's lca container, so its absolute offset is added here.
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { ArchModel, Layout2D, Pt, Rect } from '../types';
import { orthogonalize, snapToPorts } from './orthogonal';

const round = (v: number) => Math.round(v * 100) / 100;
const pt = (x: number, y: number): Pt => ({ x: round(x), y: round(y) });

export function flatten(model: ArchModel, laid: ElkNode): Layout2D {
  const boxes: Record<string, Rect> = {};
  const ports: Record<string, Pt> = {};
  const walk = (en: ElkNode, ox: number, oy: number): void => {
    for (const c of en.children ?? []) {
      const x = ox + (c.x ?? 0), y = oy + (c.y ?? 0);
      boxes[c.id] = { x: round(x), y: round(y), w: round(c.width ?? 0), h: round(c.height ?? 0) };
      for (const p of c.ports ?? []) ports[p.id] = pt(x + (p.x ?? 0) + (p.width ?? 0) / 2, y + (p.y ?? 0) + (p.height ?? 0) / 2);
      walk(c, x, y);
    }
  };
  walk(laid, 0, 0);

  const elkEdges = new Map((laid.edges ?? []).map((e) => [e.id, e]));
  const routes: Record<string, Pt[]> = {};
  for (const e of model.edges) {
    const s = elkEdges.get(e.id)?.sections?.[0];
    if (!s) continue;
    const o = e.lca ? boxes[e.lca] : { x: 0, y: 0 };
    const raw = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((p) => pt(p.x + o.x, p.y + o.y));
    routes[e.id] = e.from.port || e.to.port
      ? snapToPorts(raw, e.from.port ? ports[e.from.port] : undefined, e.to.port ? ports[e.to.port] : undefined)
      : orthogonalize(raw);
  }
  return { boxes, ports, routes, bounds: { x: 0, y: 0, w: round(laid.width ?? 0), h: round(laid.height ?? 0) } };
}

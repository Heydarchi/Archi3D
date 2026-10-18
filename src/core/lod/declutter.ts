// Container titles that would cover an element label: move them to their second place (LabelSpec.alt),
// or hide them when both places are covered. Works in screen pixels from a CameraState; pure math.
import type { CameraState, ContainerState, Id, LabelSpec, V3 } from '../types';
import { ellipsize, LABEL_PX } from '../scene/labelText';

interface Rect { x0: number; y0: number; x1: number; y1: number }

/** Average glyph width as a part of the font size (Inter, mixed case). */
const CHAR_WIDTH = 0.58;

/** A point in screen pixels (y down), or null when it is behind the camera. */
export function project(cam: CameraState, p: V3): { x: number; y: number } | null {
  const f = norm(sub(cam.target, cam.position));
  const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const u = cross(r, f);
  const d = sub(p, cam.position);
  const z = dot(d, f);
  if (z <= 1e-6) return null;
  const h = cam.viewportH, aspect = cam.aspect ?? 1;
  const t = Math.tan((cam.fovDeg * Math.PI) / 360);
  const nx = dot(d, r) / (z * t * aspect), ny = dot(d, u) / (z * t);
  return { x: ((nx + 1) / 2) * h * aspect, y: ((1 - ny) / 2) * h };
}

/** Screen box of a label at a point: element labels sit centred above it, titles start at it (middle). */
function box(l: LabelSpec, at: { x: number; y: number }): Rect {
  const px = LABEL_PX[l.role];
  const w = Array.from(ellipsize(l.text)).length * px * CHAR_WIDTH, h = px * 1.3;
  return l.role === 'container'
    ? { x0: at.x, y0: at.y - h / 2, x1: at.x + w, y1: at.y + h / 2 }
    : { x0: at.x - w / 2, y0: at.y - h, x1: at.x + w / 2, y1: at.y };
}

const hits = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function declutterTitles(
  labels: LabelSpec[], visible: Set<string>, containers: Record<Id, ContainerState>, cam: CameraState, depthOf: (id: Id) => number,
): { visible: Set<string>; moved: Record<string, V3> } {
  const taken: Rect[] = [];
  for (const l of labels) {
    if (l.role !== 'component' || !visible.has(l.id)) continue;
    const at = project(cam, l.anchor);
    if (at) taken.push(box(l, at));
  }
  const out = new Set(visible);
  const moved: Record<string, V3> = {};
  // Outer containers first: they name the bigger areas.
  const titles = labels.filter((l) => l.role === 'container' && visible.has(l.id) && containers[l.id] === 'open')
    .sort((a, b) => depthOf(a.id) - depthOf(b.id) || (a.id < b.id ? -1 : 1));
  for (const l of titles) {
    const places = l.alt ? [l.anchor, l.alt] : [l.anchor];
    const free = places.map((p) => ({ p, at: project(cam, p) })).find(({ at }) => !at || !taken.some((t) => hits(t, box(l, at))));
    if (!free) { out.delete(l.id); continue; }
    if (free.p !== l.anchor) moved[l.id] = free.p;
    if (free.at) taken.push(box(l, free.at));
  }
  return { visible: out, moved };
}

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: V3): V3 => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

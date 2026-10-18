import { describe, expect, it } from 'vitest';
import { declutterTitles, project } from '../../src/core/lod/declutter';
import type { CameraState, LabelSpec } from '../../src/core/types';

// Camera on +z looking at the origin: x goes right on screen, y goes up.
const cam: CameraState = { position: { x: 0, y: 0, z: 500 }, target: { x: 0, y: 0, z: 0 }, fovDeg: 40, viewportH: 800, aspect: 1 };

describe('project', () => {
  it('the target is in the middle of the screen; up is up; behind the camera is null', () => {
    expect(project(cam, { x: 0, y: 0, z: 0 })).toEqual({ x: 400, y: 400 });
    expect(project(cam, { x: 0, y: 50, z: 0 })!.y).toBeLessThan(400);
    expect(project(cam, { x: 50, y: 0, z: 0 })!.x).toBeGreaterThan(400);
    expect(project(cam, { x: 0, y: 0, z: 600 })).toBeNull();
  });
});

describe('declutterTitles', () => {
  const title = (anchorY: number, altY: number): LabelSpec =>
    ({ id: 'Box', text: 'Box', role: 'container', anchor: { x: -20, y: anchorY, z: 0 }, alt: { x: -20, y: altY, z: 0 } });
  const element: LabelSpec = { id: 'A', text: 'A long element', role: 'component', anchor: { x: 0, y: 2, z: 0 } };
  const run = (t: LabelSpec, labels: LabelSpec[] = [element, t]) =>
    declutterTitles(labels, new Set(labels.map((l) => l.id)), { Box: 'open' }, cam, () => 0);

  it('keeps a title that covers nothing', () => {
    const r = run(title(-200, 200));
    expect(r.visible.has('Box')).toBe(true);
    expect(r.moved).toEqual({});
  });
  it('moves a title to its second place when the first covers an element label', () => {
    const r = run(title(0, 200));
    expect(r.visible.has('Box')).toBe(true);
    expect(r.moved.Box).toEqual({ x: -20, y: 200, z: 0 });
  });
  it('hides a title when both places are covered', () => {
    const other: LabelSpec = { ...element, id: 'B', anchor: { x: 0, y: 202, z: 0 } };
    const r = run(title(0, 200), [element, other, title(0, 200)]);
    expect(r.visible.has('Box')).toBe(false);
  });
  it('only open containers are moved (a closed one has its title on the lid)', () => {
    const t = title(0, 200);
    const r = declutterTitles([element, t], new Set(['A', 'Box']), { Box: 'closed' }, cam, () => 0);
    expect(r.visible.has('Box')).toBe(true);
    expect(r.moved).toEqual({});
  });
});

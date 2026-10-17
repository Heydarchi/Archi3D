import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs script without types
import { harnessQuery, parseArgs } from '../../scripts/render.mjs';

describe('render command arguments', () => {
  it('defaults: iso 3D picture next to the model, everything open', () => {
    const o = parseArgs(['models/shop.arch']);
    expect(o.out).toMatch(/models\/shop\.png$/);
    expect(o).toMatchObject({ view: 'scene', cam: 'iso', width: 1600, height: 1000, scale: 1, lod: 'off', bundle: false });
    const q = new URLSearchParams(harnessQuery(o));
    expect(Object.fromEntries(q)).toEqual({ test: '1', view: 'scene', fixture: 'shop.arch', cam: 'iso', edges: 'ortho', lod: 'off', panel: 'off' });
  });

  it('options map to harness parameters', () => {
    const o = parseArgs(['a.mmd', '--out', 'x.png', '--focus', 'Billing', '--k', '1.2', '--bundle', '--lod', 'on', '--theme', 'dark', '--select', 'Api', '--width', '800', '--scale', '2']);
    const q = Object.fromEntries(new URLSearchParams(harnessQuery(o)));
    expect(q).toMatchObject({ cam: 'focus', focus: 'Billing', k: '1.2', bundle: 'on', theme: 'dark', select: 'Api', fixture: 'a.mmd' });
    expect(q.lod).toBeUndefined();
    expect([o.width, o.scale]).toEqual([800, 2]);
  });

  it('svg2d ignores camera options; missing model or value is an error', () => {
    expect(Object.fromEntries(new URLSearchParams(harnessQuery(parseArgs(['m.arch', '--view', 'svg2d', '--cam', 'far']))))).toEqual({ test: '1', view: 'svg2d', fixture: 'm.arch' });
    expect(() => parseArgs([])).toThrow(/Usage/);
    expect(() => parseArgs(['m.arch', '--out'])).toThrow(/Missing value/);
  });
});

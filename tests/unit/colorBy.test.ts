import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { colorGroups, GROUP_COLORS } from '../../src/core/model/colorBy';
import { parse } from '../../src/core/dsl/parse';
import { buildModel } from '../../src/core/model/build';
import { layout } from '../../src/core/layout';
import { lift } from '../../src/core/scene/lift';
import { buildSceneObjects, PLATE_TINT } from '../../src/render/build';
import { DARK, LIGHT } from '../../src/render/palette';

const src = [
  'layer Top "Apps" {',
  '  app Phone [tag: ui]',
  '}',
  'layer Bottom {',
  '  system Box [color: #fde7c8] {',
  '    driver Disk [color: #2e7d6b, dark: #4fb3d9, tag: hw]',
  '  }',
  '}',
  'user Person',
  'Phone -> Disk [color: red]',
  'Person -> Phone',
].join('\n');
const model = buildModel(parse(src));

describe('colorGroups', () => {
  it('kind: no groups (the normal look)', () => expect(colorGroups(model, 'kind')).toBeNull());
  it('layer: one colour per layer, elements outside layers keep the normal look', () => {
    const g = colorGroups(model, 'layer')!;
    expect(g.legend.map((x) => x.name)).toEqual(['Apps', 'Bottom']);
    expect(g.colorOf.Phone).toEqual(GROUP_COLORS[0]);
    expect(g.colorOf.Disk).toEqual(GROUP_COLORS[1]);
    expect(g.colorOf.Person).toBeUndefined();
  });
  it('tag: by first tag; untagged keep the normal look', () => {
    const g = colorGroups(model, 'tag')!;
    expect(g.legend.map((x) => x.name)).toEqual(['ui', 'hw']);
    expect(g.colorOf.Box).toBeUndefined();
  });
  it('layer without layers falls back to the top container', () => {
    const flat = buildModel(parse('system A {\n  service X\n}\nsystem B {\n  service Y\n}'));
    expect(colorGroups(flat, 'layer')!.legend.map((x) => x.name)).toEqual(['A', 'B']);
  });
});

describe('colours in the 3D objects', async () => {
  const scene = lift(model, await layout(model));
  const hex = (c: THREE.Color) => `#${c.getHexString()}`;

  it('a block uses its own colour, the dark one in the dark theme', () => {
    expect(hex(buildSceneObjects(scene, LIGHT, model).bodies.find((s) => s.has('Disk'))!.baseColor('Disk')!)).toBe('#2e7d6b');
    expect(hex(buildSceneObjects(scene, DARK, model).bodies.find((s) => s.has('Disk'))!.baseColor('Disk')!)).toBe('#4fb3d9');
  });
  it('a container plate is tinted with its colour', () => {
    const plate = buildSceneObjects(scene, LIGHT, model).plates.baseColor('Box')!;
    const want = new THREE.Color(LIGHT.plates[1]).lerp(new THREE.Color('#fde7c8'), PLATE_TINT);
    expect(hex(plate)).toBe(hex(want));
  });
  it('a link uses its own colour', () => {
    const o = buildSceneObjects(scene, LIGHT, model);
    const e = model.edges.find((x) => x.to.node === 'Disk')!;
    expect(hex(o.edges.baseColor(e.id))).toBe('#d64545');
  });
  it('colour by group wins over own colours, and gives a legend', () => {
    const o = buildSceneObjects(scene, LIGHT, model, 'layer');
    expect(hex(o.bodies.find((s) => s.has('Disk'))!.baseColor('Disk')!)).toBe(GROUP_COLORS[1].light);
    expect(o.legend!.map((x) => x.name)).toEqual(['Apps', 'Bottom']);
    expect(buildSceneObjects(scene, LIGHT, model).legend).toBeNull();
  });
});

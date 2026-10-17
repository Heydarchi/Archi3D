import { beforeAll, describe, expect, it } from 'vitest';
import { ellipsize, LABEL_PX } from '../../src/core/scene/labelText';
import { lift } from '../../src/core/scene/lift';
import type { SceneSpec } from '../../src/core/types';
import { coveredText } from '../../src/render/fontCoverage';
import { laidOut } from './pipeline';

let scene: SceneSpec;
beforeAll(async () => {
  const { model, layout } = await laidOut('northwind');
  scene = lift(model, layout);
});

describe('label anchors', () => {
  it('a component label sits above its block top face', () => {
    for (const b of scene.blocks) {
      const l = scene.labels.find((x) => x.id === b.id)!;
      expect(l.role).toBe('component');
      expect(l.anchor.y, b.id).toBeGreaterThan(b.center.y + b.size.y / 2);
      expect([l.anchor.x, l.anchor.z]).toEqual([b.center.x, b.center.z]);
    }
  });
  it('port labels sit outside their port, on the port side', () => {
    for (const p of scene.ports) {
      const l = scene.labels.find((x) => x.id === p.id);
      if (!l) continue;
      expect(p.dir === 'in' ? l.anchor.x < p.pos.x : l.anchor.x > p.pos.x, p.id).toBe(true);
    }
  });
  it('anonymous ports have no label', () => {
    expect(scene.labels.some((l) => l.text.startsWith('_'))).toBe(false);
  });
});

describe('ellipsis', () => {
  it('a 40-character name renders as 23 characters + …', () => {
    const name = 'A'.repeat(40);
    const out = ellipsize(name);
    expect(Array.from(out)).toHaveLength(24);
    expect(out).toBe(`${'A'.repeat(23)}…`);
  });
  it('24 characters or fewer are unchanged', () => {
    expect(ellipsize('B'.repeat(24))).toBe('B'.repeat(24));
    expect(ellipsize('OrderAPI')).toBe('OrderAPI');
  });
});

describe('font coverage', () => {
  it('keeps latin text and replaces glyphs the bundled font lacks', () => {
    expect(coveredText('Bestellung über €5 …')).toBe('Bestellung über €5 …');
    expect(coveredText('注文 OK')).toBe('?? OK');
  });
  it('label sizes per role', () => {
    expect(LABEL_PX).toEqual({ container: 14, component: 12, port: 10.5, edge: 10.5 });
  });
});

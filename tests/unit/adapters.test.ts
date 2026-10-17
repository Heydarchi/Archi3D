import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromD2Diagram } from '../../src/core/adapters/d2';
import { detectFormat } from '../../src/core/adapters/detect';
import { fromMermaid } from '../../src/core/adapters/mermaid';
import { parse } from '../../src/core/dsl/parse';
import { printArch } from '../../src/core/dsl/print';
import { buildModel } from '../../src/core/model/build';
import type { ArchModel } from '../../src/core/types';
import { fixture, fixturesDir, validFixtures } from './helpers';

const structure = (m: ArchModel) => ({
  nodes: Object.values(m.nodes).map((n) => `${n.id}<${n.parent ?? ''}`).sort(),
  edges: m.edges.map((e) => `${e.from.node}->${e.to.node}`).sort(),
});
const native = () => buildModel(parse(fixture('northwind.arch3d')));

describe('Mermaid architecture-beta', () => {
  const m = fromMermaid(readFileSync(join(fixturesDir, 'adapters', 'northwind.mmd'), 'utf8'));

  it('northwind.mmd has the same nodes, parents and links as northwind.arch3d', () => {
    expect(m.diagnostics).toEqual([]);
    expect(structure(m)).toEqual(structure(native()));
  });

  it('groups become containers; icons pick the kind', () => {
    expect(m.nodes.Ordering.container).toBe(true);
    expect(m.nodes.OrderDB.shape).toBe('db');
    expect(m.nodes.Customer.shape).toBe('ext');
    expect(m.nodes.BFF.shape).toBe('box');
  });

  it('sides become port sides', () => {
    const e = m.edges.find((x) => x.from.node === 'BFF' && x.to.node === 'CatalogAPI')!;
    const port = (id: string) => Object.values(m.nodes).flatMap((n) => n.ports).find((p) => p.id === id)!;
    expect(port(e.from.port!)).toMatchObject({ dir: 'out', side: 'S' });
    expect(port(e.to.port!)).toMatchObject({ dir: 'in', side: 'N' });
    const r = m.edges.find((x) => x.from.node === 'Customer')!;
    expect(port(r.from.port!).side).toBe('E');
    expect(port(r.to.port!).side).toBe('W');
  });

  it('arrows: <-- swaps ends, -- and <--> keep source order', () => {
    const mm = fromMermaid('architecture-beta\nservice a(server)[A]\nservice b(server)[B]\na:R <-- L:b\na:B -- T:b\na:T <--> B:b');
    expect(mm.edges.map((e) => `${e.from.node}->${e.to.node}`)).toEqual(['b->a', 'a->b', 'a->b']);
  });

  it('unsupported lines give a warning, not a crash', () => {
    const u = fromMermaid(readFileSync(join(fixturesDir, 'adapters', 'unsupported.mmd'), 'utf8'));
    expect(u.diagnostics.map((d) => [d.code, d.severity, d.loc.line])).toEqual([
      ['W301', 'warning', 2], ['W301', 'warning', 5], ['W301', 'warning', 8], ['W301', 'warning', 9],
    ]);
    expect(Object.keys(u.nodes).sort()).toEqual(['a', 'b', 'g']);
    expect(u.edges).toHaveLength(1);
  });

  it('missing header is a warning but still reads the body', () => {
    const u = fromMermaid('service a(server)[A]');
    expect(u.diagnostics[0]).toMatchObject({ code: 'W301', loc: { line: 1 } });
    expect(Object.keys(u.nodes)).toEqual(['a']);
  });
});

describe('D2 (compiled diagram → model)', () => {
  it('maps shapes, nesting, shapes and dashed links', async () => {
    const { D2 } = await import('@terrastruct/d2');
    const d2 = new D2();
    const { diagram } = await d2.compile(readFileSync(join(fixturesDir, 'adapters', 'northwind.d2'), 'utf8'));
    const m = fromD2Diagram(diagram);
    expect(m.diagnostics).toEqual([]);
    expect(structure(m)).toEqual(structure(native()));
    expect(m.nodes.OrderDB.shape).toBe('db');
    expect(m.nodes.EventBus.shape).toBe('queue');
    expect(m.nodes.Customer.shape).toBe('ext');
    const e = m.edges.find((x) => x.from.node === 'OrderAPI' && x.to.node === 'EventBus')!;
    expect(e).toMatchObject({ async: true, label: 'OrderPlaced' });
  }, 60_000);
});

describe('printArch', () => {
  for (const f of validFixtures()) {
    it(`${f}: print → parse → model gives the same model`, () => {
      const m = buildModel(parse(fixture(f)));
      const again = buildModel(parse(printArch(m)));
      expect(again.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(structure(again)).toEqual(structure(m));
      expect(again.edges.map((e) => [e.from.port, e.to.port, e.async, e.label ?? null]))
        .toEqual(m.edges.map((e) => [e.from.port, e.to.port, e.async, e.label ?? null]));
      for (const n of Object.values(m.nodes)) expect(again.nodes[n.id].kind).toBe(n.kind);
    });
  }
});

describe('detectFormat', () => {
  it('by extension, then by first line', () => {
    expect(detectFormat('x.mmd', '')).toBe('mermaid');
    expect(detectFormat('x.d2', '')).toBe('d2');
    expect(detectFormat('x.arch3d', 'architecture-beta')).toBe('arch');
    expect(detectFormat('pasted', '%% hi\narchitecture-beta\n')).toBe('mermaid');
    expect(detectFormat('pasted', 'component A')).toBe('arch');
  });
});

describe('file extensions', () => {
  it('.arch3d is the model extension; the older .arch still reads as a model', () => {
    expect(detectFormat('shop.arch3d', '')).toBe('arch');
    expect(detectFormat('shop.arch', '')).toBe('arch');
  });
});

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/dsl/parse';
import { buildModel } from '../../src/core/model/build';
import { expectedErrors, fixture, validFixtures } from './helpers';

const model = (src: string) => buildModel(parse(src));

describe('valid fixtures', () => {
  for (const f of validFixtures()) {
    it(`${f} model snapshot`, () => {
      const m = model(fixture(f));
      expect(m.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(m).toMatchSnapshot();
    });
  }
});

describe('expected.json semantic diagnostics', () => {
  for (const [file, want] of Object.entries(expectedErrors())) {
    const wanted = want.filter((d) => /^(E1|W2)/.test(d.code));
    if (!wanted.length) continue;
    it(`${file} → ${wanted.map((w) => `${w.code}@${w.line}`).join(', ')}`, () => {
      const m = model(fixture(`errors/${file}`));
      const got = m.diagnostics.filter((d) => /^(E1|W2)/.test(d.code)).map((d) => ({ code: d.code, line: d.loc.line }));
      expect(got).toEqual(wanted);
    });
  }

  it('keeps parse diagnostics', () => {
    expect(model(fixture('errors/bad-line.arch3d')).diagnostics.map((d) => d.code)).toEqual(['E001']);
  });
});

describe('nested-deep', () => {
  const m = model(fixture('nested-deep.arch3d'));
  const edge = (a: string, b: string) => m.edges.find((e) => e.from.node === a && e.to.node === b)!;

  it('depths and parents', () => {
    expect(m.nodes.Ledger.depth).toBe(3);
    expect(m.nodes.Platform.depth).toBe(0);
    expect(m.nodes.Merchant.depth).toBe(0);
    expect(m.nodes.Ledger.parent).toBe('Billing');
    expect(m.roots).toEqual(['Platform', 'Merchant']);
    expect(m.nodes.Payments.children).toEqual(['Billing', 'Risk']);
  });

  it('lca', () => {
    expect(edge('Invoicer', 'Scorer').lca).toBe('Payments');
    expect(edge('Merchant', 'Invoicer').lca).toBeNull();
    expect(edge('Invoicer', 'Ledger').lca).toBe('Billing');
    expect(edge('Invoicer', 'Bus').lca).toBe('Platform');
  });

  it('shapes from kind', () => {
    expect(m.nodes.Bus.shape).toBe('queue');
    expect(m.nodes.Merchant.shape).toBe('ext');
    expect(m.nodes.Invoicer.shape).toBe('box');
  });

  it('Invoicer -> Scorer uses the first out port', () => {
    expect(edge('Invoicer', 'Scorer').from.port).toBe('Invoicer.ledger');
  });
});

describe('container-links', () => {
  const m = model(fixture('container-links.arch3d'));
  it('container-to-container link has no ports', () => {
    const e = m.edges.find((x) => x.from.node === 'Frontend')!;
    expect(e).toMatchObject({ to: { node: 'Backend' }, label: 'REST', lca: null });
    expect(e.from.port).toBeUndefined();
    expect(e.to.port).toBeUndefined();
    expect(m.nodes.Frontend.ports).toEqual([]);
  });
  it('App <- Core becomes Core → App', () => {
    const e = m.edges.find((x) => x.label === 'push')!;
    expect([e.from.node, e.to.node]).toEqual(['Core', 'App']);
    expect(e.lca).toBeNull();
  });
});

describe('ports', () => {
  it('implicit ports: A -> B gives A._out and B._in', () => {
    const m = model('component A\ncomponent B\nA -> B');
    expect(m.edges[0].from.port).toBe('A._out');
    expect(m.edges[0].to.port).toBe('B._in');
    expect(m.nodes.A.ports).toEqual([{ id: 'A._out', name: '_out', dir: 'out', implicit: true }]);
    expect(m.nodes.B.ports).toEqual([{ id: 'B._in', name: '_in', dir: 'in', implicit: true }]);
  });

  it('anonymous ports are shared by several links', () => {
    const m = model('component A\ncomponent B\ncomponent C\nA -> B\nA -> C');
    expect(m.nodes.A.ports).toHaveLength(1);
  });

  it('a named but undeclared port is created with the direction of its side', () => {
    const m = model('component A out: x\ncomponent B\nA.y -> B.z');
    expect(m.nodes.A.ports.map((p) => [p.name, p.dir, p.implicit])).toEqual([['x', 'out', false], ['y', 'out', true]]);
    expect(m.nodes.B.ports.map((p) => [p.name, p.dir])).toEqual([['z', 'in']]);
  });

  it('declared ports carry their interface type', () => {
    const m = model(fixture('typed-ports.arch3d'));
    expect(m.nodes.Gateway.ports[0]).toEqual({ id: 'Gateway.orders', name: 'orders', dir: 'out', iface: 'REST', implicit: false });
    const w = m.diagnostics.find((d) => d.code === 'W201')!;
    expect(w.severity).toBe('warning');
    expect(w.message).toMatch(/gRPC.*GraphQL/);
  });
});

describe('invalid links', () => {
  it('are dropped but the rest is kept', () => {
    const m = model('component A\ncomponent B\nA -> Missing\nA -> A\nA -> B');
    expect(m.diagnostics.map((d) => d.code)).toEqual(['E102', 'E103']);
    expect(m.edges.map((e) => [e.id, e.from.node, e.to.node])).toEqual([['e0', 'A', 'B']]);
  });

  it('E102 points at the unknown name', () => {
    const m = model('component A\nA -> Missing');
    expect(m.diagnostics[0].loc).toEqual({ line: 2, col: 6, endCol: 13 });
  });

  it('E101 keeps the first definition', () => {
    const m = model('service A\ndatabase A');
    expect(m.nodes.A.kind).toBe('service');
    expect(m.diagnostics[0]).toMatchObject({ code: 'E101', loc: { line: 2, col: 10 } });
  });
});

describe('determinism', () => {
  it('building twice gives deep-equal output; ids follow source order', () => {
    const p = parse(fixture('northwind.arch3d'));
    const a = buildModel(p);
    expect(buildModel(p)).toEqual(a);
    expect(a.edges.map((e) => e.id)).toEqual(a.edges.map((_, i) => `e${i}`));
    expect(a.edges[0].from.node).toBe('Customer');
  });

  it('does not mutate the parse result', () => {
    const p = parse(fixture('nested-deep.arch3d'));
    const before = JSON.stringify(p);
    buildModel(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});

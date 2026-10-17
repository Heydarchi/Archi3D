import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/dsl/parse';
import type { AstEdge, AstItem, AstNode } from '../../src/core/types';
import { expectedErrors, fixture, validFixtures } from './helpers';

const nodes = (items: AstItem[]): AstNode[] =>
  items.flatMap((i) => (i.type === 'node' ? [i, ...nodes(i.children)] : []));
const edges = (items: AstItem[]): AstEdge[] =>
  items.flatMap((i) => (i.type === 'edge' ? [i] : nodes([i]).flatMap((n) => n.children.filter((c): c is AstEdge => c.type === 'edge'))));

describe('valid fixtures', () => {
  for (const f of validFixtures()) {
    it(`${f} parses with no errors`, () => {
      const r = parse(fixture(f));
      expect(r.diagnostics).toEqual([]);
      expect(r.items).toMatchSnapshot();
    });
  }
});

describe('error fixtures', () => {
  const parseCodes = /^E00/;
  for (const [file, want] of Object.entries(expectedErrors())) {
    const wanted = want.filter((d) => parseCodes.test(d.code));
    if (!wanted.length) continue;
    it(`${file} → ${wanted.map((w) => `${w.code}@${w.line}`).join(', ')}`, () => {
      const r = parse(fixture(`errors/${file}`));
      expect(r.diagnostics.map((d) => ({ code: d.code, line: d.loc.line }))).toEqual(wanted);
    });
  }

  it('continues after an error (bad-line: B and the link survive)', () => {
    const r = parse(fixture('errors/bad-line.arch3d'));
    expect(nodes(r.items).map((n) => n.name)).toEqual(['A', 'B']);
    expect(edges(r.items)).toHaveLength(1);
    expect(r.diagnostics[0].loc.col).toBe(1);
  });

  it('E003 is reported on the line that opened the container', () => {
    const r = parse('system S {\n  container T {\n  }\n  component A\n');
    expect(r.diagnostics).toMatchObject([{ code: 'E003', loc: { line: 1, col: 8 } }]);
    expect(nodes(r.items).map((n) => n.name)).toEqual(['S', 'T', 'A']);
  });

  it('E002 points at the stray brace', () => {
    const r = parse('component A\n  }\n');
    expect(r.diagnostics).toMatchObject([{ code: 'E002', severity: 'error', loc: { line: 2, col: 3, endCol: 4 } }]);
  });

  it('E001 for trailing junk after an edge', () => {
    expect(parse('A -> B oops').diagnostics[0]).toMatchObject({ code: 'E001', loc: { col: 8 } });
  });
});

describe('locations and labels', () => {
  it('A -> B : label', () => {
    const [e] = parse('A -> B : my label ').items as AstEdge[];
    expect(e.from.loc.col).toBe(1);
    expect(e.to.loc.col).toBe(6);
    expect(e.to.loc.endCol).toBe(7);
    expect(e.label).toBe('my label');
    expect(e.loc).toEqual({ line: 1, col: 1, endCol: 18 });
  });

  it('refs with ports', () => {
    const [e] = parse('  OrderAPI.db -> OrderDB.db').items as AstEdge[];
    expect(e.from).toMatchObject({ name: 'OrderAPI', port: 'db', loc: { col: 3, endCol: 14 } });
    expect(e.to).toMatchObject({ name: 'OrderDB', port: 'db' });
    expect(e.label).toBeUndefined();
  });

  it('names with dashes do not swallow arrows', () => {
    const [e] = parse('order-api->db-main').items as AstEdge[];
    expect([e.from.name, e.to.name]).toEqual(['order-api', 'db-main']);
  });
});

describe('ports', () => {
  it('in: http:REST, q → two ports, first typed', () => {
    const [n] = parse('service S in: http:REST, q out: x').items as AstNode[];
    expect(n.ins.map((p) => [p.name, p.iface])).toEqual([['http', 'REST'], ['q', undefined]]);
    expect(n.outs.map((p) => p.name)).toEqual(['x']);
    expect(n.ins[0].loc.col).toBe(15);
  });

  it('out before in, no spaces after commas', () => {
    const [n] = parse('component C out: a,b in: c').items as AstNode[];
    expect(n.outs.map((p) => p.name)).toEqual(['a', 'b']);
    expect(n.ins.map((p) => p.name)).toEqual(['c']);
  });

  it('empty port list is an error', () => {
    expect(parse('component C in:').diagnostics[0].code).toBe('E001');
  });
});

describe('arrows', () => {
  const one = (src: string) => parse(src).items[0] as AstEdge;
  it('->  sync', () => expect(one('A -> B')).toMatchObject({ async: false, from: { name: 'A' }, to: { name: 'B' } }));
  it('--> sync', () => expect(one('A --> B')).toMatchObject({ async: false, from: { name: 'A' }, to: { name: 'B' } }));
  it('=>  async', () => expect(one('A => B')).toMatchObject({ async: true, from: { name: 'A' }, to: { name: 'B' } }));
  it('<-  swaps ends', () => {
    const e = one('A.x <- B.y : push');
    expect(e).toMatchObject({ async: false, from: { name: 'B', port: 'y' }, to: { name: 'A', port: 'x' }, label: 'push' });
    expect(e.from.loc.col).toBe(8);
  });
});

describe('lexical details', () => {
  it('comments, blank lines, tabs, CRLF', () => {
    const src = '# header\r\n\r\ncomponent\tA   // trailing\r\n\tcomponent B # x\r\nA -> B : a#b\r\n// done';
    const r = parse(src);
    expect(r.diagnostics).toEqual([]);
    expect(nodes(r.items).map((n) => [n.name, n.loc.line])).toEqual([['A', 3], ['B', 4]]);
    expect(nodes(r.items)[1].loc.col).toBe(12);
    const [e] = edges(r.items);
    expect(e.loc.line).toBe(5);
    expect(e.label).toBe('a');
  });

  it('nesting puts children (and edges) inside containers', () => {
    const r = parse('system S {\n  component A\n  component B\n  A -> B\n}\ncomponent C');
    const [s, c] = r.items as AstNode[];
    expect(s.container).toBe(true);
    expect(s.children.map((x) => x.type)).toEqual(['node', 'node', 'edge']);
    expect(c.container).toBe(false);
  });

  it('several closing braces on one line', () => {
    const r = parse('a X {\nb Y {\ncomponent Z\n} }\ncomponent W');
    expect(r.diagnostics).toEqual([]);
    expect(r.items.map((i) => (i as AstNode).name)).toEqual(['X', 'W']);
  });

  it('does not mutate or depend on previous calls', () => {
    expect(parse('component A')).toEqual(parse('component A'));
  });

  it('10,000 lines parse in under 200 ms', () => {
    const lines: string[] = [];
    for (let i = 0; i < 2000; i++) {
      lines.push(`system S${i} {`, `  service A${i} in: a:REST, b out: c`, `  database D${i} in: q`, `  A${i}.c -> D${i}.q : read`, '}');
    }
    const src = lines.join('\n');
    parse(src);
    const t0 = performance.now();
    const r = parse(src);
    const ms = performance.now() - t0;
    expect(r.diagnostics).toEqual([]);
    expect(ms).toBeLessThan(200);
  });
});

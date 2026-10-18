import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/dsl/parse';
import { stripComment } from '../../src/core/dsl/tokenize';
import { colorPair, isColor } from '../../src/core/model/colors';
import { buildModel } from '../../src/core/model/build';
import type { AstEdge, AstNode, AstStyle } from '../../src/core/types';

describe('colour values', () => {
  it('hex is used as written in both themes; names have a tuned dark one', () => {
    expect(colorPair('#2E7D6B')).toEqual({ light: '#2e7d6b', dark: '#2e7d6b' });
    expect(colorPair('#abc')).toEqual({ light: '#aabbcc', dark: '#aabbcc' });
    expect(colorPair('teal')).toEqual({ light: '#14a3a3', dark: '#2bc0c0' });
    expect(colorPair('#123456', '#abcdef')).toEqual({ light: '#123456', dark: '#abcdef' });
    expect(colorPair('nope')).toBeUndefined();
    expect([isColor('#12345'), isColor('#1234567'), isColor('Teal')]).toEqual([false, false, true]);
  });
});

describe('comments and brackets', () => {
  it('# inside [ ] is a colour, outside it starts a comment', () => {
    expect(stripComment('driver V [color: #2e7d6b] # driver')).toBe('driver V [color: #2e7d6b] ');
    expect(stripComment('service A # [color: #fff]')).toBe('service A ');
  });
});

describe('attributes', () => {
  it('on an element: after the title, before the ports', () => {
    const r = parse('driver V4L2 "V4L2 driver" [color: #2e7d6b, dark: #4fb3d9, tag: vendor, tag: camera] in: ioctl');
    expect(r.diagnostics).toEqual([]);
    const n = r.items[0] as AstNode;
    expect(n.attrs).toMatchObject({ color: '#2e7d6b', dark: '#4fb3d9', tags: ['vendor', 'camera'] });
    expect(n.ins.map((p) => p.name)).toEqual(['ioctl']);
  });
  it('on a container, and on a link before its label (also with several targets)', () => {
    const r = parse('system HAL [color: amber] {\n}\nA -> B, C [color: red] : alloc');
    expect(r.diagnostics).toEqual([]);
    expect((r.items[0] as AstNode).attrs?.color).toBe('amber');
    expect((r.items.slice(1) as AstEdge[]).map((e) => [e.to.name, e.attrs?.color, e.label])).toEqual([['B', 'red', 'alloc'], ['C', 'red', 'alloc']]);
  });
  it('an unknown attribute or a bad colour is a warning, the line still counts', () => {
    const r = parse('service A [colour: red]\nservice B [color: #12]\nservice C [color: blurple]');
    expect(r.diagnostics.map((d) => [d.code, d.loc.line])).toEqual([['W204', 1], ['W204', 2], ['W204', 3]]);
    expect(r.items).toHaveLength(3);
  });
  it('an unclosed bracket is an error', () => {
    expect(parse('service A [color: red').diagnostics[0].code).toBe('E001');
  });
});

describe('style lines', () => {
  it('kind, tag and link', () => {
    const r = parse('style kind driver [color: #5d6873]\nstyle tag vendor [color: orange]\nstyle link event [color: purple]');
    expect(r.diagnostics).toEqual([]);
    expect((r.items as AstStyle[]).map((s) => [s.target, s.name, s.attrs.color])).toEqual([
      ['kind', 'driver', '#5d6873'], ['tag', 'vendor', 'orange'], ['link', 'event', 'purple']]);
  });
  it('a link style needs a link kind; a node of kind "style" still works', () => {
    expect(parse('style link fast [color: red]').diagnostics[0].code).toBe('E001');
    expect((parse('style Guide').items[0] as AstNode).kind).toBe('style');
  });
});

describe('colours in the model', () => {
  const m = buildModel(parse([
    'style kind driver [color: slate]',
    'style tag vendor [color: #e8871e]',
    'style link event [color: purple]',
    'driver A',
    'driver B [tag: vendor]',
    'driver C [color: #123456, tag: vendor]',
    'service D',
    'A ~> D',
    'A -> D [color: red]',
    'D -> A',
  ].join('\n')));
  it('own colour, then tag style, then kind style; nothing for the rest', () => {
    expect(m.diagnostics).toEqual([]);
    expect(m.nodes.A.color).toEqual({ light: '#5d6873', dark: '#8796a3' });
    expect(m.nodes.B.color).toEqual({ light: '#e8871e', dark: '#e8871e' });
    expect(m.nodes.C.color).toEqual({ light: '#123456', dark: '#123456' });
    expect(m.nodes.B.tags).toEqual(['vendor']);
    expect(m.nodes.D.color).toBeUndefined();
  });
  it('links: own colour, then link style', () => {
    expect(m.edges.map((e) => e.color?.light)).toEqual(['#8e5bc9', '#d64545', undefined]);
  });
});

describe('printing colours', () => {
  it('print → parse gives the same colours and tags (styles are folded in)', async () => {
    const { printArch } = await import('../../src/core/dsl/print');
    const src = 'style kind driver [color: slate]\ndriver A [tag: vendor]\nservice B [color: #123456, dark: #abcdef]\nA -> B [color: red] : x\n';
    const m = buildModel(parse(src));
    const again = buildModel(parse(printArch(m)));
    expect(again.diagnostics).toEqual([]);
    expect([again.nodes.A.color, again.nodes.A.tags, again.nodes.B.color]).toEqual([m.nodes.A.color, m.nodes.A.tags, m.nodes.B.color]);
    expect(again.edges[0]).toMatchObject({ color: m.edges[0].color, label: 'x' });
  });
});

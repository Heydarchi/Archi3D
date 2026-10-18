import { StringStream } from '@codemirror/language';
import { describe, expect, it } from 'vitest';
import { archLanguage } from '../../src/app/archLanguage';

type Parser = { startState(indent: number): unknown; token(s: StringStream, st: unknown): string | null };
const parser = (archLanguage as unknown as { streamParser: Parser }).streamParser;

function tokens(line: string): [string, string | null][] {
  const st = parser.startState(2);
  const s = new StringStream(line, 2, 2);
  const out: [string, string | null][] = [];
  while (!s.eol()) {
    s.start = s.pos;
    const style = parser.token(s, st);
    const text = line.slice(s.start, s.pos);
    if (text.trim()) out.push([text, style]);
  }
  return out;
}

describe('arch stream language', () => {
  it('node line: kind, name, port keywords and ports', () => {
    expect(tokens('service Gateway in: a:REST, b out: c {')).toEqual([
      ['service', 'typeName'], ['Gateway', 'variableName.definition'], ['in:', 'keyword'], ['a', 'propertyName'],
      [':', 'punctuation'], ['REST', 'propertyName'], [',', 'punctuation'], ['b', 'propertyName'], ['out:', 'keyword'],
      ['c', 'propertyName'], ['{', 'brace'],
    ]);
  });
  it('edge line: names, ports, arrow, label, comment', () => {
    expect(tokens('BFF.orders -> OrderAPI.orders : REST # hi')).toEqual([
      ['BFF', 'variableName'], ['.', 'punctuation'], ['orders', 'propertyName'], ['->', 'operator'],
      ['OrderAPI', 'variableName'], ['.', 'punctuation'], ['orders', 'propertyName'], [':', 'punctuation'],
      ['REST ', 'string'], ['# hi', 'comment'],
    ]);
  });
  it('dashed names do not swallow arrows', () => {
    expect(tokens('order-api->db')).toEqual([['order-api', 'variableName'], ['->', 'operator'], ['db', 'variableName']]);
  });
  it('every arrow is an operator', () => {
    for (const a of ['->', '-->', '<-', '=>', '~>', '<=>', '>>', '<>']) expect(tokens(`A ${a} B`)[1], a).toEqual([a, 'operator']);
  });
  it('link words, several targets', () => {
    expect(tokens('System.boot event Mail, Sync : BOOT')).toEqual([
      ['System', 'variableName'], ['.', 'punctuation'], ['boot', 'propertyName'], ['event', 'operator'], ['Mail', 'variableName'],
      [',', 'punctuation'], ['Sync', 'variableName'], [':', 'punctuation'], ['BOOT', 'string'],
    ]);
  });
  it('a node may be called like a link word', () => {
    expect(tokens('service event in: x').slice(0, 2)).toEqual([['service', 'typeName'], ['event', 'variableName.definition']]);
  });
  it('a title is a string, # inside it is not a comment', () => {
    expect(tokens('driver Cam "Camera #1 \\"x\\"" in: a # c')).toEqual([
      ['driver', 'typeName'], ['Cam', 'variableName.definition'], ['"Camera #1 \\"x\\""', 'string'], ['in:', 'keyword'],
      ['a', 'propertyName'], ['# c', 'comment'],
    ]);
  });
});

describe('arch stream language: colours', () => {
  it('attributes: # is a colour inside brackets, a comment after them', () => {
    expect(tokens('driver V [color: #2e7d6b, tag: hw] # c')).toEqual([
      ['driver', 'typeName'], ['V', 'variableName.definition'], ['[', 'bracket'], ['color', 'attributeName'], [':', 'punctuation'],
      ['#2e7d6b', 'atom'], [',', 'punctuation'], ['tag', 'attributeName'], [':', 'punctuation'], ['hw', 'attributeValue'],
      [']', 'bracket'], ['# c', 'comment'],
    ]);
  });
  it('style lines', () => {
    expect(tokens('style kind driver [color: slate]').slice(0, 3)).toEqual([['style', 'keyword'], ['kind', 'keyword'], ['driver', 'typeName']]);
  });
});

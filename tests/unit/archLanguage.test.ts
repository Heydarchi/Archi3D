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
});

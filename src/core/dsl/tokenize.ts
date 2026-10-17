// Splits one line of .arch3d text into tokens with 1-based columns. Comments are stripped.

export type TokenType = 'ident' | 'arrow' | 'colon' | 'comma' | 'dot' | 'lbrace' | 'rbrace' | 'other';
export interface Token { type: TokenType; text: string; col: number; endCol: number }
export interface LineTokens { line: number; text: string; tokens: Token[] }

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_-]/;
const ARROWS = ['-->', '->', '=>', '<-'];
const SINGLE: Record<string, TokenType> = { ':': 'colon', ',': 'comma', '.': 'dot', '{': 'lbrace', '}': 'rbrace' };

/** The line without its comment (`#` or `//` to end of line). */
export function stripComment(line: string): string {
  const hash = line.indexOf('#');
  const slashes = line.indexOf('//');
  const cut = [hash, slashes].filter((i) => i >= 0);
  return cut.length ? line.slice(0, Math.min(...cut)) : line;
}

export function tokenizeLine(raw: string, line: number): LineTokens {
  const text = stripComment(raw).replace(/\s+$/, '');
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    const arrow = ARROWS.find((a) => text.startsWith(a, i));
    if (arrow) {
      tokens.push({ type: 'arrow', text: arrow, col: i + 1, endCol: i + 1 + arrow.length });
      i += arrow.length;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      // A dash is part of a name unless it starts an arrow ("a->b", "a-->b").
      while (j < text.length && IDENT_PART.test(text[j]) && !(text[j] === '-' && (text[j + 1] === '>' || text.startsWith('->', j + 1)))) j++;
      tokens.push({ type: 'ident', text: text.slice(i, j), col: i + 1, endCol: j + 1 });
      i = j;
      continue;
    }
    tokens.push({ type: SINGLE[ch] ?? 'other', text: ch, col: i + 1, endCol: i + 2 });
    i++;
  }
  return { line, text, tokens };
}

export function tokenize(src: string): LineTokens[] {
  return src.split(/\r\n|\r|\n/).map((l, i) => tokenizeLine(l, i + 1));
}

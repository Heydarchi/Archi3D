// Splits one line of .arch3d text into tokens with 1-based columns. Comments are stripped.

export type TokenType = 'ident' | 'arrow' | 'string' | 'colon' | 'comma' | 'dot' | 'lbrace' | 'rbrace' | 'other';
/** For a string token, `text` is the value without quotes and escapes. `unclosed` is set when the line ends first. */
export interface Token { type: TokenType; text: string; col: number; endCol: number; unclosed?: boolean }
export interface LineTokens { line: number; text: string; tokens: Token[] }

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_-]/;
/** Longest first, so "<=>" is not read as "<" and "=>". */
export const ARROWS = ['<=>', '-->', '->', '=>', '~>', '>>', '<>', '<-'];
const SINGLE: Record<string, TokenType> = { ':': 'colon', ',': 'comma', '.': 'dot', '{': 'lbrace', '}': 'rbrace' };

/** End of the string that starts with the quote at `i`: the index after it, and whether the quote was closed. */
function scanString(line: string, i: number): { end: number; closed: boolean } {
  let j = i + 1;
  while (j < line.length && line[j] !== '"') j += line[j] === '\\' ? 2 : 1;
  return j < line.length ? { end: j + 1, closed: true } : { end: line.length, closed: false };
}

/** The line without its comment (`#` or `//` to end of line). Quoted text is not a comment. */
export function stripComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') i = scanString(line, i).end - 1;
    else if (line[i] === '#' || line.startsWith('//', i)) return line.slice(0, i);
  }
  return line;
}

function readString(text: string, i: number): Token {
  const { end, closed } = scanString(text, i);
  const value = text.slice(i + 1, closed ? end - 1 : end).replace(/\\(["\\])/g, '$1');
  return { type: 'string', text: value, col: i + 1, endCol: end + 1, ...(closed ? {} : { unclosed: true }) };
}

export function tokenizeLine(raw: string, line: number): LineTokens {
  const text = stripComment(raw).replace(/\s+$/, '');
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '"') {
      const t = readString(text, i);
      tokens.push(t);
      i = t.endCol - 1;
      continue;
    }
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

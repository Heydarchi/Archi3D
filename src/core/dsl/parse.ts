// .arch3d text → AST. One statement per line; recovers at the next line after an error.
import { isColor } from '../model/colors';
import type { AstEdge, AstItem, AstNode, AstRef, AstStyle, Attrs, Diagnostic, LinkKind, Loc, ParseResult, PortDecl } from '../types';
import { byLocation, diag } from './diagnostics';
import { tokenize, type LineTokens, type Token } from './tokenize';

class LineError extends Error {
  constructor(message: string, readonly at: Token | undefined) { super(message); }
}

/** Arrow or word → link kind. "<-" is a call read right to left. */
const ARROW_KIND: Record<string, LinkKind> = {
  '->': 'call', '-->': 'call', '<-': 'call', '=>': 'message', '~>': 'event', '<=>': 'session', '>>': 'stream', '<>': 'shared',
};
export const LINK_WORDS: readonly LinkKind[] = ['call', 'message', 'event', 'session', 'stream', 'shared'];
const isLinkWord = (t: Token | undefined): boolean => t?.type === 'ident' && (LINK_WORDS as readonly string[]).includes(t.text);
/** Kinds that don't wait for an answer. */
const ASYNC: ReadonlySet<LinkKind> = new Set(['message', 'event', 'stream']);

const locOf = (line: number, from: Token, to: Token = from): Loc => ({ line, col: from.col, endCol: to.endCol });

/** A cursor over one line's tokens. */
class Cursor {
  i = 0;
  /** Warnings found on this line (the line still counts). */
  readonly warnings: Diagnostic[] = [];
  constructor(readonly lt: LineTokens) {}
  get tokens(): Token[] { return this.lt.tokens; }
  peek(o = 0): Token | undefined { return this.tokens[this.i + o]; }
  done(): boolean { return this.i >= this.tokens.length; }
  next(): Token { return this.tokens[this.i++]; }
  expect(type: Token['type'], what: string): Token {
    const t = this.peek();
    if (!t || t.type !== type) throw new LineError(t ? `Expected ${what}, found "${t.text}".` : `Expected ${what} at end of line.`, t);
    return this.next();
  }
}

function parseRef(c: Cursor): AstRef {
  const name = c.expect('ident', 'a name');
  if (c.peek()?.type === 'dot') {
    c.next();
    const port = c.expect('ident', 'a port name after "."');
    return { name: name.text, port: port.text, loc: locOf(c.lt.line, name, port) };
  }
  return { name: name.text, loc: locOf(c.lt.line, name) };
}

const ATTR_KEYS = ['color', 'dark', 'tag'];

/** `[color: #2e7d6b, dark: #4fb3d9, tag: vendor]`. An unknown name or a bad colour is a W204 warning. */
function parseAttrs(c: Cursor): Attrs {
  const open = c.next();
  const attrs: Attrs = { loc: locOf(c.lt.line, open) };
  const warn = (t: Token, message: string) => c.warnings.push(diag('W204', message, locOf(c.lt.line, t)));
  if (c.peek()?.type === 'rbracket') { attrs.loc = locOf(c.lt.line, open, c.next()); return attrs; }
  for (;;) {
    const key = c.expect('ident', 'an attribute (color, dark or tag)');
    c.expect('colon', `":" after "${key.text}"`);
    const v = c.peek();
    if (!v || !['ident', 'hex', 'string'].includes(v.type)) throw new LineError(v ? `Expected a value, found "${v.text}".` : 'Expected a value at end of line.', v);
    c.next();
    if (!ATTR_KEYS.includes(key.text)) warn(key, `Unknown attribute "${key.text}". Known: color, dark, tag.`);
    else if (key.text === 'tag') {
      if (v.type === 'hex') warn(v, `A tag is a name, not "${v.text}".`);
      else attrs.tags = [...(attrs.tags ?? []), v.text];
    } else if (!isColor(v.text)) warn(v, `"${v.text}" is not a colour. Use #rrggbb, #rgb or a name like teal.`);
    else attrs[key.text as 'color' | 'dark'] = v.text;
    if (c.peek()?.type === 'comma') { c.next(); continue; }
    const close = c.expect('rbracket', '"," or "]"');
    attrs.loc = locOf(c.lt.line, open, close);
    return attrs;
  }
}

/** `style kind driver [color: #5d6873]`, `style tag vendor [...]`, `style link event [...]`. */
function parseStyle(c: Cursor): AstStyle {
  c.next();
  const target = c.next();
  const name = c.next();
  if (target.text === 'link' && !(LINK_WORDS as readonly string[]).includes(name.text)) {
    throw new LineError(`"${name.text}" is not a link kind. Use one of: ${LINK_WORDS.join(', ')}.`, name);
  }
  const attrs = parseAttrs(c);
  if (!c.done()) throw new LineError('Nothing may follow "]" in a style line.', c.peek());
  return { type: 'style', target: target.text as AstStyle['target'], name: name.text, attrs, loc: locOf(c.lt.line, name) };
}

function parseEdges(c: Cursor): AstEdge[] {
  const first = c.peek()!;
  const a = parseRef(c);
  const link = c.peek();
  if (!link) throw new LineError('Expected an arrow at end of line.', undefined);
  if (link.type !== 'arrow' && !isLinkWord(link)) {
    throw new LineError(`Expected an arrow (->, =>, ~>, <=>, >>, <>) or a link word, found "${link.text}".`, link);
  }
  c.next();
  const targets = [parseRef(c)];
  while (c.peek()?.type === 'comma') {
    if (link.text === '<-') throw new LineError('"<-" takes one target. Write one line for each.', c.peek());
    c.next();
    targets.push(parseRef(c));
  }
  const attrs = c.peek()?.type === 'lbracket' ? parseAttrs(c) : undefined;
  let label: string | undefined;
  if (!c.done()) {
    const colon = c.expect('colon', '":" before a label');
    label = c.lt.text.slice(colon.endCol - 1).trim() || undefined;
    c.i = c.tokens.length;
  }
  const loc: Loc = { line: c.lt.line, col: first.col, endCol: c.lt.text.length + 1 };
  const kind = link.type === 'arrow' ? ARROW_KIND[link.text] : (link.text as LinkKind);
  const swap = link.text === '<-';
  return targets.map((b) => {
    const edge: AstEdge = { type: 'edge', from: swap ? b : a, to: swap ? a : b, kind, async: ASYNC.has(kind), loc, ...(attrs ? { attrs } : {}) };
    return label === undefined ? edge : { ...edge, label };
  });
}

function parsePortList(c: Cursor): PortDecl[] {
  const ports: PortDecl[] = [];
  do {
    if (ports.length) c.next(); // the comma
    const name = c.expect('ident', 'a port name');
    if (c.peek()?.type === 'colon' && c.peek(1)?.type === 'ident' && c.peek(2)?.type !== 'colon') {
      c.next();
      const iface = c.next();
      ports.push({ name: name.text, iface: iface.text, loc: locOf(c.lt.line, name, iface) });
    } else {
      ports.push({ name: name.text, loc: locOf(c.lt.line, name) });
    }
  } while (c.peek()?.type === 'comma');
  return ports;
}

function parseNode(c: Cursor): AstNode {
  const kind = c.next();
  const name = c.next();
  let title: string | undefined;
  if (c.peek()?.type === 'string') {
    const t = c.next();
    if (t.unclosed) throw new LineError('The title has no closing quote (").', t);
    title = t.text || undefined;
  }
  const attrs = c.peek()?.type === 'lbracket' ? parseAttrs(c) : undefined;
  const ins: PortDecl[] = [];
  const outs: PortDecl[] = [];
  let container = false;
  while (!c.done()) {
    const t = c.peek()!;
    if (t.type === 'lbrace') {
      c.next();
      if (!c.done()) throw new LineError('Nothing may follow "{" on the same line.', c.peek());
      container = true;
      break;
    }
    if (t.type === 'ident' && (t.text === 'in' || t.text === 'out') && c.peek(1)?.type === 'colon') {
      c.next(); c.next();
      (t.text === 'in' ? ins : outs).push(...parsePortList(c));
      continue;
    }
    throw new LineError(`Expected "in:", "out:" or "{", found "${t.text}".`, t);
  }
  const node: AstNode = { type: 'node', kind: kind.text, name: name.text, container, ins, outs, children: [], loc: locOf(c.lt.line, name), ...(attrs ? { attrs } : {}) };
  return title === undefined ? node : { ...node, title };
}

interface Frame { node: AstNode | null; items: AstItem[] }

export function parse(src: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const stack: Frame[] = [{ node: null, items: [] }];
  const top = () => stack[stack.length - 1];

  for (const lt of tokenize(src)) {
    const { tokens, line } = lt;
    if (!tokens.length) continue;
    try {
      if (tokens.every((t) => t.type === 'rbrace')) {
        for (const t of tokens) {
          if (stack.length === 1) diagnostics.push(diag('E002', '"}" has no open container to close.', locOf(line, t)));
          else stack.pop();
        }
        continue;
      }
      const c = new Cursor(lt);
      const [t0, t1, t2, t3] = tokens;
      // "A event B" is a link, "service event in: x" is a node called "event".
      const wordLink = isLinkWord(t1) && t2?.type === 'ident' && !((t2.text === 'in' || t2.text === 'out') && t3?.type === 'colon');
      const styleLine = t0.text === 'style' && t1?.type === 'ident' && ['kind', 'tag', 'link'].includes(t1.text) && t2?.type === 'ident' && t3?.type === 'lbracket';
      if (styleLine) {
        top().items.push(parseStyle(c));
      } else if (t0.type === 'ident' && (t1?.type === 'arrow' || t1?.type === 'dot' || wordLink)) {
        top().items.push(...parseEdges(c));
      } else if (t0.type === 'ident' && t1?.type === 'ident') {
        const node = parseNode(c);
        top().items.push(node);
        if (node.container) stack.push({ node, items: node.children });
      } else {
        throw new LineError('Expected "kind Name", "A -> B" or "}".', t0);
      }
      diagnostics.push(...c.warnings);
    } catch (err) {
      if (!(err instanceof LineError)) throw err;
      const at = err.at ?? tokens[tokens.length - 1];
      const col = err.at ? at.col : at.endCol;
      diagnostics.push(diag('E001', `Can't read this line: ${err.message}`, { line, col, endCol: Math.max(lt.text.length + 1, col + 1) }));
    }
  }

  for (const f of stack.slice(1)) {
    diagnostics.push(diag('E003', `"${f.node!.name}" is missing a closing "}".`, f.node!.loc));
  }
  return { items: stack[0].items, diagnostics: diagnostics.sort(byLocation) };
}

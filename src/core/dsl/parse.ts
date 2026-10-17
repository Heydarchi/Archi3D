// .arch text → AST. One statement per line; recovers at the next line after an error.
import type { AstEdge, AstItem, AstNode, AstRef, Diagnostic, Loc, ParseResult, PortDecl } from '../types';
import { byLocation, diag } from './diagnostics';
import { tokenize, type LineTokens, type Token } from './tokenize';

class LineError extends Error {
  constructor(message: string, readonly at: Token | undefined) { super(message); }
}

const locOf = (line: number, from: Token, to: Token = from): Loc => ({ line, col: from.col, endCol: to.endCol });

/** A cursor over one line's tokens. */
class Cursor {
  i = 0;
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

function parseEdge(c: Cursor): AstEdge {
  const first = c.peek()!;
  const a = parseRef(c);
  const arrow = c.expect('arrow', 'an arrow (->, -->, => or <-)');
  const b = parseRef(c);
  let label: string | undefined;
  if (!c.done()) {
    const colon = c.expect('colon', '":" before a label');
    label = c.lt.text.slice(colon.endCol - 1).trim() || undefined;
    c.i = c.tokens.length;
  }
  const loc: Loc = { line: c.lt.line, col: first.col, endCol: c.lt.text.length + 1 };
  const swap = arrow.text === '<-';
  const edge: AstEdge = { type: 'edge', from: swap ? b : a, to: swap ? a : b, async: arrow.text === '=>', loc };
  return label === undefined ? edge : { ...edge, label };
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
  return { type: 'node', kind: kind.text, name: name.text, container, ins, outs, children: [], loc: locOf(c.lt.line, name) };
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
      const [t0, t1] = tokens;
      if (t0.type === 'ident' && (t1?.type === 'arrow' || t1?.type === 'dot')) {
        top().items.push(parseEdge(c));
      } else if (t0.type === 'ident' && t1?.type === 'ident') {
        const node = parseNode(c);
        top().items.push(node);
        if (node.container) stack.push({ node, items: node.children });
      } else {
        throw new LineError('Expected "kind Name", "A -> B" or "}".', t0);
      }
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

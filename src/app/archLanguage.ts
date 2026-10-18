// CodeMirror stream-language mode for .arch3d: kinds, names, titles, ports, arrows and link words, labels, comments.
import { StreamLanguage, type StringStream } from '@codemirror/language';

interface State { pos: 'start' | 'kind' | 'node' | 'ports' | 'source' | 'edge' | 'label' | 'style'; brackets: boolean }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*(?:-(?!->|>)[A-Za-z0-9_]+)*/;
const ARROW = /^(<=>|-->|->|=>|~>|>>|<>|<-)/;
const LINK_WORD = /^(call|message|event|session|stream|shared)$/;
/** After the first name of a line: this line is a link ("A -> B", "A.p event B", but not "service event in: x"). */
const LINK_AHEAD = /^\s*(\.|<=>|-->|->|=>|~>|>>|<>|<-)|^\s+(call|message|event|session|stream|shared)\s+(?!(?:in|out)\s*:)[A-Za-z_]/;

export const archLanguage = StreamLanguage.define<State>({
  name: 'arch',
  startState: () => ({ pos: 'start', brackets: false }),
  token(stream: StringStream, state: State): string | null {
    if (stream.sol()) { state.pos = 'start'; state.brackets = false; }
    if (stream.eatSpace()) return null;
    // [color: #2e7d6b, dark: teal, tag: vendor]: # is a colour in here, not a comment.
    if (stream.eat('[')) { state.brackets = true; return 'bracket'; }
    if (state.brackets) {
      if (stream.eat(']')) { state.brackets = false; return 'bracket'; }
      if (stream.match(/^#[0-9a-zA-Z]+/)) return 'atom';
      if (stream.match(/^(color|dark|tag)(?=\s*:)/)) return 'attributeName';
      if (stream.match(/^[A-Za-z_][A-Za-z0-9_-]*/)) return 'attributeValue';
      stream.next();
      return 'punctuation';
    }
    if (state.pos === 'start' && stream.match(/^style(?=\s+(kind|tag|link)\s)/)) { state.pos = 'style'; return 'keyword'; }
    if (state.pos === 'style') {
      if (stream.match(/^(kind|tag|link)\b/)) return 'keyword';
      if (stream.match(IDENT)) return 'typeName';
    }
    if (state.pos !== 'label' && stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
    if (stream.match('#') || stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (state.pos === 'label') {
      // The label runs to the end of the line or a comment.
      if (!stream.match(/^[^#/]+/) && !stream.match(/^\/(?!\/)/)) stream.next();
      return 'string';
    }
    if (stream.match(ARROW)) { state.pos = 'edge'; return 'operator'; }
    if (stream.match(/^[{}]/)) return 'brace';
    if (stream.match(/^(in|out):/)) { state.pos = 'ports'; return 'keyword'; }
    if (stream.eat(':')) {
      if (state.pos === 'edge' || state.pos === 'source') { state.pos = 'label'; return 'punctuation'; }
      return 'punctuation';
    }
    if (stream.eat(',') || stream.eat('.')) return 'punctuation';
    if (stream.match(IDENT)) {
      const prevDot = stream.string.charAt(stream.start - 1) === '.';
      if (prevDot) return 'propertyName';
      if (state.pos === 'ports') return 'propertyName';
      if (state.pos === 'source' && LINK_WORD.test(stream.current())) { state.pos = 'edge'; return 'operator'; }
      if (state.pos === 'start') {
        // "kind Name" vs "From -> To": peek at what follows.
        if (LINK_AHEAD.test(stream.string.slice(stream.pos))) { state.pos = 'source'; return 'variableName'; }
        state.pos = 'kind';
        return 'typeName';
      }
      if (state.pos === 'kind') { state.pos = 'node'; return 'variableName.definition'; }
      return 'variableName';
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '#' } },
});

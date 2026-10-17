// CodeMirror stream-language mode for .arch: kinds, names, ports, arrows, labels, comments.
import { StreamLanguage, type StringStream } from '@codemirror/language';

interface State { pos: 'start' | 'kind' | 'node' | 'ports' | 'edge' | 'label' }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*(?:-(?!->|>)[A-Za-z0-9_]+)*/;

export const archLanguage = StreamLanguage.define<State>({
  name: 'arch',
  startState: () => ({ pos: 'start' }),
  token(stream: StringStream, state: State): string | null {
    if (stream.sol()) state.pos = 'start';
    if (stream.eatSpace()) return null;
    if (stream.match('#') || stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (state.pos === 'label') {
      // The label runs to the end of the line or a comment.
      if (!stream.match(/^[^#/]+/) && !stream.match(/^\/(?!\/)/)) stream.next();
      return 'string';
    }
    if (stream.match(/^(-->|->|=>|<-)/)) { state.pos = 'edge'; return 'operator'; }
    if (stream.match(/^[{}]/)) return 'brace';
    if (stream.match(/^(in|out):/)) { state.pos = 'ports'; return 'keyword'; }
    if (stream.eat(':')) {
      if (state.pos === 'edge') { state.pos = 'label'; return 'punctuation'; }
      return 'punctuation';
    }
    if (stream.eat(',') || stream.eat('.')) return 'punctuation';
    if (stream.match(IDENT)) {
      const prevDot = stream.string.charAt(stream.start - 1) === '.';
      if (prevDot) return 'propertyName';
      if (state.pos === 'ports') return 'propertyName';
      if (state.pos === 'start') {
        // "kind Name" vs "From -> To": peek at what follows.
        const rest = stream.string.slice(stream.pos);
        if (/^\s*(\.|-->|->|=>|<-)/.test(rest)) { state.pos = 'edge'; return 'variableName'; }
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

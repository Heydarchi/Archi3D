// The .arch editor: CodeMirror 6 with the stream-language mode and lint markers for diagnostics.
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import type { Diagnostic } from '../core/types';
import { archLanguage } from './archLanguage';
import { toEditorDiagnostics } from './lintMapping';

const highlight = HighlightStyle.define([
  { tag: t.comment, color: '#7b8794', fontStyle: 'italic' },
  { tag: t.typeName, color: '#7b5cb8' },
  { tag: t.definition(t.variableName), color: '#1f2933', fontWeight: '600' },
  { tag: t.variableName, color: '#1f2933' },
  { tag: t.propertyName, color: '#0f8b8d' },
  { tag: t.keyword, color: '#486581' },
  { tag: t.operator, color: '#c4473a', fontWeight: '600' },
  { tag: t.string, color: '#8a6a1f' },
  { tag: t.brace, color: '#52606d' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: '#fff' },
  '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', lineHeight: '1.5' },
  '.cm-gutters': { backgroundColor: '#f7f9fb', borderRight: '1px solid #e4e7eb', color: '#9aa5b1' },
  '.cm-activeLine': { backgroundColor: '#f3f6fa' },
});

export interface Editor {
  view: EditorView;
  text(): string;
  setText(text: string): void;
  showDiagnostics(diagnostics: Diagnostic[]): void;
}

export function createEditor(parent: HTMLElement, initial: string, onChange: (text: string) => void): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(), highlightActiveLine(), history(), lintGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        archLanguage, syntaxHighlighting(highlight), theme, EditorView.lineWrapping,
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(u.state.doc.toString()); }),
      ],
    }),
  });
  return {
    view,
    text: () => view.state.doc.toString(),
    setText(text) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }); },
    showDiagnostics(diagnostics) {
      view.dispatch(setDiagnostics(view.state, toEditorDiagnostics(view.state.doc, diagnostics)));
    },
  };
}

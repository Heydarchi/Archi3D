// Model diagnostics (1-based line/col) → CodeMirror lint diagnostics (document offsets).
import type { Diagnostic as CmDiagnostic } from '@codemirror/lint';
import type { Text } from '@codemirror/state';
import type { Diagnostic } from '../core/types';

export function toEditorDiagnostics(doc: Text, diagnostics: Diagnostic[]): CmDiagnostic[] {
  return diagnostics.map((d) => {
    const line = doc.line(Math.min(Math.max(1, d.loc.line), doc.lines));
    const from = Math.min(line.from + Math.max(0, d.loc.col - 1), line.to);
    let to = Math.min(line.from + Math.max(0, d.loc.endCol - 1), line.to);
    if (to <= from) to = Math.min(from + 1, doc.length);
    return { from, to: Math.max(to, from), severity: d.severity, message: `${d.code}: ${d.message}`, source: d.code };
  });
}

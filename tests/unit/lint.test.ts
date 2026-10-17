import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { toEditorDiagnostics } from '../../src/app/lintMapping';
import { parse } from '../../src/core/dsl/parse';
import { buildModel } from '../../src/core/model/build';

describe('lint mapping', () => {
  it('E102 at line 2 becomes a CodeMirror diagnostic on line 2', () => {
    const src = 'component A\nA -> Missing';
    const doc = Text.of(src.split('\n'));
    const [d] = toEditorDiagnostics(doc, buildModel(parse(src)).diagnostics);
    expect(doc.lineAt(d.from).number).toBe(2);
    expect(doc.sliceString(d.from, d.to)).toBe('Missing');
    expect(d).toMatchObject({ severity: 'error', source: 'E102' });
    expect(d.message).toContain('Missing');
  });

  it('warnings stay warnings; positions are clamped to the document', () => {
    const doc = Text.of(['abc']);
    const out = toEditorDiagnostics(doc, [
      { code: 'W201', severity: 'warning', message: 'w', loc: { line: 1, col: 2, endCol: 99 } },
      { code: 'E003', severity: 'error', message: 'e', loc: { line: 9, col: 1, endCol: 1 } },
    ]);
    expect(out[0]).toMatchObject({ from: 1, to: 3, severity: 'warning' });
    expect(out[1].from).toBeLessThanOrEqual(doc.length);
    expect(out[1].to).toBeGreaterThanOrEqual(out[1].from);
  });

  it('an empty span still marks one character', () => {
    const doc = Text.of(['component A', '}']);
    const [d] = toEditorDiagnostics(doc, [{ code: 'E002', severity: 'error', message: 'x', loc: { line: 2, col: 1, endCol: 1 } }]);
    expect(d.to - d.from).toBe(1);
  });
});

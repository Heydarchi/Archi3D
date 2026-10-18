// Stable diagnostic codes (docs/GRAMMAR.md). Tests assert on these.
import type { Diagnostic, Loc } from '../types';

export const CODES = {
  E001: 'error', E002: 'error', E003: 'error',
  E101: 'error', E102: 'error', E103: 'error',
  W201: 'warning', W202: 'warning', W203: 'warning',
  W301: 'warning',
} as const;
export type Code = keyof typeof CODES;

export const diag = (code: Code, message: string, loc: Loc): Diagnostic =>
  ({ code, severity: CODES[code], message, loc });

export const byLocation = (a: Diagnostic, b: Diagnostic): number =>
  a.loc.line - b.loc.line || a.loc.col - b.loc.col;

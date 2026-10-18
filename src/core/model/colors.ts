// Colours from the file: "#123456" (or "#abc") is used exactly as written in both themes; a name is a
// shortcut for a pair tuned for the light and the dark theme. `dark:` overrides the dark one.
import type { ColorPair } from '../types';

export const NAMED_COLORS: Record<string, ColorPair> = {
  red: { light: '#d64545', dark: '#ef6b6b' },
  orange: { light: '#e8871e', dark: '#f0a04b' },
  amber: { light: '#d9a520', dark: '#f2c75c' },
  green: { light: '#3f9c5a', dark: '#5cc27a' },
  teal: { light: '#14a3a3', dark: '#2bc0c0' },
  blue: { light: '#3a7bd5', dark: '#6aa2ef' },
  indigo: { light: '#5a5fd6', dark: '#8b8ff0' },
  purple: { light: '#8e5bc9', dark: '#b48aeb' },
  pink: { light: '#d6558f', dark: '#ef86b4' },
  brown: { light: '#9a6b45', dark: '#c0916a' },
  slate: { light: '#5d6873', dark: '#8796a3' },
  gray: { light: '#8a939b', dark: '#a7b0b8' },
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Is this a colour the file may use (a hex value or one of the names)? */
export const isColor = (value: string): boolean => HEX.test(value) || value.toLowerCase() in NAMED_COLORS;

/** "#abc" → "#aabbcc", lower case. */
export function normalHex(hex: string): string {
  const h = hex.slice(1).toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`;
}

/** Light and dark colour for `color` (and `dark`, when given). Undefined for something that is not a colour. */
export function colorPair(color: string, dark?: string): ColorPair | undefined {
  const one = (v: string): ColorPair | undefined => {
    if (HEX.test(v)) { const h = normalHex(v); return { light: h, dark: h }; }
    return NAMED_COLORS[v.toLowerCase()];
  };
  const base = one(color);
  if (!base) return undefined;
  const d = dark !== undefined ? one(dark) : undefined;
  return d ? { light: base.light, dark: d.dark === d.light ? d.light : d.dark } : base;
}

// The bundled Inter subset covers the @fontsource "latin" range. troika fetches fallback fonts
// from a CDN for anything else, which the no-network rule forbids, so other glyphs become "?".
const LATIN_RANGES: [number, number][] = [
  [0x0000, 0x00ff], [0x0131, 0x0131], [0x0152, 0x0153], [0x02bb, 0x02bc], [0x02c6, 0x02c6], [0x02da, 0x02da],
  [0x02dc, 0x02dc], [0x0304, 0x0304], [0x0308, 0x0308], [0x0329, 0x0329], [0x2000, 0x206f], [0x20ac, 0x20ac],
  [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215], [0xfeff, 0xfeff], [0xfffd, 0xfffd],
];

const covered = (cp: number) => LATIN_RANGES.some(([a, b]) => cp >= a && cp <= b);

export const coveredText = (text: string): string =>
  Array.from(text).map((ch) => (covered(ch.codePointAt(0)!) ? ch : '?')).join('');

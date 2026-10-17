// Label text rules shared by the renderers.

export const MAX_LABEL_CHARS = 24;

/** Names longer than 24 characters become 23 characters + "…". */
export function ellipsize(text: string, max = MAX_LABEL_CHARS): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

/** Pixel size per label role (screen-ish; the renderer scales by distance). */
export const LABEL_PX = { container: 14, component: 12, port: 10.5, edge: 10.5 } as const;

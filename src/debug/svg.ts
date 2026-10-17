// SVG element helper and fit-to-viewport transform for the SVG debug views.
const NS = 'http://www.w3.org/2000/svg';

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: (Node | string | null)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const k of kids) if (k != null) el.append(k);
  return el;
}

export interface Box { x: number; y: number; w: number; h: number }

/** A full-size <svg> whose viewBox frames `box` with a margin. */
export function fitSvg(root: HTMLElement, box: Box, margin = 20): SVGSVGElement {
  const svg = s('svg', {
    width: root.clientWidth || 1280, height: root.clientHeight || 800,
    viewBox: `${box.x - margin} ${box.y - margin} ${box.w + 2 * margin} ${box.h + 2 * margin}`,
    preserveAspectRatio: 'xMidYMid meet',
    style: 'display:block;background:#fbfcfd;font-family:system-ui,sans-serif',
  });
  root.append(svg);
  return svg;
}

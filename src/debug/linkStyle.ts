// SVG stroke for each link kind in the debug views (the 3D look is in render/edges.ts).
import type { LinkKind } from '../core/types';

export const LINK_SVG: Record<LinkKind, { width: number; dash?: string; start?: boolean; end: boolean; opacity?: number }> = {
  call: { width: 1.5, end: true },
  message: { width: 1.5, dash: '6 4', end: true },
  event: { width: 1.5, dash: '1.5 3', end: true },
  session: { width: 1.5, start: true, end: true },
  stream: { width: 3, end: true },
  shared: { width: 5, end: false, opacity: 0.5 },
};

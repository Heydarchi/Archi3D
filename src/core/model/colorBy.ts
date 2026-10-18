// "Colour by": colour elements by group instead of by kind, without writing anything in the file.
//   kind       the normal look: shape colours, plus your own [color: …] and style lines
//   layer      by the layer (floor) they stand on; without layers, by top container
//   container  by their top-level container
//   tag        by their first tag; untagged elements keep the normal look
import type { ArchModel, ColorPair, Id } from '../types';

export type ColorBy = 'kind' | 'layer' | 'container' | 'tag';
export const COLOR_BY: ColorBy[] = ['kind', 'layer', 'container', 'tag'];

/** Ten group colours, each tuned for the light and the dark theme. */
export const GROUP_COLORS: ColorPair[] = [
  { light: '#5b8fd9', dark: '#6f9fe6' }, { light: '#e0884a', dark: '#eb9a5f' }, { light: '#4fa86a', dark: '#62bd7d' },
  { light: '#c75d7e', dark: '#dc7593' }, { light: '#8a6cc9', dark: '#a184de' }, { light: '#2fa3a3', dark: '#3fbaba' },
  { light: '#c7a43a', dark: '#dbba4f' }, { light: '#8a7158', dark: '#a8896c' }, { light: '#6b7f94', dark: '#8597ab' },
  { light: '#b0574a', dark: '#c96c5e' },
];

export interface ColorGroups {
  /** Colour per element and container in a group. */
  colorOf: Record<Id, ColorPair>;
  /** One entry per group, in the order they first appear. */
  legend: { name: string; color: ColorPair }[];
}

const topOf = (model: ArchModel, id: Id): Id => {
  let r = id;
  while (model.nodes[r].parent !== null) r = model.nodes[r].parent!;
  return r;
};

/** Groups for a mode, or null for 'kind' (the normal look). */
export function colorGroups(model: ArchModel, by: ColorBy): ColorGroups | null {
  if (by === 'kind') return null;
  const hasLayers = model.roots.some((r) => model.nodes[r].container && model.nodes[r].kind.toLowerCase() === 'layer');
  const keyOf = (id: Id): string | undefined => {
    const n = model.nodes[id];
    if (by === 'tag') return n.tags?.[0];
    const top = topOf(model, id);
    if (by === 'layer' && hasLayers) return model.nodes[top].kind.toLowerCase() === 'layer' ? top : undefined;
    return model.nodes[top].container ? top : undefined;
  };
  const names = new Map<string, string>();
  const colorOf: Record<Id, ColorPair> = {};
  const order: string[] = [];
  for (const id of Object.keys(model.nodes)) {
    const key = keyOf(id);
    if (key === undefined) continue;
    if (!names.has(key)) {
      names.set(key, by === 'tag' ? key : model.nodes[key]?.title ?? key);
      order.push(key);
    }
    colorOf[id] = GROUP_COLORS[order.indexOf(key) % GROUP_COLORS.length];
  }
  return { colorOf, legend: order.map((k, i) => ({ name: names.get(k)!, color: GROUP_COLORS[i % GROUP_COLORS.length] })) };
}

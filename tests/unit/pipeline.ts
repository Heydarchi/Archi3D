// Test helper: fixture → model → layout (cached per fixture).
import { parse } from '../../src/core/dsl/parse';
import { layout } from '../../src/core/layout';
import { buildModel } from '../../src/core/model/build';
import type { ArchModel, Layout2D } from '../../src/core/types';
import { fixture } from './helpers';

const cache = new Map<string, Promise<{ model: ArchModel; layout: Layout2D }>>();

export function laidOut(name: string): Promise<{ model: ArchModel; layout: Layout2D }> {
  let p = cache.get(name);
  if (!p) {
    const model = buildModel(parse(fixture(`${name}.arch`)));
    p = layout(model).then((l) => ({ model, layout: l }));
    cache.set(name, p);
  }
  return p;
}

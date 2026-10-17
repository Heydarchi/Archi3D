// Text → model → layout (worker) → scene, for the harness and the app.
import { parse } from '../core/dsl/parse';
import { buildModel } from '../core/model/build';
import { lift } from '../core/scene/lift';
import type { ArchModel, Layout2D, SceneOptions, SceneSpec } from '../core/types';
import { createLayoutClient } from './layoutClient';
import { modelFromText } from './importFile';

export interface Built { model: ArchModel; layout: Layout2D; scene: SceneSpec }

/** `name` picks the reader (.arch3d, .mmd, .d2 — see core/adapters/detect.ts). */
export async function buildFromSource(src: string, opts: Partial<SceneOptions> = {}, name = 'model.arch3d'): Promise<Built> {
  const model = (await modelFromText(name, src)).model ?? buildModel(parse(src));
  const client = createLayoutClient();
  try {
    const layout = await client.layout(model);
    return { model, layout, scene: lift(model, layout, opts) };
  } finally {
    client.dispose();
  }
}

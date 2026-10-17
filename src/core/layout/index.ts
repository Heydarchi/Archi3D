// layout(model) → Layout2D, using the bundled elkjs (runs in Node, a worker and the browser).
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ArchModel, Layout2D, LayoutOptions } from '../types';
import { flatten } from './flatten';
import { toElk } from './toElk';

let elk: InstanceType<typeof ELK> | null = null;

/** `previous`: the last layout of this document, used as position hints for stability. */
export async function layout(model: ArchModel, opts: Partial<LayoutOptions> = {}, previous?: Layout2D): Promise<Layout2D> {
  elk ??= new ELK();
  const laid = await elk.layout(toElk(model, opts, previous));
  return flatten(model, laid);
}

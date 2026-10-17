// Runs layout() off the main thread. Message in: { id, model, opts }; out: { id, layout } or { id, error }.
import './elkWorkerShim';
import { layout } from '../core/layout';
import type { ArchModel, Layout2D, LayoutOptions } from '../core/types';

export interface LayoutRequest { id: number; model: ArchModel; opts?: Partial<LayoutOptions>; previous?: Layout2D }
export type LayoutResponse = { id: number; layout: Layout2D } | { id: number; error: string };

self.onmessage = async (ev: MessageEvent<LayoutRequest>) => {
  const { id, model, opts, previous } = ev.data;
  try {
    const result = await layout(model, opts, previous);
    (self as unknown as Worker).postMessage({ id, layout: result } satisfies LayoutResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) } satisfies LayoutResponse);
  }
};

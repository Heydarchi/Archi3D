// Posts a model to the layout worker and resolves with its Layout2D.
import type { ArchModel, Layout2D, LayoutOptions } from '../core/types';
import type { LayoutRequest, LayoutResponse } from './worker';
import { createLayoutWorker } from './workerFactory';

export interface LayoutClient {
  layout(model: ArchModel, opts?: Partial<LayoutOptions>, previous?: Layout2D): Promise<Layout2D>;
  dispose(): void;
}

export function createLayoutClient(): LayoutClient {
  const pending = new Map<number, { resolve: (l: Layout2D) => void; reject: (e: Error) => void }>();
  let nextId = 0;
  let disposed = false;
  const onmessage = (ev: MessageEvent<LayoutResponse>) => {
    const p = pending.get(ev.data.id);
    if (!p) return;
    pending.delete(ev.data.id);
    if ('error' in ev.data) p.reject(new Error(ev.data.error));
    else p.resolve(ev.data.layout);
  };
  // The factory may be async (the standalone export probes a CDN first).
  const worker = Promise.resolve(createLayoutWorker()).then((w) => {
    if (disposed) w.terminate();
    w.onmessage = onmessage;
    return w;
  });
  return {
    layout(model, opts, previous) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        void worker.then((w) => w.postMessage({ id, model, opts, previous } satisfies LayoutRequest), reject);
      });
    },
    dispose() {
      disposed = true;
      void worker.then((w) => w.terminate());
      for (const p of pending.values()) p.reject(new Error('layout client disposed'));
      pending.clear();
    },
  };
}

// The layout worker for the normal build: a module worker chunk emitted by Vite.
// The standalone export swaps this module for workerFactory.standalone.ts (see scripts/export-standalone.mjs).
export function createLayoutWorker(): Worker | Promise<Worker> {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

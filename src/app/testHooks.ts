// window.__archi: the surface screenshot tests talk to (see docs/ARCHITECTURE.md).
// `ready` turns true only after the frame (and label text) is fully drawn.

export interface ArchiHooks {
  ready: boolean;
  test: boolean;
  error?: string;
  setCamera?: (pose: unknown) => Promise<void> | void;
  select?: (id: string | null) => void;
  flyTo?: (id: string | null) => Promise<void>;
  screenPos?: (id: string) => { x: number; y: number } | null;
  state?: () => unknown;
  setSource?: (text: string) => void;
}

declare global {
  interface Window { __archi: ArchiHooks }
}

export const isTestMode = (search = window.location.search): boolean =>
  new URLSearchParams(search).get('test') === '1';

export function installTestHooks(extra: Partial<ArchiHooks> = {}): ArchiHooks {
  const hooks: ArchiHooks = { ready: false, test: isTestMode(), ...extra };
  window.__archi = hooks;
  return hooks;
}

export function markReady(): void {
  window.__archi.ready = true;
}

export function markBusy(): void {
  window.__archi.ready = false;
}

/** Wait two animation frames so the browser has presented what we drew. */
export const afterPaint = (): Promise<void> =>
  new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));

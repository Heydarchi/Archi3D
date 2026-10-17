// A tiny observable store: source → (debounced) parse + model on the main thread → layout in the
// worker → scene. The newest edit wins; older layout results are dropped.
import { parse } from '../core/dsl/parse';
import { buildModel } from '../core/model/build';
import { DEFAULT_SCENE_OPTIONS, lift } from '../core/scene/lift';
import type { ArchModel, Id, Layout2D, ParseResult, SceneOptions, SceneSpec } from '../core/types';

export interface StoreState {
  source: string;
  parsed: ParseResult | null;
  model: ArchModel | null;
  layout: Layout2D | null;
  scene: SceneSpec | null;
  selection: Id | null;
  settings: SceneOptions;
  layoutPending: boolean;
  /** Counts applied layouts (tests wait on it). */
  revision: number;
}

export interface StoreDeps {
  layout(model: ArchModel, previous?: Layout2D): Promise<Layout2D>;
  debounceMs?: number;
}

export interface Store {
  get(): StoreState;
  subscribe(fn: (s: StoreState) => void): () => void;
  setSource(text: string): void;
  /** Run a pending (debounced) edit now. */
  flush(): void;
  setSettings(patch: Partial<SceneOptions>): void;
  select(id: Id | null): void;
  /** No edit waiting for the debounce and no layout in flight. */
  idle(): boolean;
}

export const DEBOUNCE_MS = 300;

export function createStore(deps: StoreDeps, settings: Partial<SceneOptions> = {}): Store {
  let state: StoreState = {
    source: '', parsed: null, model: null, layout: null, scene: null, selection: null,
    settings: { ...DEFAULT_SCENE_OPTIONS, ...settings }, layoutPending: false, revision: 0,
  };
  const subs = new Set<(s: StoreState) => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let request = 0;

  const set = (patch: Partial<StoreState>) => {
    state = { ...state, ...patch };
    for (const fn of subs) fn(state);
  };

  const run = () => {
    timer = null;
    const parsed = parse(state.source);
    const model = buildModel(parsed);
    const id = ++request;
    const selection = state.selection && model.nodes[state.selection] ? state.selection : null;
    set({ parsed, model, selection, layoutPending: true });
    deps.layout(model, state.layout ?? undefined).then(
      (layout) => {
        if (id !== request) return; // a newer edit is on its way
        set({ layout, scene: lift(model, layout, state.settings), layoutPending: false, revision: state.revision + 1 });
      },
      (err: unknown) => {
        if (id !== request) return;
        console.error('Archi3D: layout failed', err);
        set({ layoutPending: false });
      },
    );
  };

  return {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    setSource(text) {
      set({ source: text });
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, deps.debounceMs ?? DEBOUNCE_MS);
    },
    flush() {
      if (!timer) return;
      clearTimeout(timer);
      run();
    },
    setSettings(patch) {
      const s = { ...state.settings, ...patch };
      set({ settings: s, scene: state.model && state.layout ? lift(state.model, state.layout, s) : state.scene });
    },
    select(id) { set({ selection: id }); },
    idle: () => timer === null && !state.layoutPending,
  };
}

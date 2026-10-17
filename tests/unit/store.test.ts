import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type StoreState } from '../../src/app/store';
import type { ArchModel, Layout2D } from '../../src/core/types';

const emptyLayout: Layout2D = { boxes: {}, ports: {}, routes: {}, bounds: { x: 0, y: 0, w: 0, h: 0 } };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('store', () => {
  it('two rapid edits produce one layout, for the latest text only', async () => {
    const layout = vi.fn(async (_m: ArchModel) => emptyLayout);
    const store = createStore({ layout });
    store.setSource('component A');
    vi.advanceTimersByTime(100);
    store.setSource('component A\ncomponent B');
    vi.advanceTimersByTime(299);
    expect(layout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await vi.runAllTimersAsync();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(Object.keys(layout.mock.calls[0][0].nodes)).toEqual(['A', 'B']);
    expect(store.get().scene).not.toBeNull();
  });

  it('parse and model run on the edit, before layout finishes', async () => {
    let release!: (l: Layout2D) => void;
    const store = createStore({ layout: () => new Promise((r) => { release = r; }) });
    store.setSource('component A\nA -> Missing');
    vi.advanceTimersByTime(300);
    expect(store.get().model?.diagnostics.map((d) => d.code)).toEqual(['E102']);
    expect(store.get().layoutPending).toBe(true);
    release(emptyLayout);
    await vi.runAllTimersAsync();
    expect(store.get().layoutPending).toBe(false);
  });

  it('drops a stale layout that finishes after a newer one', async () => {
    const resolvers: ((l: Layout2D) => void)[] = [];
    const layout = vi.fn(() => new Promise<Layout2D>((r) => resolvers.push(r)));
    const store = createStore({ layout });
    const seen: string[] = [];
    store.subscribe((s: StoreState) => { if (s.layout) seen.push(Object.keys(s.layout.boxes).join(',')); });
    store.setSource('component A');
    vi.advanceTimersByTime(300);
    store.setSource('component B');
    vi.advanceTimersByTime(300);
    resolvers[1]({ ...emptyLayout, boxes: { B: { x: 0, y: 0, w: 1, h: 1 } } });
    await vi.runAllTimersAsync();
    resolvers[0]({ ...emptyLayout, boxes: { A: { x: 0, y: 0, w: 1, h: 1 } } });
    await vi.runAllTimersAsync();
    expect(store.get().layout?.boxes).toHaveProperty('B');
    expect(seen).toEqual(['B']);
  });

  it('passes the previous layout as a hint', async () => {
    const first: Layout2D = { ...emptyLayout, boxes: { A: { x: 1, y: 2, w: 3, h: 4 } } };
    const layout = vi.fn(async () => first);
    const store = createStore({ layout });
    store.setSource('component A');
    await vi.runAllTimersAsync();
    store.setSource('component A\ncomponent B');
    await vi.runAllTimersAsync();
    expect(layout.mock.calls[1]).toEqual([expect.anything(), first]);
  });

  it('settings re-lift without a new layout', async () => {
    const layout = vi.fn(async () => emptyLayout);
    const store = createStore({ layout });
    store.setSource('component A');
    await vi.runAllTimersAsync();
    store.setSettings({ edgeMode: 'arc' });
    expect(layout).toHaveBeenCalledTimes(1);
    expect(store.get().settings.edgeMode).toBe('arc');
  });

  it('flush() runs the pending edit immediately', async () => {
    const layout = vi.fn(async () => emptyLayout);
    const store = createStore({ layout });
    store.setSource('component A');
    store.flush();
    expect(store.get().model).not.toBeNull();
  });
});

describe('store.idle', () => {
  it('is false while an edit waits or a layout runs, true after', async () => {
    vi.useFakeTimers();
    let release!: (l: Layout2D) => void;
    const store = createStore({ layout: () => new Promise((r) => { release = r; }) });
    expect(store.idle()).toBe(true);
    store.setSource('component A');
    expect(store.idle()).toBe(false);
    vi.advanceTimersByTime(300);
    expect(store.idle()).toBe(false);
    release(emptyLayout);
    await vi.runAllTimersAsync();
    expect(store.idle()).toBe(true);
    vi.useRealTimers();
  });
});

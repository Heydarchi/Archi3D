// Screenshot-test harness: harness.html?view=<name>&fixture=<name>&test=1
import { parse } from '../core/dsl/parse';
import { buildModel } from '../core/model/build';
import { renderModelView } from '../debug/modelView';
import { renderSvg2d } from '../debug/svg2d';
import { renderProjection } from '../debug/projection';
import { lift } from '../core/scene/lift';
import { focusCamera } from '../core/lod/focus';
import type { SceneOptions } from '../core/types';
import { createLayoutClient } from './layoutClient';
import { buildFromSource } from './pipeline';
import { createView } from '../render/view';
import type { PoseName } from '../render/poses';
import { renderParseView } from '../debug/parseView';
import { getFixture } from './fixtures';
import { afterPaint, installTestHooks, markBusy, markReady } from './testHooks';
import { createInfoPanel } from './infoPanel';
import { renderCube } from './views/cube';

type ViewFn = (root: HTMLElement, params: URLSearchParams) => void | Promise<void>;

declare global {
  interface Window { __ARCHI_SOURCE__?: string }
}

/** The model text: injected by scripts/render.mjs (window.__ARCHI_SOURCE__) or a bundled fixture. */
const source = (p: URLSearchParams): string => window.__ARCHI_SOURCE__ ?? getFixture(p.get('fixture') ?? 'northwind');

function sceneOptions(p: URLSearchParams): Partial<SceneOptions> {
  const opts: Partial<SceneOptions> = {};
  const gap = p.get('gap');
  if (gap) opts.levelGap = Number(gap);
  const edges = p.get('edges');
  if (edges === 'ortho' || edges === 'arc') opts.edgeMode = edges;
  return opts;
}

const views: Record<string, ViewFn> = {
  cube: (root) => renderCube(root),
  parse: (root, p) => {
    const src = source(p);
    renderParseView(root, src, parse(src));
  },
  model: (root, p) => renderModelView(root, buildModel(parse(source(p)))),
  proj: async (root, p) => {
    const model = buildModel(parse(source(p)));
    const client = createLayoutClient();
    try {
      const opts = sceneOptions(p);
      renderProjection(root, lift(model, await client.layout(model), opts), `levelGap ${opts.levelGap ?? 60}, edges ${opts.edgeMode ?? 'ortho'}`);
    } finally {
      client.dispose();
    }
  },
  scene: async (root, p) => {
    const built = await buildFromSource(source(p), sceneOptions(p), p.get('fixture') ?? '');
    const canvas = document.createElement('canvas');
    root.append(canvas);
    const view = createView(canvas, {
      test: window.__archi.test, theme: p.get('theme') === 'dark' ? 'dark' : 'light', fontUrl: p.get('font') ?? undefined,
    });
    view.setScene(built.scene, built.model);
    if (p.get('lod') === 'off') view.setSemanticZoom(false);
    if (p.get('zoom') === 'size') view.setZoomRule('size');
    if (p.get('detail')) view.setDetail(Number(p.get('detail')));
    if (p.get('bundle') === 'on') view.setBundling(true);
    const cam = p.get('cam') ?? 'far';
    if (cam === 'focus') view.setCamera(focusCamera(built.scene, p.get('focus') ?? '', Number(p.get('k') ?? 1.5), root.clientHeight));
    else view.setCamera(cam as PoseName);
    await view.ready();
    view.render();
    const settle = async () => { await view.ready(); view.render(); await afterPaint(); };
    const select = (id: string | null) => { view.select(id); panel.show(built.model, id); };
    const flyTo = async (id: string | null) => {
      markBusy();
      select(id);
      await view.flyTo(id);
      await settle();
      markReady();
    };
    const panel = createInfoPanel(root, (id) => void flyTo(id));
    if (p.get('panel') === 'off') panel.element.style.display = 'none';
    view.on('pick', select);
    view.on('dblpick', (id) => void flyTo(id));
    if (p.get('select')) select(p.get('select'));
    Object.assign(window.__archi, {
      setCamera: (pose: PoseName) => view.setCamera(pose),
      select: (id: string | null) => { select(id); view.render(); },
      flyTo,
      screenPos: (id: string) => view.screenPos(id),
      state: () => ({
        camera: view.cameraState(), labelMode: view.labelMode(), containers: view.lodState()?.containers, selected: view.selected(),
        fadedFloors: [...(view.lodState()?.fadedFloors ?? [])],
      }),
    });
  },
  svg2d: async (root, p) => {
    const model = (await buildFromSource(source(p), {}, p.get('fixture') ?? '')).model;
    const client = createLayoutClient();
    try {
      renderSvg2d(root, model, await client.layout(model));
    } finally {
      client.dispose();
    }
  },
};

async function main(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const hooks = installTestHooks();
  const root = document.getElementById('root')!;
  const name = params.get('view') ?? 'cube';
  const view = views[name];
  try {
    if (!view) throw new Error(`Unknown view "${name}"`);
    await view(root, params);
    await document.fonts.ready;
    await afterPaint();
  } catch (err) {
    hooks.error = String(err instanceof Error ? err.stack ?? err.message : err);
    root.textContent = hooks.error;
  }
  markReady();
}

void main();

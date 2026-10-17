// The app: editor on the left, 3D view on the right, kept in sync through the store.
import type { SceneSpec } from '../core/types';
import { createView } from '../render/view';
import { createEditor } from './editor';
import { defaultFixture, getFixture } from './fixtures';
import { createInfoPanel } from './infoPanel';
import { createLayoutClient } from './layoutClient';
import { createStore } from './store';
import { importText } from './importFile';
import { afterPaint, installTestHooks, isTestMode, markBusy, markReady } from './testHooks';

async function main(): Promise<void> {
  const hooks = installTestHooks();
  const host = document.getElementById('view')!;
  const status = document.getElementById('status')!;
  const canvas = document.createElement('canvas');
  host.prepend(canvas);
  const view = createView(canvas, { test: isTestMode() });
  const client = createLayoutClient();
  const store = createStore({ layout: (model, previous) => client.layout(model, {}, previous) });

  const panel = createInfoPanel(host, (id) => flyTo(id));
  const select = (id: string | null) => {
    store.select(id);
    view.select(id);
    panel.show(store.get().model!, id);
  };
  const flyTo = (id: string | null) => { select(id); void view.flyTo(id); };
  view.on('pick', select);
  view.on('dblpick', flyTo);

  const fixtureName = new URLSearchParams(window.location.search).get('fixture') ?? defaultFixture;
  document.getElementById('file-name')!.textContent = `${fixtureName}.arch`;
  const busy = document.getElementById('busy')!;
  const editor = createEditor(document.querySelector<HTMLElement>('#editor .cm-host')!, getFixture(fixtureName), (text) => {
    markBusy();
    store.setSource(text);
  });

  let shownScene: SceneSpec | null = null;
  let shownModel: unknown = null;
  store.subscribe((s) => {
    busy.hidden = !s.layoutPending;
    if (s.model && s.model !== shownModel) {
      shownModel = s.model;
      editor.showDiagnostics(s.model.diagnostics);
      const errors = s.model.diagnostics.filter((d) => d.severity === 'error').length;
      const warnings = s.model.diagnostics.length - errors;
      status.textContent = errors || warnings ? `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}` : '';
    }
    if (s.scene && s.model && s.scene !== shownScene && !s.layoutPending) {
      shownScene = s.scene;
      view.setScene(s.scene, s.model);   // keeps the camera where it is after the first scene
      if (s.selection) panel.show(s.model, s.selection);
      void view.ready().then(async () => {
        if (store.get().scene !== s.scene || !store.idle()) return;
        view.render();
        await afterPaint();
        if (store.get().scene === s.scene && store.idle()) markReady();
      });
    }
  });

  const edges = document.getElementById('edge-mode') as HTMLButtonElement;
  edges.addEventListener('click', () => {
    const edgeMode = store.get().settings.edgeMode === 'ortho' ? 'arc' : 'ortho';
    edges.textContent = `Edges: ${edgeMode}`;
    store.setSettings({ edgeMode });
  });
  const bundleBtn = document.getElementById('bundling') as HTMLButtonElement;
  let bundling = false;
  bundleBtn.addEventListener('click', () => {
    bundling = !bundling;
    bundleBtn.textContent = `Bundling: ${bundling ? 'on' : 'off'}`;
    view.setBundling(bundling);
  });
  const zoomBtn = document.getElementById('semantic-zoom') as HTMLButtonElement;
  let semantic = true;
  zoomBtn.addEventListener('click', () => {
    semantic = !semantic;
    zoomBtn.textContent = semantic ? 'Semantic zoom: on' : 'Semantic zoom: off (all open)';
    view.setSemanticZoom(semantic);
  });

  const importInput = document.getElementById('import-file') as HTMLInputElement;
  const importNote = document.getElementById('import-note')!;
  document.getElementById('import')!.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const f = importInput.files?.[0];
    if (!f) return;
    importInput.value = '';
    try {
      markBusy();
      const r = await importText(f.name, await f.text());
      document.getElementById('file-name')!.textContent = f.name;
      editor.setText(r.source);
      if (r.warnings.length) status.title = r.warnings.map((w) => `line ${w.loc.line}: ${w.message}`).join('\n');
      importNote.textContent = r.format === 'arch' ? '' : `Imported (${r.format}${r.warnings.length ? `, ${r.warnings.length} line${r.warnings.length === 1 ? '' : 's'} skipped` : ''})`;
    } catch (err) {
      importNote.textContent = `Import failed: ${err instanceof Error ? err.message : String(err)}`;
      markReady();
    }
  });

  Object.assign(hooks, {
    setCamera: (pose: Parameters<typeof view.setCamera>[0]) => view.setCamera(pose),
    select,
    flyTo: async (id: string | null) => { select(id); await view.flyTo(id); },
    screenPos: (id: string) => view.screenPos(id),
    state: () => ({
      elkSource: (globalThis as { __archiElkSource?: string }).__archiElkSource ?? 'module',
      revision: store.get().revision, idle: store.idle(), inSync: store.get().source === editor.text(), selected: view.selected(), camera: view.cameraState(),
      diagnostics: store.get().model?.diagnostics.map((d) => `${d.code}@${d.loc.line}`) ?? [],
    }),
    setSource: (text: string) => editor.setText(text),
  });

  markBusy();
  store.setSource(editor.text());
  store.flush();
}

void main();

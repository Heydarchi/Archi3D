// The live 3D preview inside VS Code (a webview). It is the 3D view without the editor.
// The extension sends the document text; clicks are sent back so it can reveal the line.
// Outside VS Code (tests, a plain browser) messages go through window.postMessage and the
// outgoing ones are collected in window.__archiOutbox.
import { createView } from '../render/view';
import { setupDetailKeys } from './keys';
import { nextColorBy, renderLegend } from './colorByControl';
import type { ColorBy } from '../core/model/colorBy';
import { createInfoPanel } from './infoPanel';
import { createLayoutClient } from './layoutClient';
import type { HostMessage, PreviewMessage } from './previewProtocol';
import { createStore } from './store';
import { afterPaint, installTestHooks, isTestMode, markBusy, markReady } from './testHooks';

interface VsCodeApi { postMessage(m: unknown): void }
declare function acquireVsCodeApi(): VsCodeApi;
declare global {
  interface Window { __archiOutbox?: PreviewMessage[] }
}

const vscode: VsCodeApi = typeof acquireVsCodeApi === 'function'
  ? acquireVsCodeApi()
  : { postMessage: (m) => { (window.__archiOutbox ??= []).push(m as PreviewMessage); } };
const send = (m: PreviewMessage) => vscode.postMessage(m);

const CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: var(--vscode-editor-background, #eef1f5); }
  #view { position: fixed; inset: 0; }
  .bar { position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; z-index: 2; flex-wrap: wrap; justify-content: flex-end; }
  .bar button { font: 12px var(--vscode-font-family, system-ui, sans-serif); padding: 4px 8px; border-radius: 4px; cursor: pointer;
    color: var(--vscode-button-secondaryForeground, #1f2933); background: var(--vscode-button-secondaryBackground, #fff);
    border: 1px solid var(--vscode-contrastBorder, #bcccdc); }
  .status { position: absolute; left: 8px; top: 8px; z-index: 2; font: 12px var(--vscode-font-family, system-ui, sans-serif);
    color: var(--vscode-descriptionForeground, #52606d); }
`;

function button(bar: HTMLElement, label: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', () => onClick(b));
  bar.append(b);
  return b;
}

function main(): void {
  installTestHooks();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const host = document.createElement('div');
  host.id = 'view';
  document.body.append(host);
  const canvas = document.createElement('canvas');
  host.append(canvas);
  const dark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
  const view = createView(canvas, { test: isTestMode(), theme: dark ? 'dark' : 'light' });
  setupDetailKeys(view);
  const client = createLayoutClient();
  const store = createStore({ layout: (model, previous) => client.layout(model, {}, previous) });

  const status = document.createElement('div');
  status.className = 'status';
  host.append(status);
  const bar = document.createElement('div');
  bar.className = 'bar';
  host.append(bar);
  let semantic = true, bundling = false;
  button(bar, 'Semantic zoom: on', (b) => { semantic = !semantic; b.textContent = `Semantic zoom: ${semantic ? 'on' : 'off'}`; view.setSemanticZoom(semantic); });
  button(bar, 'Edges: ortho', (b) => {
    const edgeMode = store.get().settings.edgeMode === 'ortho' ? 'arc' : 'ortho';
    b.textContent = `Edges: ${edgeMode}`;
    store.setSettings({ edgeMode });
  });
  let colorBy: ColorBy = 'kind';
  button(bar, 'Colour: kind', (b) => { colorBy = nextColorBy(colorBy); b.textContent = `Colour: ${colorBy}`; view.setColorBy(colorBy); renderLegend(canvas.parentElement ?? document.body, view); });
  button(bar, 'Bundling: off', (b) => { bundling = !bundling; b.textContent = `Bundling: ${bundling ? 'on' : 'off'}`; view.setBundling(bundling); });
  button(bar, 'Fit', () => { void view.flyTo(null); });

  const panel = createInfoPanel(host, (id) => { select(id); void view.flyTo(id); });
  const select = (id: string | null) => {
    view.select(id);
    const model = store.get().model;
    if (model) panel.show(model, id);
  };
  view.on('pick', (id) => { select(id); send({ type: 'pick', id }); });
  view.on('dblpick', (id) => { select(id); void view.flyTo(id); send({ type: 'pick', id }); });

  let shown: unknown = null;
  let documentName: string | null = null;
  let refit = false;            // a different document: frame it; the same one: keep the camera
  store.subscribe((s) => {
    if (s.scene && s.model && s.scene !== shown && !s.layoutPending) {
      shown = s.scene;
      view.setScene(s.scene, s.model);
      if (refit) { refit = false; view.setCamera('far'); }
      const errors = s.model.diagnostics.filter((d) => d.severity === 'error').length;
      status.textContent = errors ? `${errors} error${errors === 1 ? '' : 's'}, showing what is valid` : '';
      void view.ready().then(async () => {
        if (store.get().scene !== s.scene || !store.idle()) return;
        view.render();
        await afterPaint();
        send({ type: 'rendered', revision: s.revision, errors });
        if (store.get().scene === s.scene && store.idle()) markReady();
      });
    }
  });

  window.addEventListener('message', (ev: MessageEvent<HostMessage>) => {
    const m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'update') {
      if (documentName !== null && m.name !== documentName) refit = true;
      documentName = m.name;
      markBusy();
      store.setSource(m.source);
    } else if (m.type === 'select') {
      select(m.id);
      if (m.id) void view.flyTo(m.id);
    } else if (m.type === 'capture') {
      send({ type: 'captured', requestId: m.requestId, dataUrl: view.snapshot() });
    }
  });

  Object.assign(window.__archi, {
    screenPos: (id: string) => view.screenPos(id),
    state: () => ({ revision: store.get().revision, idle: store.idle(), selected: view.selected(), labelMode: view.labelMode(), elkSource: (globalThis as { __archiElkSource?: string }).__archiElkSource ?? 'module' }),
  });
  send({ type: 'ready' });
}

main();

// createView(canvas): the only thing the app talks to. See docs/ARCHITECTURE.md.
import CameraControls from 'camera-controls';
import * as THREE from 'three';
import { lidSpecs, lidTitleAnchor } from '../core/lod/lids';
import { LABEL_BUDGET, lod, type ZoomRule } from '../core/lod/lod';
import type { ArchModel, CameraState, Id, LodResult, Pt, SceneSpec, V3 } from '../core/types';
import defaultFontUrl from '../../vendor/fonts/inter-latin-400-normal.woff?url';
import { SceneRoot } from './build';
import { createLabelLayer, type LabelMode } from './labels';
import { DARK, LIGHT, type Palette } from './palette';
import { pick } from './picking';
import { cameraPose, flyTarget, toPerspective, type PoseName } from './poses';
import { Presenter } from './present';

CameraControls.install({ THREE });

export interface ViewOptions {
  /** Deterministic rendering: no smoothing, no animation, render only on demand. */
  test?: boolean;
  theme?: 'light' | 'dark';
  /** Label font (WOFF/TTF). Defaults to the bundled Inter from vendor/fonts. */
  fontUrl?: string;
  /** How long to wait for the label font before falling back to HTML labels (2 s, 15 s in test mode). */
  labelTimeoutMs?: number;
}

export type ViewEvent = 'pick' | 'dblpick';

export const TEST_LABEL_TIMEOUT_MS = 15_000;
/** Smallest and largest detail factor (keys - and +). */
export const DETAIL_RANGE = [0.4, 2.5] as const;

export interface View {
  setScene(scene: SceneSpec, model: ArchModel): void;
  setCamera(pose: PoseName | CameraState): void;
  /** Fly to frame an element; null = overview. Resolves when the camera has arrived. */
  flyTo(id: Id | null): Promise<void>;
  select(id: Id | null): void;
  selected(): Id | null;
  screenPos(id: Id): Pt | null;
  on(event: ViewEvent, fn: (id: Id | null) => void): void;
  /** Render now (test mode) or on the next frame. */
  render(): void;
  cameraState(): CameraState;
  /** Resolves when the current scene, including label text, is fully drawn. */
  ready(): Promise<void>;
  labelMode(): LabelMode;
  /** Semantic zoom on (default) or off ("all open"). */
  setSemanticZoom(enabled: boolean): void;
  /** Which rule opens containers (see core/lod). */
  setZoomRule(rule: ZoomRule): void;
  /** Detail factor for the zoom (1 = default); returns the new value. */
  setDetail(detail: number): number;
  detail(): number;
  /** Hierarchical edge bundling for links between closed containers (off by default). */
  setBundling(enabled: boolean): void;
  lodState(): LodResult | null;
  /** Draw now and return the frame as a PNG data URL (works without preserveDrawingBuffer). */
  snapshot(): string;
  dispose(): void;
}

const SMOOTH_TIME = 0.35;
const CLICK_SLOP_PX = 5;

export function createView(canvas: HTMLCanvasElement, opts: ViewOptions = {}): View {
  const test = !!opts.test;
  const palette: Palette = opts.theme === 'dark' ? DARK : LIGHT;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: test });
  renderer.setPixelRatio(test ? 1 : Math.min(window.devicePixelRatio, 2));
  const scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(palette.background);
  scene3.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-400, 900, 600);
  scene3.add(sun);

  const root = new SceneRoot(palette);
  scene3.add(root.group);
  const overlayHost = canvas.parentElement ?? document.body;
  // In test mode wait longer for the font, so a slow machine (CI) still draws the same labels.
  const labelTimeoutMs = opts.labelTimeoutMs ?? (test ? TEST_LABEL_TIMEOUT_MS : undefined);
  const labels = createLabelLayer({ fontUrl: opts.fontUrl ?? defaultFontUrl, palette, overlayHost, timeoutMs: labelTimeoutMs });
  scene3.add(labels.group);

  const camera = new THREE.PerspectiveCamera(40, 1, 1, 40000);
  camera.position.set(600, 900, 1100);
  const controls = new CameraControls(camera, canvas);
  controls.smoothTime = test ? 0 : SMOOTH_TIME;
  controls.draggingSmoothTime = test ? 0 : 0.1;
  controls.maxPolarAngle = Math.PI * 0.49;   // stay above the ground
  controls.minDistance = 20;
  controls.maxDistance = 20000;
  controls.dollyToCursor = true;
  const clock = new THREE.Clock();

  let current: { scene: SceneSpec; model: ArchModel } | null = null;
  let selected: Id | null = null;
  let labelsReady: Promise<void> = Promise.resolve();
  let presenter: Presenter | null = null;
  let lodResult: LodResult | null = null;
  let semantic = true;
  let zoomRule: ZoomRule = 'readable';
  let detail = 1;
  let bundling = false;
  let lastDraw = 0;
  let lidTitles = new Map<Id, V3>();
  const handlers: Record<ViewEvent, ((id: Id | null) => void)[]> = { pick: [], dblpick: [] };
  let frame = 0;
  let disposed = false;

  const size = () => {
    const el = canvas.parentElement ?? canvas;
    return { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) };
  };
  const aspect = () => { const { w, h } = size(); return w / h; };

  const cameraState = (): CameraState => {
    const p = camera.position, t = controls.getTarget(new THREE.Vector3());
    return { position: { x: p.x, y: p.y, z: p.z }, target: { x: t.x, y: t.y, z: t.z }, fovDeg: camera.fov, viewportH: size().h, aspect: aspect() };
  };

  /** Semantic zoom for this frame; true while lids are still fading. */
  const applyLod = (): boolean => {
    if (!current || !presenter) return false;
    const now = performance.now();
    const dt = lastDraw ? now - lastDraw : 0;
    lastDraw = now;
    lodResult = lod(current.scene, current.model, cameraState(), lodResult ?? undefined, { selected, enabled: semantic, maxLabels: LABEL_BUDGET, rule: zoomRule, detail });
    labels.setVisible(lodResult.visibleLabels);
    for (const [id, at] of lidTitles) labels.setAnchor(id, lodResult.containers[id] === 'closed' ? at : null);
    const shown = presenter.apply(lodResult, selected, dt, test, bundling);
    if (shown.changed) labels.setDimmed(shown.dimLabels);
    return shown.animating;
  };

  const draw = () => {
    const { w, h } = size();
    const animating = applyLod();
    labels.update(camera, h);
    renderer.render(scene3, camera);
    labels.render(scene3, camera, w, h);
    return animating;
  };

  let drawing = false;
  const render = () => {
    if (disposed || drawing) return;
    if (test) {
      // controls.update() fires 'update', which calls render() again: draw once.
      drawing = true;
      try { controls.update(0); draw(); } finally { drawing = false; }
      return;
    }
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const moving = controls.update(clock.getDelta());
      const animating = draw();
      if (moving || animating) render();
    });
  };

  const resize = () => {
    const { w, h } = size();
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    root.objects?.edges.setResolution(w, h);
    render();
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas.parentElement ?? canvas);
  controls.addEventListener('control', render);
  controls.addEventListener('update', render);
  controls.addEventListener('wake', render);

  /** Move the camera; with a transition unless in test mode. */
  const moveTo = async (state: CameraState, transition: boolean): Promise<void> => {
    // Planes from the closer of the two ends so nothing is clipped on the way.
    const here = cameraState();
    const dHere = Math.hypot(here.position.x - here.target.x, here.position.y - here.target.y, here.position.z - here.target.z);
    const dThere = Math.hypot(state.position.x - state.target.x, state.position.y - state.target.y, state.position.z - state.target.z);
    toPerspective(dThere < dHere ? state : here, aspect(), camera);
    camera.far = Math.max(dHere, dThere) * 20 + 5000;
    camera.updateProjectionMatrix();
    const { position: p, target: t } = state;
    const done = controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, transition && !test);
    if (test || !transition) controls.update(0);
    render();
    await done;
    render();
  };

  const lookup = (id: Id) => {
    const s = current?.scene;
    return s?.blocks.find((b) => b.id === id) ?? s?.plates.find((p) => p.id === id) ?? null;
  };

  // Click selects, double-click flies in. Ignore clicks that ended a drag.
  let downAt: Pt | null = null;
  const pickAt = (ev: MouseEvent): Id | null => {
    if (!root.objects) return null;
    const r = canvas.getBoundingClientRect();
    return pick(root.objects, camera, ev.clientX - r.left, ev.clientY - r.top, r.width, r.height);
  };
  const onDown = (ev: PointerEvent) => { downAt = { x: ev.clientX, y: ev.clientY }; };
  const moved = (ev: MouseEvent) => !!downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > CLICK_SLOP_PX;
  const onClick = (ev: MouseEvent) => { if (!moved(ev)) handlers.pick.forEach((fn) => fn(pickAt(ev))); };
  const onDblClick = (ev: MouseEvent) => { if (!moved(ev)) handlers.dblpick.forEach((fn) => fn(pickAt(ev))); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('dblclick', onDblClick);

  return {
    setScene(scene, model) {
      const objects = root.setScene(scene, model);
      presenter = new Presenter(objects, model, palette, scene);
      lidTitles = new Map(lidSpecs(scene, model).map((l) => [l.id, lidTitleAnchor(l)]));
      lodResult = null;
      const { w, h } = size();
      objects.edges.setResolution(w, h);
      const first = !current;
      current = { scene, model };
      if (selected && !model.nodes[selected]) selected = null;
      // New labels start undimmed: make the presenter re-apply the selection to them.
      labelsReady = labels.setLabels(scene).then(() => { presenter = new Presenter(objects, model, palette, scene); render(); });
      if (first) void moveTo(cameraPose('far', scene, aspect(), size().h), false);
      else render();
    },
    setCamera(pose) {
      if (typeof pose !== 'string') { void moveTo(pose, false); return; }
      if (current) void moveTo(cameraPose(pose, current.scene, aspect(), size().h), false);
    },
    async flyTo(id) {
      if (!current) return;
      const target = (id && flyTarget(current.scene, current.model, id, aspect(), size().h)) || cameraPose('far', current.scene, aspect(), size().h);
      await moveTo(target, true);
    },
    select(id) { selected = id && current?.model.nodes[id] ? id : null; render(); },
    selected: () => selected,
    setSemanticZoom(enabled) { semantic = enabled; render(); },
    setZoomRule(rule) { zoomRule = rule; lodResult = null; render(); },
    setDetail(d) { detail = Math.min(DETAIL_RANGE[1], Math.max(DETAIL_RANGE[0], d)); render(); return detail; },
    detail: () => detail,
    setBundling(enabled) { bundling = enabled; render(); },
    lodState: () => lodResult,
    snapshot() {
      controls.update(0);
      draw();
      return canvas.toDataURL('image/png');
    },
    screenPos(id) {
      const el = lookup(id);
      if (!el) return null;
      const v = new THREE.Vector3(el.center.x, el.center.y, el.center.z).project(camera);
      const { w, h } = size();
      return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
    },
    on(event, fn) { handlers[event].push(fn); },
    render,
    cameraState,
    ready: () => labelsReady,
    labelMode: () => labels.mode(),
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDblClick);
      ro?.disconnect();
      controls.dispose();
      labels.dispose();
      root.dispose();
      renderer.dispose();
    },
  };
}

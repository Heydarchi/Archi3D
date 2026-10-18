// Labels that stay crisp at every zoom: troika SDF text, billboarded and scaled by distance to a
// fixed pixel size. If the font has not loaded within 2 s, switch to CSS2D labels (warn once).
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Text, preloadFont } from 'troika-three-text';
import { ellipsize, LABEL_PX } from '../core/scene/labelText';
import type { LabelSpec, SceneSpec } from '../core/types';
import { coveredText } from './fontCoverage';
import type { Palette } from './palette';

export type LabelMode = 'troika' | 'css2d';

export interface LabelLayerOptions {
  fontUrl: string;
  palette: Palette;
  /** Element the CSS2D fallback overlay is added to (positioned like the canvas). */
  overlayHost: HTMLElement;
  timeoutMs?: number;
}

export interface LabelLayer {
  readonly group: THREE.Group;
  mode(): LabelMode;
  /** Replace all labels with the scene's; resolves once their text is drawable. */
  setLabels(scene: SceneSpec): Promise<void>;
  /** null shows every label. */
  setVisible(ids: Set<string> | null): void;
  /** Fade these labels (null = none). */
  setDimmed(ids: Set<string> | null): void;
  /** Move a label (null = back to its spec anchor). */
  setAnchor(id: string, at: { x: number; y: number; z: number } | null): void;
  /** Billboard + constant pixel size; call before each render. */
  update(camera: THREE.PerspectiveCamera, viewportH: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera, width: number, height: number): void;
  dispose(): void;
}

interface Entry { spec: LabelSpec; obj: THREE.Object3D }
interface Anchor { x: 'left' | 'center' | 'right'; y: 'bottom' | 'middle'; cx: number; cy: number }

let warned = false;

function anchorOf(s: LabelSpec, portDir: Map<string, 'in' | 'out'>): Anchor {
  if (s.role === 'container') return { x: 'left', y: 'middle', cx: 0, cy: 0.5 };
  if (s.role === 'port') {
    return portDir.get(s.id) === 'in' ? { x: 'right', y: 'middle', cx: 1, cy: 0.5 } : { x: 'left', y: 'middle', cx: 0, cy: 0.5 };
  }
  return { x: 'center', y: 'bottom', cx: 0.5, cy: 1 };
}

const textOf = (s: LabelSpec) => coveredText(ellipsize(s.text));

export function createLabelLayer(opts: LabelLayerOptions): LabelLayer {
  const group = new THREE.Group();
  group.name = 'labels';
  const pal = opts.palette;
  const timeoutMs = opts.timeoutMs ?? 2000;
  let mode: LabelMode = 'troika';
  let fontOk: Promise<boolean> | null = null;
  let entries: Entry[] = [];
  let visible: Set<string> | null = null;
  let css: CSS2DRenderer | null = null;
  const baseMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });

  const fontReady = (chars: string): Promise<boolean> => {
    fontOk ??= new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      preloadFont({ font: opts.fontUrl, characters: chars }, () => { clearTimeout(timer); resolve(true); });
    });
    return fontOk;
  };

  const switchToCss = () => {
    mode = 'css2d';
    if (!warned) {
      console.warn(`Archi3D: label font "${opts.fontUrl}" did not load within ${timeoutMs} ms; using HTML labels.`);
      warned = true;
    }
    css = new CSS2DRenderer();
    Object.assign(css.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    opts.overlayHost.append(css.domElement);
  };

  const clear = () => {
    for (const e of entries) {
      group.remove(e.obj);
      if (e.obj instanceof Text) e.obj.dispose();
      if (e.obj instanceof CSS2DObject) e.obj.element.remove();
    }
    entries = [];
  };

  const troikaLabel = (s: LabelSpec, a: Anchor): Promise<Entry> => {
    const t = new Text();
    t.text = textOf(s);
    t.font = opts.fontUrl;
    t.fontSize = 1;
    t.color = pal.label[s.role];
    t.anchorX = a.x;
    t.anchorY = a.y;
    t.outlineWidth = 0.14;
    t.outlineColor = pal.label.halo;
    t.position.set(s.anchor.x, s.anchor.y, s.anchor.z);
    t.renderOrder = 10;
    t.userData = { id: s.id, role: s.role };
    // troika derives its SDF material from this base, so the depth settings must live here.
    t.material = baseMaterial;
    return new Promise((resolve) => t.sync(() => resolve({ spec: s, obj: t })));
  };

  const cssLabel = (s: LabelSpec, a: Anchor): Entry => {
    const div = document.createElement('div');
    div.textContent = ellipsize(s.text);
    div.className = `archi-label archi-label-${s.role}`;
    Object.assign(div.style, {
      font: `${s.role === 'port' || s.role === 'edge' ? 400 : 600} ${LABEL_PX[s.role]}px system-ui, sans-serif`,
      color: pal.label[s.role], whiteSpace: 'nowrap',
      textShadow: `0 0 3px ${pal.label.halo}, 0 0 2px ${pal.label.halo}`,
    });
    const o = new CSS2DObject(div);
    o.center.set(a.cx, a.cy);
    o.position.set(s.anchor.x, s.anchor.y, s.anchor.z);
    o.userData = { id: s.id, role: s.role };
    return { spec: s, obj: o };
  };

  const applyVisibility = () => {
    for (const e of entries) e.obj.visible = !visible || visible.has(e.spec.id);
  };

  return {
    group,
    mode: () => mode,
    async setLabels(scene) {
      clear();
      const portDir = new Map(scene.ports.map((p) => [p.id, p.dir] as const));
      const chars = Array.from(new Set(scene.labels.flatMap((s) => Array.from(textOf(s))))).join('');
      if (mode === 'troika' && !(await fontReady(chars || 'A'))) switchToCss();
      entries = mode === 'troika'
        ? await Promise.all(scene.labels.map((s) => troikaLabel(s, anchorOf(s, portDir))))
        : scene.labels.map((s) => cssLabel(s, anchorOf(s, portDir)));
      for (const e of entries) group.add(e.obj);
      applyVisibility();
    },
    setVisible(ids) { visible = ids; applyVisibility(); },
    setDimmed(ids) {
      for (const e of entries) {
        const a = ids?.has(e.spec.id) ? 0.2 : 1;
        if (e.obj instanceof Text) { e.obj.fillOpacity = a; e.obj.outlineOpacity = a; e.obj.sync(); }
        else if (e.obj instanceof CSS2DObject) e.obj.element.style.opacity = String(a);
      }
    },
    setAnchor(id, at) {
      const e = entries.find((x) => x.spec.id === id);
      if (!e) return;
      const p = at ?? e.spec.anchor;
      e.obj.position.set(p.x, p.y, p.z);
    },
    update(camera, viewportH) {
      if (mode !== 'troika') return;
      const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewportH;
      for (const e of entries) {
        if (!e.obj.visible) continue;
        e.obj.quaternion.copy(camera.quaternion);
        e.obj.scale.setScalar(LABEL_PX[e.spec.role] * camera.position.distanceTo(e.obj.position) * k);
      }
    },
    render(scene, camera, width, height) {
      if (!css) return;
      css.setSize(width, height);
      css.render(scene, camera);
    },
    dispose() {
      clear();
      baseMaterial.dispose();
      css?.domElement.remove();
    },
  };
}

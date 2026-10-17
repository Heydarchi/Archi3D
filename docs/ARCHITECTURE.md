# Archi3D architecture

Text in, 3D view out, through five stages. Each stage is a function with a typed
input and output, so each can be tested alone and swapped without touching the
others.

```
 .arch3d text ──► dsl/parse ──► model/build ──► layout/elk ──► scene/lift ──► render/three
   (string)     AstFile +     ArchModel       Layout2D       SceneSpec      WebGL view
                Diagnostics                                                    ▲
 Mermaid / LikeC4 / D2 ──► adapters/* ──────┘ (produce ArchModel directly)     │
                                                     lod/controller ─────────┤ (per frame)
                                                     app/store + editor ─────┘
```

## Layers and the one rule that matters

| Layer | Folder | May import | Must not import |
|---|---|---|---|
| Pure core | `src/core/{dsl,model,layout,scene,lod,adapters}` | each other (downstream only), `elkjs` | `three`, DOM, `window`, `document` |
| Rendering | `src/render` | `src/core`, `three`, `camera-controls`, `troika-three-text` | `src/app` |
| App shell | `src/app` | everything | — |
| Debug views | `src/debug` | `src/core` | `three` (debug views are SVG so they render without WebGL) |

The pure core runs unchanged in Node (unit tests), in a Web Worker (layout in the
browser) and in the main thread. An ESLint `no-restricted-imports` rule enforces
the table; a unit test also greps `src/core` for `three` and `document`.

Data flows one way. Nothing downstream mutates anything upstream: each stage
returns new objects.

## Contracts

These are the types the stages exchange. They live in `src/core/types.ts`.
Changing one is a deliberate act: update this file, the snapshot tests and the
step notes together.

```ts
// ---------- shared ----------
export type Id = string;                 // component or container name (unique per file)
export type PortId = `${Id}.${string}`;  // "OrderAPI.db"
export interface Loc { line: number; col: number; endCol: number }
export interface Diagnostic { code: string; severity: 'error' | 'warning'; message: string; loc: Loc }

// ---------- dsl ----------
export type PortSide = 'N' | 'E' | 'S' | 'W';           // set by adapters (Mermaid sides); unset in .arch3d
export interface PortDecl { name: string; iface?: string; side?: PortSide; loc: Loc }
export interface AstNode {
  type: 'node'; kind: string; name: string; container: boolean;
  ins: PortDecl[]; outs: PortDecl[]; children: AstItem[]; loc: Loc;
}
export interface AstRef { name: string; port?: string; loc: Loc }
export interface AstEdge { type: 'edge'; from: AstRef; to: AstRef; async: boolean; label?: string; loc: Loc }
export type AstItem = AstNode | AstEdge;
export interface ParseResult { items: AstItem[]; diagnostics: Diagnostic[] }
export declare function parse(src: string): ParseResult;

// ---------- model ----------
export type Shape = 'box' | 'db' | 'queue' | 'ext';
export interface Port { id: PortId; name: string; dir: 'in' | 'out'; iface?: string; side?: PortSide; implicit: boolean }
export interface ModelNode {
  id: Id; kind: string; shape: Shape; container: boolean;
  parent: Id | null; depth: number; children: Id[]; ports: Port[]; loc: Loc;
}
export interface ModelEdge {
  id: string;                               // "e0", "e1" in source order
  from: { node: Id; port?: PortId }; to: { node: Id; port?: PortId };
  async: boolean; label?: string; lca: Id | null;   // lowest common container, null = top level
}
export interface ArchModel { nodes: Record<Id, ModelNode>; roots: Id[]; edges: ModelEdge[]; diagnostics: Diagnostic[] }
export declare function buildModel(parsed: ParseResult): ArchModel;

// ---------- layout ----------
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }
export interface LayoutOptions { direction: 'RIGHT' | 'DOWN'; nodeSpacing: number; layerSpacing: number }
export interface Layout2D {
  boxes: Record<Id, Rect>;            // absolute, top-left origin
  ports: Record<PortId, Pt>;          // absolute port centres
  routes: Record<string, Pt[]>;       // edge id -> absolute polyline, first/last point on the ports
  bounds: Rect;
}
// previous: the last layout of this document, passed to ELK as position hints (edit stability)
export declare function layout(model: ArchModel, opts?: Partial<LayoutOptions>, previous?: Layout2D): Promise<Layout2D>;

// ---------- scene ----------
export interface V3 { x: number; y: number; z: number }   // y is up
export interface PlateSpec { id: Id; depth: number; center: V3; size: V3 }
export interface BlockSpec { id: Id; shape: Shape; center: V3; size: V3 }
export interface PortSpec  { id: PortId; owner: Id; dir: 'in' | 'out'; pos: V3 }
export interface EdgeSpec  { id: string; points: V3[]; async: boolean; label?: string; labelAt?: V3 }
export interface LabelSpec { id: string; text: string; anchor: V3; role: 'container' | 'component' | 'port' | 'edge' }
export interface SceneOptions { levelGap: number; blockHeight: number; edgeMode: 'ortho' | 'arc' }
export interface SceneSpec {
  plates: PlateSpec[]; blocks: BlockSpec[]; ports: PortSpec[]; edges: EdgeSpec[]; labels: LabelSpec[];
  bounds: { min: V3; max: V3 };
}
export declare function lift(model: ArchModel, layout: Layout2D, opts?: Partial<SceneOptions>): SceneSpec;

// ---------- lod (semantic zoom) ----------
export interface CameraState { position: V3; target: V3; fovDeg: number; viewportH: number; aspect?: number }  // aspect: width/height
export type ContainerState = 'open' | 'closed' | 'hidden';
export interface LodResult {
  containers: Record<Id, ContainerState>;
  visibleLabels: Set<string>;
  visibleEdges: Set<string>;
}
export interface LodOptions { selected?: Id | null; enabled?: boolean; maxLabels?: number }   // enabled=false: "all open"
export declare function lod(scene: SceneSpec, model: ArchModel, cam: CameraState, prev?: LodResult, opts?: LodOptions): LodResult;
```

## Rendering (`src/render`)

`createView(canvas, opts)` returns a small object; it is the only thing the app
talks to:

```ts
interface View {
  setScene(scene: SceneSpec, model: ArchModel): void;   // rebuilds objects, disposes old ones
  setCamera(pose: 'far' | 'mid' | 'near' | 'iso' | CameraState): void;
  flyTo(id: Id | null): Promise<void>;                  // null = overview
  select(id: Id | null): void;
  screenPos(id: Id): Pt | null;                         // for tests and tooltips
  on(event: 'pick' | 'dblpick', fn: (id: Id | null) => void): void;
  dispose(): void;
  // Added while building steps 5–9:
  selected(): Id | null;
  render(): void;                                       // on demand in test mode
  cameraState(): CameraState;
  ready(): Promise<void>;                               // labels synced, frame drawn
  labelMode(): 'troika' | 'css2d';
  setSemanticZoom(enabled: boolean): void;              // false = "all open"
  lodState(): LodResult | null;
}
```

Inside: one `InstancedMesh` per element type (plates, lids, box blocks, cylinders, ports,
arrowheads), one merged outline batch, two `LineSegments2` edge batches (solid, dashed) plus
one for aggregated links into closed containers, troika SDF text for labels (HTML labels as a
fallback), and a per-frame call to `lod()` whose result `render/present.ts` applies.
Colours come from one palette object so light and dark themes are a single swap.

## App shell (`src/app`)

- `store.ts`: a tiny observable store `{ source, parsed, model, layout, scene, selection, settings }`.
  Setting `source` triggers parse → model synchronously and layout in the worker; the
  newest request wins (older results are dropped).
- `editor.ts`: CodeMirror 6 with a small stream-language mode for `.arch3d`; diagnostics
  shown with `@codemirror/lint`.
- `worker.ts`: runs `layout()` off the main thread.
- `testHooks.ts`: when the URL has `?test=1`, exposes `window.__archi`
  (`ready`, `setCamera`, `select`, `screenPos`, `state`) and turns off animation and damping.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | The app: editor plus 3D view |
| `harness.html?fixture=<name>&view=<parse|model|svg2d|proj|scene>&cam=<pose>&test=1` | One fixture, one view, used by screenshot tests |

## Folder layout

```
archi3d/
  CLAUDE.md               rules for Claude Code
  docs/                   ARCHITECTURE.md, PLAN.md, GRAMMAR.md
  fixtures/               *.arch3d test models, errors/ with expected.json
  reference/              prototype from the research phase (read-only)
  src/core/               pure: dsl, model, layout, scene, lod, adapters, types.ts
  src/render/             three.js view
  src/debug/              SVG debug views (AST, model, 2D layout, projections)
  src/app/                store, editor, worker, test hooks, main.ts
  tests/unit/             Vitest
  tests/visual/           Playwright, reference images per OS
  scripts/                vendor.mjs, offline-pack.mjs, export-standalone.mjs (Node, cross-platform)
  vendor/                 pinned local copies of runtime libraries and fonts + manifest.json
  artifacts/              screenshots for review (git-ignored)
```

## Decisions and why

| Decision | Why |
|---|---|
| Browser app, three.js, no game engine | Light (~185 kB), mature, largest ecosystem; same stack as ExplorViz |
| ELK Layered for layout, lifted to 3D | Only mature layout that handles nesting and ports together; 2.5D has the best research support |
| Scene description (`SceneSpec`) between layout and three.js | 3D geometry becomes plain data, testable with numbers and SVG projections before any WebGL |
| Semantic zoom as a pure function | Testable with a table of camera distances; no flaky interaction tests |
| Hand-written parser first, Langium later | Fast to change while the grammar settles; Langium when an editor with completion is worth it |
| Local-first libraries, CDN optional | The app and tests must work with no network |

## Known gotcha

elkjs 0.9.3 ignores `elk.json.edgeCoords: ROOT`. Each edge's points come back
relative to the lowest container that holds both ends (`ModelEdge.lca`). The
layout adapter must add that container's absolute offset. The prototype in
`reference/prototype-core.js` (`flattenLayout`) shows the fix.

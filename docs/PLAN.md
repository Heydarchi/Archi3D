# Archi3D build plan

One step per Claude Code session. Start each session with:

> Read CLAUDE.md, docs/ARCHITECTURE.md and step N in docs/PLAN.md. Do step N only.

A step is done when **all** of these hold:

1. `npm test` passes (unit tests).
2. `npm run test:visual` passes (screenshot tests).
3. The step's pictures are saved in `artifacts/step-N/`, Claude Code has opened
   each one, described it, and found nothing wrong.
4. `npm run lint` passes, including the rule that `src/core` imports no `three`/DOM.
5. The step's checkbox below is ticked and a short note is added under it
   (what was built, anything left for later).

Pictures are written by the visual tests with
`await page.screenshot({ path: 'artifacts/step-N/<name>.png' })` in addition to
the `toHaveScreenshot()` comparison.

---

## Step 0 — Scaffold and offline toolchain

- [x] Done

> Note: Vite 8, Vitest 5, Playwright 1.64, TypeScript 5.9.3 (typescript-eslint needs < 6.1), three 0.186.1.
> elkjs stays on 0.9.3 because of the edgeCoords problem described in ARCHITECTURE.md. `.npmrc` puts the
> npm cache in `offline/npm-cache` and I checked that `npm ci --offline --cache offline/npm-cache` works.
> @fontsource/inter only has WOFF (no TTF), so `vendor/fonts/` has WOFF files. `npm run lint` runs `tsc` too.
> The visual tests run with `PW_CHANNEL=chrome`.

**Goal.** An empty project where unit tests, screenshot tests and a WebGL test page
all work, with the network off.

**Build.**
- `package.json` with exact versions (no `^`): `vite`, `typescript`, `vitest`,
  `@playwright/test`, `eslint` + `typescript-eslint`, `three`, `@types/three`,
  `elkjs`, `camera-controls`, `troika-three-text`, `@fontsource/inter` (or another
  font that ships WOFF/TTF), CodeMirror packages can wait until step 10.
- `tsconfig.json` strict. `vite.config.ts` with two pages: `index.html`, `harness.html`.
- `vitest.config.ts`: Node environment, `tests/unit/**/*.test.ts`.
- `playwright.config.ts`:
  - `webServer`: `vite preview` (after `vite build`) on a fixed port.
  - Viewport 1280×800, `deviceScaleFactor: 1`.
  - Chromium launch args: `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`,
    `--ignore-gpu-blocklist`.
  - `channel: process.env.PW_CHANNEL` so `PW_CHANNEL=chrome` or `msedge` uses the
    browser already installed on the PC when Playwright's Chromium isn't downloaded.
  - A global `beforeEach`/fixture that aborts every request not to `localhost`/`127.0.0.1`.
  - `expect.toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' }`.
- `scripts/vendor.mjs`: copies from `node_modules` into `vendor/`:
  `three/build/three.module.js`, the three add-ons used later
  (`OrbitControls`, `CSS2DRenderer`, `Line2`, `LineMaterial`, `LineGeometry`,
  `LineSegments2`, `LineSegmentsGeometry`), `elkjs/lib/elk.bundled.js`,
  `camera-controls`'s ES module build, `troika-three-text`'s bundle, and the font files
  (WOFF and TTF — troika cannot read WOFF2). Writes `vendor/manifest.json` with
  package name, version and SHA-256 per file.
- `scripts/offline-pack.mjs`: runs `npm ci --cache ./offline/npm-cache` so a later
  `npm ci --offline --cache ./offline/npm-cache` works without internet. Prints the command.
- `harness.html` + `src/app/harness.ts`: reads URL params; for now draws one lit,
  rotated cube with three.js on a fixed background, then sets `window.__archi = { ready: true }`.
- `src/app/testHooks.ts`: the `window.__archi` skeleton (see ARCHITECTURE.md).
- ESLint with `no-restricted-imports` for `src/core/**` (no `three`, no `three/*`).
- npm scripts: `dev`, `build`, `preview`, `test`, `test:visual`, `test:visual:update`,
  `lint`, `vendor`, `offline:pack`.
- `.gitignore`: `node_modules`, `dist`, `artifacts`, `offline`, `test-results`.

**Unit tests.**
- `vendor.test.ts`: every file in `vendor/manifest.json` exists, its hash matches, and
  its version equals the version in `package-lock.json`.
- `boundaries.test.ts`: no file under `src/core` contains `from 'three'` or `document.`
  (passes trivially now; it guards later steps).

**Pictures.** `artifacts/step-0/cube.png` — a shaded cube, three visible faces with
different brightness, centred.

**Done when.** Both test commands pass with Wi-Fi turned off (after the first
install), and the cube picture shows lighting (not a flat silhouette — that would
mean WebGL fell back or lights are missing).

---

## Step 1 — Parser

- [x] Done

> Note: A tokenizer per line (`dsl/tokenize.ts`, a `-` in a name stops before `->` and `-->`) and a
> parser for each kind of statement. `Loc.endCol` is exclusive. For a node the `loc` is its name, for
> an edge the whole line. `-->` is synchronous like `->`. Edges inside a container are children of it.
> If there is no label the field is not there (not `undefined`). 10k lines take a few ms.

**Goal.** `parse(src)` turns `.arch3d` text into an AST with exact error locations,
following docs/GRAMMAR.md.

**Build.**
- `src/core/types.ts` with the shared and dsl types from ARCHITECTURE.md.
- `src/core/dsl/tokenize.ts`: per line, tokens with column positions; strips comments.
- `src/core/dsl/parse.ts`: statement recognisers for node, container open, close, edge.
  Recovers at the next line after an error. Records E001, E002, E003.
- `src/debug/parseView.ts`: renders the source with line numbers on the left and the AST
  as an indented tree on the right as plain HTML/SVG; errors are underlined in red with
  the message beside the line.
- Harness: `view=parse`.

**Unit tests.** (`tests/unit/parse.test.ts`)
- Each fixture in `fixtures/*.arch3d` parses with no errors; AST matches a Vitest snapshot.
- Table-driven: each file in `fixtures/errors/` with E00x codes yields exactly the
  code and line in `expected.json`; parsing continues after the error (e.g. in
  `bad-line.arch3d`, `B` and the link are still in the AST).
- Columns: for `A -> B : label`, `from.loc.col === 1`, `to.loc.col === 6`, label text exact.
- Ports with types: `in: http:REST, q` → two ports, first with `iface: 'REST'`.
- Arrow variants `->`, `-->`, `=>`, `<-` (the last swaps ends).
- Comments with `#` and `//`, blank lines, tabs, CRLF line endings.
- 10,000-line generated input parses in under 200 ms.

**Pictures.** `artifacts/step-1/parse-northwind.png`, `parse-bad-line.png`
(the bad line underlined with its message).

**Done when.** All fixtures parse; every error fixture gives its code; the error
picture shows the underline on the right line.

---

## Step 2 — Model

- [x] Done

> Note: `model/{build,lca,shape}.ts`. Ports that a link creates (`_in`/`_out` without a name, or a
> named one that is not declared) get `implicit: true`. A container end without ports of that direction
> stays without a port, a component end always gets one. If one end is inside the other, the lca is
> that container. Edge ids only count valid links. I checked the snapshots (lca, depth, ports).

**Goal.** `buildModel(parsed)` resolves names, creates implicit ports, computes depth
and the lowest common container of each link, and reports semantic errors.

**Build.**
- `src/core/model/build.ts` per ARCHITECTURE.md. Shapes from kind
  (`database|db → db`, `queue → queue`, `external|actor → ext`, else `box`).
- Port resolution rules from GRAMMAR.md (first port of the right direction, else an
  implicit anonymous port `_in`/`_out` with `implicit: true`).
- Diagnostics E101, E102, E103, W201, W202. Invalid links are dropped from `edges`
  but the rest of the model is kept.
- `src/debug/modelView.ts`: a table of nodes (id, kind, depth, parent, ports) and links
  (from → to, lca), plus counts at the top.
- Harness: `view=model`.

**Unit tests.** (`tests/unit/model.test.ts`)
- Model JSON snapshot for each valid fixture.
- `expected.json` codes E1xx/W2xx are produced at the right lines.
- `nested-deep.arch3d`: `Ledger.depth === 3`; lca of `Invoicer → Scorer` is `Payments`;
  lca of `Merchant → Invoicer` is `null`.
- `container-links.arch3d`: container-to-container link has no ports; `App <- Core`
  becomes `Core → App`.
- Implicit ports: `A -> B` with no declared ports gives `A._out` and `B._in`.
- Determinism: building twice gives deep-equal output; edge ids follow source order.

**Pictures.** `artifacts/step-2/model-nested-deep.png`, `model-typed-ports.png`
(the W201 warning visible).

**Done when.** Snapshots are reviewed (open them and check they make sense, don't
just accept them).

---

## Step 3 — 2D layout

- [x] Done

> Note: `layout/{toElk,flatten,orthogonal,size,index}.ts`. Northwind takes about 70 ms (cold). Routes
> start and end in the center of the ports and all segments are straight, because elkjs leaves small
> 0.5 jogs on edges that cross containers. elk.bundled.js takes over `self.onmessage` in a Web Worker,
> so `app/elkWorkerShim.ts` gives the worker a fake `document`. Open point: edge labels are sometimes on
> container borders.

**Goal.** `layout(model)` returns absolute 2D boxes, port positions and orthogonal
routes using ELK, and a 2D SVG view shows them.

**Build.**
- `src/core/layout/toElk.ts`: model → ELK graph. Options: `elk.algorithm=layered`,
  `elk.direction=RIGHT`, `elk.hierarchyHandling=INCLUDE_CHILDREN`,
  `elk.edgeRouting=ORTHOGONAL`, ports with `elk.port.side` WEST for `in`, EAST for
  `out`, `elk.portConstraints=FIXED_SIDE`, container padding with room for a title.
  Component size from name length and port count (see `reference/prototype-core.js`).
- `src/core/layout/flatten.ts`: ELK result → `Layout2D`. **Add the lca container's
  absolute offset to each edge's points** (elkjs returns them relative to the lca —
  see the gotcha in ARCHITECTURE.md).
- `src/core/layout/index.ts`: `layout()` using `elkjs/lib/elk.bundled.js` (works in
  Node and in a worker).
- `src/app/worker.ts` + a small client that posts the model and awaits `Layout2D`.
- `src/debug/svg2d.ts`: draws containers (outlined, title top-left), components
  (filled boxes, shape hint for db/queue/ext), ports (teal in / red out dots), routes
  with arrowheads, async links dashed.
- Harness: `view=svg2d`.

**Unit tests.** (`tests/unit/layout.test.ts`)
- For every fixture:
  - every child box lies fully inside its parent box (with padding);
  - no two sibling boxes overlap;
  - each route's first point is within 1 unit of its source port and last point
    within 1 unit of its target port;
  - every route segment is horizontal or vertical;
  - running `layout()` twice gives identical output.
- `northwind.arch3d` lays out in under 1 s in Node (first call, cold).

**Pictures.** `artifacts/step-3/svg2d-<fixture>.png` for all valid fixtures.

**Done when.** In the pictures, every line starts and ends on a dot, nothing
overlaps, and nested containers read clearly.

---

## Step 4 — 3D lift

- [x] Done

> Note: `scene/{lift,edgePaths,vec}.ts`. Defaults: levelGap 60, blockHeight 26, plate 6, port lead 14
> (max half of the first/last segment). The real top of the arc is at the height from the spec (the
> control point is calculated for it). Container ends are on top of the plate. Label ids: node id, port
> id, `edge:<id>`. Components float one level over their parent plate (block bottom = depth x levelGap),
> like the spec says.

**Goal.** `lift(model, layout, opts)` produces a `SceneSpec`: all 3D geometry as plain
data, with no three.js.

**Build.**
- `src/core/scene/lift.ts`:
  - 2D (x, y) → 3D (x, z), centred on the origin; y is up.
  - Container plate at `y = depth * levelGap`, thickness 6.
  - Component block sits on its parent's plate level: `y = depth * levelGap`,
    height `blockHeight` (26), db as cylinder size, queue lower.
  - Port positions at mid-height of their block.
  - `edgeMode='ortho'`: route runs at the higher endpoint's height, with a short
    horizontal lead out of each port then a vertical drop to the lower port.
  - `edgeMode='arc'`: quadratic curve sampled to 32 points, apex height
    `max(yA, yB) + 0.32 × distance + 24`.
  - Labels: container title at its top-left corner; component name above the block;
    port names beside ports; edge label at the middle of the longest segment.
- `src/debug/projection.ts`: draws a `SceneSpec` as two orthographic SVG views:
  top (x–z) and side (x–y), plates as outlines, blocks filled, edges as polylines.
- Harness: `view=proj&gap=<n>&edges=<ortho|arc>`.

**Unit tests.** (`tests/unit/lift.test.ts`)
- Block bottom y equals `depth × levelGap` for every component in `nested-deep`.
- Each edge's first/last point equals its port's 3D position.
- Ortho edges: every segment is axis-aligned in 3D.
- Arc edges: every point's y ≥ min(endpoint y); apex above both ends.
- Doubling `levelGap` doubles every plate's y and leaves x/z unchanged.
- `bounds` contains every point of every element.

**Pictures.** `artifacts/step-4/proj-nested-deep-ortho.png`, `proj-nested-deep-arc.png`,
`proj-northwind-gap120.png`.

**Done when.** The side view shows clear stair-stepped levels and edges that join
the right blocks.

---

## Step 5 — Renderer

- [x] Done

> Note: `render/{build,view,poses,palette}.ts`. `SceneRoot` owns the objects and disposes them when the
> scene changes. The poses fit the 8 corners of the bounds exactly (not a sphere): far = 50° from +z,
> iso = 45°/45°, mid = 0.4 x far, near = the block closest to the center. Edges and labels were simple
> placeholders here (done in steps 6 and 7). index.html shows northwind in 3D.

**Goal.** A three.js view of a `SceneSpec` with fixed camera poses and orbit controls.

**Build.**
- `src/render/build.ts`: builds the three.js object tree from a `SceneSpec` without a
  renderer, so it runs in Node for unit tests.
- `src/render/view.ts` implementing `createView` from ARCHITECTURE.md on top of
  `build.ts` (edges and labels can be simple placeholders now; steps 6–7 finish them).
- Plates: semi-opaque boxes coloured by depth. Blocks: boxes / cylinders with thin
  outline edges. Ports: small spheres, teal (in) / red (out). Ground grid.
- Lights: hemisphere + one directional. Palette object for colours (light and dark).
- Camera poses computed from `scene.bounds`: `far` (whole model), `mid` (40% of it),
  `near` (one component), `iso` (45° from above).
- OrbitControls with damping; polar angle limited so the camera stays above ground.
  When `?test=1`: no damping, no animation, render only on demand.
- `dispose()` frees all geometries and materials.
- Harness: `view=scene&cam=<pose>`.

**Unit tests.** (`tests/unit/build.test.ts`, three.js in Node — building objects needs no WebGL)
- Given `SceneSpec` for `northwind`, the created group has exactly one object per
  plate, block and port.
- After `setScene()` twice, the old geometries' `dispose` was called (spy).
- Pose math: the `far` pose's frustum contains all eight corners of `bounds`.

**Pictures.** `artifacts/step-5/scene-northwind-{far,iso,near}.png`.

**Done when.** The far picture shows the whole model with no part cut off, levels are
visibly stacked, and shading distinguishes the faces.

---

## Step 6 — Edges

- [x] Done

> Note: `render/edges.ts`. Since step 11 all edges are drawn in two batches (solid and dashed, 2 px)
> plus a cone per edge whose tip is on the target port. The resolution is set on setScene and resize.
> index.html has an "Edges: ortho/arc" button that runs `lift` again. I made the step 5 pictures again
> because the edges changed.

**Goal.** Readable links in 3D: constant pixel width, arrowheads, dashed async.

**Build.**
- `Line2` + `LineMaterial` (width 2 px, `worldUnits: false`), `resolution` updated on resize.
- Arrowhead cone at the target end, oriented along the last segment.
- Async links dashed (`dashed: true`, `computeLineDistances()`).
- Settings toggle `edgeMode` between ortho and arc (rebuilds via `lift`).

**Unit tests.**
- Arrowhead orientation: the cone's up-vector is parallel to the last segment (dot > 0.99).
- Async edges get a dashed material; sync edges don't.
- `edgeMode` switch changes the edge point count (ortho ≤ 10 points, arc = 33).

**Pictures.** `artifacts/step-6/edges-northwind-ortho-iso.png`, `edges-northwind-arc-iso.png`.

**Done when.** Arrowheads point at the targets and the dashed `OrderPlaced` link is
visibly different from the solid ones.

---

## Step 7 — Labels

- [x] Done

> Note: `render/labels.ts` (troika, always facing the camera, size in pixels per role, no depth test
> by using a base material because troika makes its own). After 2 s without the font it uses CSS2D
> labels and warns once. troika loads fonts from a CDN for missing characters, so
> `render/fontCoverage.ts` changes characters outside Inter's latin range to "?". `View.ready()` waits for
> all `sync()` calls. Step 5 and 6 pictures made again with labels.

**Goal.** Names that stay crisp at every zoom level, working offline.

**Build.**
- `src/render/labels.ts`: troika-three-text with the font from `vendor/fonts/` (TTF or
  WOFF). Billboarded (face the camera). Sizes: container 14, component 12, port 10.5,
  edge 10.5 (screen-ish sizes via scale by distance).
- Fallback: if troika fails to load the font within 2 s, switch to `CSS2DRenderer`
  labels and log a warning once.
- Long names cut with an ellipsis beyond 24 characters.
- Wait for troika's `sync()` callbacks before setting `__archi.ready` so screenshots
  include the text.

**Unit tests.**
- Label anchor for a component is above its block's top face.
- Ellipsis: a 40-character name renders as 23 characters + `…`.

**Visual tests.** Fallback path: load the harness with `&font=missing.ttf`; the view
must switch to CSS2D labels and still show names (`fallback-labels.png`).

**Pictures.** `artifacts/step-7/labels-northwind-near.png`, `labels-northwind-far.png`.

**Done when.** In the near picture the component and port names are readable; in the
far picture text does not pile up (step 8 will hide more).

---

## Step 8 — Semantic zoom

- [x] Done

> Note: `core/lod/{lod,lids,focus}.ts`. Since step 11 `render/present.ts` applies the result to the
> view. `lod()` has a 5th parameter `opts` (`selected`, `enabled`), ARCHITECTURE.md is updated. Extra: the
> title of a container is hidden when the camera is inside it (ratio < 0.8), and the title of a closed
> container moves on top of its lid. Harness: `cam=focus&focus=<id>&k=<x diag>` and `lod=off`. Step 5 and 6
> pictures use `lod=off`. The app has an on/off button.

**Goal.** Far away you see closed containers; closer, they open and show components;
closest, ports and edge labels appear.

**Build.**
- `src/core/lod/lod.ts` (pure, see ARCHITECTURE.md):
  - For each container, `ratio = distance(camera, containerCentre) / footprintDiagonal`.
    `closed` when ratio > 3.0, `open` when < 2.6, keep previous state in between
    (hysteresis, so it doesn't flicker).
  - Children of a closed container are `hidden`.
  - Edge visible unless both ends are inside the same closed container (aggregated
    edges between closed containers stay visible).
  - Component label visible when its box is wider than 48 px on screen; port labels
    when the block is taller than 120 px; edge label when the edge is longer than 160 px.
  - The selected container is forced open when ratio < 3.4.
- `src/render`: closed containers drawn as a lid box (fades over 150 ms, instant in
  test mode); per-frame call to `lod()`.
- A setting to turn semantic zoom off ("all open").

**Unit tests.** (`tests/unit/lod.test.ts`) — table of camera distances for `nested-deep`:
- far: `Platform` closed, everything inside hidden, `Merchant → Invoicer` edge visible.
- mid: `Platform` open, `Payments` and `Messaging` closed.
- near `Billing`: `Billing` open, its port labels visible.
- Hysteresis: moving from ratio 2.9 to 2.7 and back to 2.9 doesn't change state.

> Later (0.3.0): this ratio rule is now `rule: 'size'`. The default is `rule: 'readable'` in
> `core/lod/readable.ts`: a container opens when what is inside it is readable, see ARCHITECTURE.md.

**Pictures.** `artifacts/step-8/lod-nested-deep-{far,mid,near}.png`.

**Done when.** The three pictures clearly show three levels of detail of the same model.

---

## Step 9 — Select and fly in

- [x] Done

> Note: `core/model/query.ts` (connectedEdges, breadcrumb, neighbours, highlightSet),
> `render/picking.ts` and `app/infoPanel.ts`. The highlight is in `render/present.ts` since step 11.
> camera-controls replaced OrbitControls (setLookAt with the exact fit from `flyTarget`, smoothTime 0.35,
> no animation in test mode). The selection pictures use `lod=off` so the click hits the OrderAPI block
> and not the Ordering lid.

**Goal.** Click to select and see dependencies; double-click to fly in; breadcrumb to fly out.

**Build.**
- Picking with a `Raycaster` against blocks and plates (lids only when closed).
- Highlight: selected element and its direct links in the accent colour; everything
  not connected fades to 15% opacity. Selecting a container highlights links that
  cross its border.
- Replace OrbitControls with `camera-controls` (`fitToBox`, `smoothTime` 0.35 s;
  instant in test mode). `flyTo(null)` returns to the far pose.
- Info panel: name, kind, ports, depends on, used by; breadcrumb `All › Northwind › Ordering`.
- Test hook `screenPos(id)` projects a block centre to pixels.

**Unit tests.**
- Pure helper `connectedEdges(model, id)`: for `Ordering` returns exactly the links
  with one end inside and one outside.
- Breadcrumb path for `OrderDB` is `['Northwind', 'Ordering']`.
- Fly target for a component frames its block (frustum contains block corners).

**Visual tests.** Click at `screenPos('OrderAPI')`, then screenshot; double-click, wait
for `ready`, screenshot.

**Pictures.** `artifacts/step-9/select-orderapi.png`, `flyin-orderapi.png`, `select-ordering.png`.

**Done when.** In the selection picture only `OrderAPI` and its neighbours are bright.

---

## Step 10 — Editor and live update

- [x] Done

> Note: CodeMirror 6 (and @lezer/highlight) pinned, `app/{editor,archLanguage,lintMapping,store}.ts`.
> The layout became stable with `elk.layered.considerModelOrder.strategy=NODES_AND_EDGES` on the root
> (on every container it crashes elkjs 0.9.3). The old layout is also passed as hint, but that didn't
> change much. This changed the layout of all fixtures, so I made the pictures of steps 3 to 9 again and
> checked them. The app is only "ready" when the store is idle and has the same text as the editor
> (no flaky tests in the middle of typing).

**Goal.** Type in an editor and watch the 3D view update, with errors marked inline.

**Build.**
- Add CodeMirror 6 packages (exact versions; run `npm run vendor` and
  `npm run offline:pack` again).
- `src/app/editor.ts`: stream-language mode (kinds, names, ports, arrows, comments),
  `@codemirror/lint` showing parse and model diagnostics.
- `src/app/store.ts`: debounce 300 ms; parse + model on the main thread; layout in the
  worker; drop stale results.
- Layout stability: pass previous positions to ELK as hints
  (`elk.layered.crossingMinimization.semiInteractive` / position hints) so an edit
  moves as little as possible. Keep the camera where it is.
- `index.html`: editor left, view right; on narrow screens the editor becomes a bottom sheet.

**Unit tests.**
- Store: two rapid edits produce one layout for the latest text only.
- Stability: adding one component to `northwind` moves every unrelated component's
  centre by less than 15% of the model width.
- Lint mapping: E102 at line 2 becomes a CodeMirror diagnostic on line 2.

**Pictures.** `artifacts/step-10/app-northwind.png`, `app-error.png` (an unknown name
underlined), `app-after-edit.png`.

**Done when.** The after-edit picture shows the new component without the rest jumping around.

---

## Step 11 — Scale

- [x] Done

> Note: gen-1000 (seed 42): layout 0.80 s in Node, `lod()` median 0.24 ms, 10 draw calls.
> The renderer uses instancing for everything now (`render/{instances,present,outlines}.ts`, opacity per
> instance with a small shader patch). Edges are two LineSegments2 batches plus instanced arrows. Links
> into closed containers are one arc per pair of containers (`core/lod/aggregate.ts`), without that the
> far view was just noise. `lod()` has `maxLabels` (150). `scripts/generate.mjs` loads `gen.ts` with
> Vite's `runnerImport` (works on Node 20). App: `?fixture=<name>` and a "Laying out..." indicator.

**Goal.** Comfortable with 1,000 components.

**Build.**
- `scripts/generate.mjs` + `src/core/gen.ts`: seeded random model (systems → containers →
  components, links mostly within a system). Writes `fixtures/gen-1000.arch3d`.
- `InstancedMesh` for blocks (per shape) and ports; `LineSegments2` batch for edges of
  closed or far containers.
- Label budget: at most 150 labels at once, nearest first.
- Layout in the worker with a progress indicator.

**Unit tests.**
- Generator is deterministic for a seed.
- `layout(gen-1000)` finishes under 8 s in Node (record the time in the step note).
- View for `gen-1000` uses fewer than 60 draw calls (count meshes + instanced meshes +
  line batches).
- `lod()` for 1,000 nodes runs under 2 ms.

**Pictures.** `artifacts/step-11/gen-1000-far.png`, `gen-1000-near.png`.

**Done when.** The far picture reads as a handful of closed systems, not noise.

---

## Step 12 — Standalone offline file

- [x] Done

> Note: `npm run export` makes `dist/archi3d-standalone.html` (2.62 MB), `--cdn` makes `...-cdn.html`.
> The layout worker is built two times as IIFE (with ELK, and without ELK for the CDN version) and
> started from a Blob URL (`app/workerFactory.standalone.ts`, swapped in for the export). The `http(s)`
> strings that are left are XML namespace names inside three and ELK and one shader comment, they are
> never loaded. The unit test allows exactly those and the browser test checks that no request is made.
> troika's CDN address is removed.

**Goal.** `npm run export` writes one HTML file you can email or double-click, which
works with no internet.

**Build.**
- `scripts/export-standalone.mjs`: builds with Vite in single-file mode (inline JS,
  CSS, fonts as data URIs, ELK in an inline worker from a Blob URL), embeds a chosen
  `.arch3d` file. Output: `dist/archi3d-standalone.html`.
- Optional CDN mode (`--cdn`): a loader tries pinned CDN URLs (exact versions from
  `vendor/manifest.json`) with a 3 s timeout and falls back to the inlined copies.
- Opens from `file://` (no fetches of relative files).

**Unit tests.**
- The exported file contains no `http://` or `https://` except the CDN list in CDN mode.
- Size is under 3 MB.

**Visual tests.** Open the file via `file://` with every request blocked; wait for
`ready`; screenshot. Repeat in CDN mode with CDN blocked (must fall back).

**Pictures.** `artifacts/step-12/standalone-offline.png`, `standalone-cdn-fallback.png`.

**Done when.** Both pictures match the step-10 app view.

---

## Step 13 — Import adapters

- [x] Done

> Note: `core/adapters/{mermaid,d2,detect}.ts` make an AST and use `buildModel`. Mermaid sides become
> ports without a name (`_out_R`, `_in_L`...) with the new optional `Port.side` (types.ts and
> ARCHITECTURE.md, toElk uses it). I took D2 and not LikeC4: D2 has no dependencies, LikeC4 brings vite,
> playwright and esbuild. `@terrastruct/d2` 0.1.33 is loaded only when needed (8 MB) and is not in the
> offline file. Import converts to `.arch3d` with the new `core/dsl/print.ts`. New warning code W301.

**Goal.** Read other formats into the same `ArchModel`.

**Build.**
- `src/core/adapters/mermaid.ts`: Mermaid `architecture-beta` (`group`, `service ... in`,
  `a:R --> L:b` edges; sides become port sides). Hand-written small parser — do not pull
  in the whole Mermaid package.
- Then one of: LikeC4 (`likec4` package's `fromSource`) or D2 (`@terrastruct/d2` WASM
  compile). Adapters that need heavy packages load them lazily.
- App: file-type detection by extension or first line; "Import" button.
- Fixtures: `fixtures/adapters/northwind.mmd` (same system as `northwind.arch3d`).

**Unit tests.**
- `northwind.mmd` → model with the same nodes, parents and links as `northwind.arch3d`
  (ports may differ; compare node ids, parents and edge endpoints).
- Unsupported Mermaid lines give a warning, not a crash.

**Pictures.** `artifacts/step-13/mermaid-northwind.png` next to `native-northwind.png`.

**Done when.** The two pictures show the same structure.

---

## Step 14 (optional) — Edge bundling

- [x] Done

> Note: `core/scene/bundle.ts` (path through the raised container centers or a virtual root,
> beta 0.85, cubic B-spline, 33 points). Only for the arcs between closed containers, the links of the
> selected element stay as arcs. Off by default ("Bundling" button, harness `bundle=on`). Fixed on the
> way: EdgeBatch didn't notice when only the shape of a curve changed.

Hierarchical edge bundling (Holten 2006) for links between containers in the far
view: control points follow the nesting tree path from source to target through
container centres raised above the plates. Unbundle the selected element's links.
Tests: bundled control points follow the tree path; selected links are unbundled.
Pictures: overview bundled vs unbundled.

## Step 15 (optional) — Langium

- [ ] Done (not started yet: it needs Langium and LSP packages and a second parser)

Move the grammar to Langium; run its language server in a worker for completion,
go-to-definition and hover in CodeMirror (or Monaco). Tests: every fixture gives the
same `ArchModel` as the hand-written parser (property test over generated inputs).
Pictures: editor showing completion.

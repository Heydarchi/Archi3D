# Archi3D — rules for Claude Code

Archi3D turns a tiny text language (`.arch3d`, see docs/GRAMMAR.md) describing software
components, their ports and links into an interactive 3D view you can zoom into.
Pipeline: parse → model → ELK 2D layout → 3D lift → three.js. Read
docs/ARCHITECTURE.md before changing anything; docs/PLAN.md holds the steps.

## How we work

- **One step per session.** Do only the step you were asked for. If you find work that
  belongs to a later step, write it in that step's note instead of doing it.
- **A step is done** only when `npm test`, `npm run test:visual` and `npm run lint` pass
  and you have opened every PNG in `artifacts/step-N/` with the Read tool, described
  what you see in one line each, and fixed anything that looks wrong. Then tick the
  step's checkbox in docs/PLAN.md and add a 2–4 line note under it.
- **Tests first where it is cheap**: write the unit tests from the step's list, watch
  them fail, then implement.
- Never accept new screenshot references or Vitest snapshots blindly. Open them, check
  them, and say in your summary which ones changed and why.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | App at http://localhost:5173 |
| `npm test` | Unit tests (Vitest, Node) |
| `npm run test:visual` | Build, then screenshot tests (Playwright, SwiftShader WebGL) |
| `npm run test:visual:update` | Re-create reference images (only when a change is intended) |
| `npm run lint` | ESLint, including the core/no-three rule |
| `npm run vendor` | Copy pinned runtime libraries and fonts into `vendor/` |
| `npm run offline:pack` | Fill `offline/npm-cache` so `npm ci --offline --cache offline/npm-cache` works |

If Playwright's Chromium is not installed and there is no internet, run the visual
tests with `PW_CHANNEL=chrome` (or `msedge`). On PowerShell: `$env:PW_CHANNEL="chrome"`.

## Hard rules

1. `src/core/**` is pure TypeScript: no `three`, no DOM, no `window`/`document`. It must
   run in Node, in a Web Worker and in the browser.
2. No network at runtime or in tests. Never add a CDN `<script>` or a `fetch()` to an
   external host. Libraries come from `node_modules` (bundled by Vite) or `vendor/`.
   The Playwright config blocks non-localhost requests; don't weaken that.
3. Pin exact dependency versions (no `^` or `~`). After adding or upgrading a runtime
   dependency, run `npm run vendor` and `npm run offline:pack`.
4. Rendering must be deterministic under `?test=1`: no damping, no animations, no
   `Math.random()` without a seed, `deviceScaleFactor` 1. Set `window.__archi.ready = true`
   only after the frame (and label text) is fully drawn.
5. Types shared between stages live in `src/core/types.ts`. Changing one means updating
   docs/ARCHITECTURE.md and the affected snapshots in the same change.
6. Scripts are Node (`.mjs`), not bash, so they run on Windows, macOS and Linux.
7. Diagnostic codes in docs/GRAMMAR.md are stable; tests assert on them.

## Git

No co-author or tool-credit lines; short plain commit messages; small commits at every step;
work on branches and push only the branch — `main` is protected and the owner merges pull requests.
Full rules (shared with all agents): @AGENTS.md

## Reference material

- `reference/prototype.html` and `reference/prototype-core.js`: the research
  prototype (single file, loads libraries from a CDN — do not copy that part). Its
  parser, ELK options and `flattenLayout` edge-offset fix are useful starting points.
- `fixtures/`: test models. `fixtures/errors/expected.json` maps each error fixture to
  the diagnostic code and line it must produce.

## Style

- TypeScript strict, ES modules, small files (one concept each).
- Pure functions return new objects; no mutation of inputs.
- Name things by what they are in the domain: component, container, port, link, level.

# Working on Archi3D

This page is for people who change Archi3D itself. For using it, see the
[user guide](USER_GUIDE.md). The rules for commits and pull requests are in
[AGENTS.md](../AGENTS.md), the design is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

You need Node.js 20 or newer.

```sh
npm ci                     # without internet: npm ci --offline --cache offline/npm-cache
npm run dev                # the app on http://localhost:5173
```

## Before a pull request

```sh
npm test                               # unit tests (Vitest, Node)
npm run lint                           # ESLint and TypeScript
PW_CHANNEL=chrome npm run test:visual  # build, then the screenshot tests with your installed Chrome
```

- If you changed the view, open the pictures in `artifacts/` and check them. Take new reference
  pictures with `npm run test:visual:update` only after you checked them.
- CI runs `check` (lint and unit tests on Linux) and `visual` (screenshot tests on macOS) on every
  pull request. If `visual` fails, the differences are in the `visual-diffs` artifact of the run.
- Without Playwright's own Chromium, use `PW_CHANNEL=chrome` (or `msedge`). On PowerShell:
  `$env:PW_CHANNEL="chrome"`.

## Scripts

Run them in the project folder. Put arguments after `--`.

| Command | What it does |
|---|---|
| `npm run dev -- [model.arch3d\|.mmd\|.d2] [--port 5173] [--host] [--open]` | The app on http://localhost:5173. With a file you can edit it in the app and save it back. |
| `npm run build` | Production build in `dist/` (static files, see [DEPLOY.md](DEPLOY.md)) |
| `npm run preview` | Serve the production build on http://localhost:4173 |
| `npm run export -- [model.arch3d] [--cdn] [--out file.html]` | One offline HTML file. Default model `fixtures/northwind.arch3d`, default output `dist/archi3d-standalone.html`. `--cdn` first tries the layout engine from a CDN (not smaller, only for places that want that). |
| `npm run render -- <model> [options]` | A PNG of a model (`.arch3d`, `.mmd`, `.d2`) with headless Chrome. Options: `--out file.png`, `--view scene\|svg2d`, `--cam far\|mid\|near\|iso\|stack` (default iso), `--focus <Name> --k <n>`, `--width 1600 --height 1000 --scale 1`, `--edges ortho\|arc`, `--lod off\|on` (default off, everything open), `--zoom size`, `--bundle`, `--select <Name>` and `--panel`, `--theme light\|dark`, `--browser chromium\|chrome\|msedge`. Builds the app first if the sources changed. |
| `npm run generate -- [elements] [seed]` | A random test model `fixtures/gen-<elements>.arch3d` (default 1000 and 42). The same seed always gives the same model. |
| `npm test` | Unit tests |
| `npm run lint` | ESLint (also the rule that `src/core` must not import three.js) and TypeScript |
| `npm run test:visual` | Build, export, then the screenshot tests (Playwright) |
| `npm run test:visual:update` | The same, but takes the new pictures as reference |
| `npm run vscode:build` / `npm run vscode:package` | Build the VS Code extension in `vscode/dist/` / also make `vscode/archi3d-<version>.vsix` |
| `npm run vscode:publish -- --publisher <id>` | Checks, packages and publishes the extension ([RELEASE.md](RELEASE.md)) |
| `npm run test:vscode` | Runs the extension in a real VS Code with a temporary profile (`VSCODE_BIN` can point to VS Code) |
| `npm run icon` | Makes `vscode/icon.png` again from the icon design |
| `npm run notices` | Writes the third party license files again (after changing dependencies) |
| `npm run vendor` | Copies the pinned libraries and fonts to `vendor/` with SHA-256 hashes |
| `npm run offline:pack` | Fills `offline/npm-cache` so `npm ci --offline` works without internet |

## URL parameters

App (`index.html`, or the root of the dev server):

| Parameter | What it does |
|---|---|
| `fixture=<name>` | Start with a bundled model: `northwind`, `nested-deep`, `tiny`, `kinds`, `layers`, `colours`, `gen-1000`... |
| `editor=0` | Start with the editor hidden |
| `test=1` | Test mode: no animation, `window.__archi` for the tests |

Harness (`harness.html`, one view per page, for screenshots and debugging):

| Parameter | Values |
|---|---|
| `view` | `parse` (source and syntax tree), `model` (tables), `svg2d` (2D layout), `proj` (top and side view), `scene` (3D) |
| `fixture` | as above, and also `errors/bad-line`, `adapters/northwind.mmd`, `adapters/northwind.d2` |
| `cam` | `far`, `mid`, `near`, `iso`, `stack`, or `focus` with `focus=<name>&k=<distance in footprint diagonals>` |
| `edges` | `ortho`, `arc` |
| `gap` | space between levels (default 60) |
| `lod=off`, `bundle=on`, `select=<name>`, `theme=dark`, `font=<url>` | what the name says |
| `colorby=layer`, `container` or `tag` | colour by group, with the legend |
| `zoom=size`, `detail=1.5` | the first zoom rule; more or less detail |

Example: `http://localhost:5173/harness.html?view=scene&fixture=nested-deep&cam=iso&edges=arc`

## The VS Code extension

```sh
npm run vscode:build      # vscode/dist/ (extension, preview, export template)
npm run vscode:package    # also vscode/archi3d-<version>.vsix
code --install-extension vscode/archi3d-<version>.vsix
npm run test:vscode       # opens VS Code with a temporary profile in test-results/,
                          # runs tests/vscode/runner.cjs and saves pictures in artifacts/vscode/
```

To debug: open the `vscode/` folder in VS Code and press `F5` (Run Extension), or run
`code --extensionDevelopmentPath="$PWD/vscode" examples`. How to publish a version is in
[RELEASE.md](RELEASE.md).

## The pictures in the docs

The example pictures and the tutorial pictures are made with the render command. Run these again
after a change to the view:

```sh
npm run render -- examples/3-systems/android-app.arch3d
npm run render -- examples/3-systems/android-app.arch3d --view svg2d --out examples/3-systems/android-app-2d.png --width 1800 --height 1100
npm run render -- examples/3-systems/aosp-camera.arch3d --cam far --lod on
npm run render -- examples/3-systems/aosp-camera.arch3d --out examples/3-systems/aosp-camera-hal.png --focus HAL --k 1.8 --select CameraDeviceHal --panel
npm run render -- examples/3-systems/aosp-camera.arch3d --view svg2d --out examples/3-systems/aosp-camera-2d.png --width 1800 --height 1100
npm run render -- examples/3-systems/linux-desktop.arch3d --focus UserSpace --k 0.75 --select PipeWire --panel
npm run render -- examples/2-basics/legend.arch3d --focus Device --k 1.35
npm run render -- examples/3-systems/aosp-layers.arch3d --cam far --lod on
npm run render -- examples/3-systems/aosp-layers.arch3d --focus NativeLayer --k 1.1 --lod on --select CameraService --panel --out examples/3-systems/aosp-layers-native.png
npm run render -- examples/2-basics/colours.arch3d --cam iso
npm run render -- examples/2-basics/colours.arch3d --cam iso --theme dark --out examples/2-basics/colours-dark.png
npm run render -- examples/1-tutorial/1-elements.arch3d --cam iso --width 1200 --height 720 --out docs/images/tutorial-1-elements.png
npm run render -- examples/1-tutorial/2-containers.arch3d --cam iso --width 1200 --height 720 --out docs/images/tutorial-2-containers.png
npm run render -- examples/1-tutorial/3-ports-and-kinds.arch3d --cam iso --lod on --width 1200 --height 720 --out docs/images/tutorial-3-ports-and-kinds.png
npm run render -- examples/1-tutorial/4-layers.arch3d --cam far --lod on --width 1200 --height 720 --out docs/images/tutorial-4-layers.png
npm run render -- examples/1-tutorial/5-colours.arch3d --cam far --lod on --width 1200 --height 720 --out docs/images/tutorial-5-colours.png
```

The models in `examples/` and `examples/1-tutorial/` are checked by the unit tests: no errors, no
warnings.

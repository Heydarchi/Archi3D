# Archi3D user guide

Archi3D turns a short text description of a software system — its components, their
interfaces (ports) and the links between them — into a 3D view you can orbit, zoom into
and click through. Containers (systems, domains, services groups…) are stacked as levels,
so the nesting is visible at a glance.

- [1. Quick start](#1-quick-start)
- [2. The app](#2-the-app)
- [3. Writing models — the `.arch3d` language](#3-writing-models--the-arch-language)
- [4. Examples](#4-examples)
- [5. Importing Mermaid and D2](#5-importing-mermaid-and-d2)
- [6. Sharing: the single offline HTML file](#6-sharing-the-single-offline-html-file)
- [7. Script reference](#7-script-reference)
- [8. URL parameters](#8-url-parameters)
- [9. Windows (WSL / Ubuntu)](#9-windows-wsl--ubuntu)
- [10. VS Code extension](#10-vs-code-extension)
- [11. Troubleshooting](#11-troubleshooting)

---

## 1. Quick start

You need **Node.js 20 or newer**. In the project folder:

```sh
npm ci                     # or, with no internet: npm ci --offline --cache offline/npm-cache
npm run dev                # then open http://localhost:5173
```

The app opens with an example model (`northwind`). Edit the text on the left; the 3D view on
the right follows about 0.3 s after you stop typing.

To work on **your own file**, give it to `npm run dev`:

```sh
npm run dev -- my-system.arch3d      # opens it in the editor; Save writes it back
```

See [Editing a file on disk](#editing-a-file-on-disk).

To make a file you can email or double-click:

```sh
npm run export -- examples/03-containers.arch3d --out shop.html
```

---

## 2. The app

```
┌──────────── editor ────────────┬────────────────── 3D view ───────────────────┐
│ northwind.arch3d  Import…  1 err │       [Bundling] [Semantic zoom] [Edges]     │
│  1 # Northwind Shop            │                                              │
│  2 external Customer out: …    │             plates, blocks, links            │
│  …                             │                                              │
│                                │ ┌ info panel ┐                               │
│                                │ │ All › Shop │                               │
└────────────────────────────────┴─┴────────────┴───────────────────────────────┘
```

On narrow screens (phones) the editor moves to a sheet at the bottom.

### Editor

| Action | How |
|---|---|
| Errors and warnings | Underlined red/amber; hover for the message. The count is shown top right. |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on macOS) |
| Indent | `Tab` |
| Open another file | **Import…** (`.arch3d`, Mermaid `.mmd`, D2 `.d2`) |

Mistakes never stop the view: everything that is valid is still drawn while you type.

### Editing a file on disk

```sh
npm run dev -- path/to/my-system.arch3d          # also: --port 5174, --host, --open
```

- The editor shows the file. **Save** (button, or `Ctrl+S` / `Cmd+S`) writes it back.
  A `●` before the name means there are unsaved changes; closing the tab then asks first.
- A file that does not exist yet starts from a small example and is created on the first save.
- **Edit it anywhere else too** (VS Code, vim, `git pull`): when the file changes on disk the app
  reloads it and keeps your camera. If you also have unsaved edits, a bar asks whether to
  **use the disk version** or **keep yours** — nothing is overwritten silently. A save is refused
  if the file changed since you opened it, with the same choice.
- **Mermaid (`.mmd`) or D2 (`.d2`)** files open converted to `.arch3d`; Save writes
  `my-system.arch3d` next to them and never changes the original.
- Only the file named on the command line can be read or written, and only through the dev server
  on your machine (it listens on `localhost` unless you add `--host`).

### 3D view

| Action | Mouse | Touch |
|---|---|---|
| Orbit | drag with the left button | one finger |
| Pan | drag with the right button | two fingers |
| Zoom (towards the cursor) | scroll wheel | pinch |
| Select | click a block or plate | tap |
| Fly in | double-click | double-tap |
| Back out | click **All** (or a parent) in the info panel's breadcrumb | |
| Clear selection | click empty ground | |

**What you see**

- **Plates** are containers; each nesting level sits one storey higher.
- **Blocks** are components: boxes, cylinders for databases, low boxes for queues, light
  translucent boxes for externals/actors.
- **Ports**: teal = provided (`in`), red = required (`out`).
- **Links**: solid = synchronous (`->`), dashed = asynchronous (`=>`), arrowheads at the target.

**Selecting** lights the element and its direct links in orange and fades everything else.
For a container, the links that cross its border are lit. The info panel shows the kind,
ports, what it *depends on* and what *uses* it.

**Buttons (top right)**

| Button | Effect |
|---|---|
| Semantic zoom: on/off | On: far away, containers close into lids and their inner links are drawn as one arc per pair of containers; they open as you get closer, and port and link labels appear only when there is room. Off: everything open. |
| Edges: ortho/arc | Right-angled cables or arcs. |
| Bundling: off/on | Links between closed containers follow the nesting tree and bundle together (hierarchical edge bundling). The selected element's links are never bundled. |

---

## 3. Writing models — the `.arch3d` language

One statement per line. `#` or `//` starts a comment. Full grammar: [GRAMMAR.md](GRAMMAR.md).

Model files use the extension **`.arch3d`** (chosen to be unique, so editors and other tools don't
mistake them for something else). Files with the older `.arch` extension still open and save in the
app and the command-line tools; the VS Code extension only claims `.arch3d` — rename old files with
`git mv model.arch model.arch3d`.

### Components

```
kind Name [in: port, port…] [out: port, port…]
```

- **kind** chooses the shape only: `database`/`db` → cylinder, `queue` → low box,
  `external`/`actor` → translucent box, anything else (`component`, `service`, `ui`, …) → box.
- **Name**: letters, digits, `_`, `-`; must be unique in the whole file.
- **in** ports are interfaces the component *provides* (drawn on its west side);
  **out** ports are interfaces it *requires* (east side).
- A port may carry an interface type: `in: orders:REST`.

### Containers

```
system Shop {          # any kind word; "{" at the end of the line opens it
  service Orders
  container Backend {  # containers nest
    database OrderDB
  }
}                      # "}" closes the innermost one
```

### Links

```
From[.port] -> To[.port] [: label]     # synchronous call
From[.port] => To[.port] [: label]     # asynchronous message/event (dashed)
From[.port] <- To[.port] [: label]     # same as To -> From
```

- Leave out the port and the first port of the right direction is used; if there is none,
  an anonymous one is created.
- A port named in a link but not declared is created for you.
- Links may point at containers: `Frontend -> Backend : REST`.
- Links refer to names, never paths: `OrderDB`, not `Shop.Backend.OrderDB`.

### Messages you may see

| Code | Meaning |
|---|---|
| E001 | The line is not a statement (typo, stray symbol) |
| E002 | `}` without an open container |
| E003 | A container is never closed (reported where it opens) |
| E101 | A name is defined twice |
| E102 | A link uses an unknown name |
| E103 | A component links to itself |
| W201 | Both ports are typed and the types differ |
| W202 | An `in` port used as a link source, or an `out` port as a target |
| W301 | (Import) a Mermaid line that is not supported was skipped |

---

## 4. Examples

All of these are in [`examples/`](../examples) and are checked by the unit tests.

**Hello** — [`examples/01-hello.arch3d`](../examples/01-hello.arch3d)

```
ui       Web
service  Api
database Store

Web -> Api : HTTPS
Api -> Store
```

**Ports and interface types** — [`examples/02-ports.arch3d`](../examples/02-ports.arch3d)

```
ui      Web       out: api:REST
service Api       in: api:REST, admin   out: db:SQL, events
database Store    in: db:SQL
queue   Events    in: publish   out: deliver
service Mailer    in: send

Web.api     -> Api.api
Api.db      -> Store.db
Api.events  => Events.publish : UserSignedUp   # asynchronous
Events.deliver => Mailer.send
```

**Nesting** — [`examples/03-containers.arch3d`](../examples/03-containers.arch3d)

```
external Customer   out: browse

system Shop {
  container Frontend {
    ui Web            in: browse   out: api
  }
  container Backend {
    service Orders    in: api      out: db, pay
    database OrderDB  in: db
  }
}

external Payments   in: charge

Customer.browse -> Web.browse
Web.api         -> Orders.api   : REST
Orders.db       -> OrderDB.db
Orders.pay      -> Payments.charge
```

**Links to containers, reversed arrows** — [`examples/04-container-links.arch3d`](../examples/04-container-links.arch3d)

```
container Mobile   { … }
container Platform { … }
Mobile -> Platform : HTTPS
App <- Push : notifications     # means Push -> App
```

**An Android app** — [`examples/06-android-app.arch3d`](../examples/06-android-app.arch3d):
UI layer (Activity, Fragments, ViewModel) → domain use cases → data layer (Repository, Room,
Retrofit, a WorkManager sync worker, an FCM push service), plus the platform services and the
backend it talks to. `StateFlow` updates, WorkManager jobs and push messages are asynchronous (`=>`).

```
system NotesApp {
  container UiLayer {
    ui MainActivity             in: touch          out: nav
    component NotesViewModel    in: state          out: list, save
    …
  }
  container DataLayer {
    component NotesRepository   in: notes          out: local, remote
    database RoomDatabase       in: dao:SQL
    service RetrofitClient      in: call           out: https:REST
    …
  }
}
SaveNoteUseCase.sync  => WorkManager.schedule : OneTimeWorkRequest
RetrofitClient.https  -> NotesBackend.api
```

![Android app, 2D layout](../examples/06-android-app-2d.png)

**AOSP components interacting** — [`examples/07-aosp-camera.arch3d`](../examples/07-aosp-camera.arch3d):
one camera preview through the whole platform. The app calls `CameraManager` (framework), Binder
carries `connectDevice()` to `CameraService` in the native `cameraserver` process (after a lookup in
`ServiceManager` and a permission check in `system_server`), which drives the camera HAL
(`ICameraProvider`/device session over AIDL) and the kernel V4L2 driver and sensor. Frames come back
as callbacks and buffers through `BufferQueue`/`Gralloc` to the app's `Surface`, while
`SurfaceFlinger` composes the screen through `HWComposer` and the display driver. Binder/HAL calls
are `->`; callbacks and buffer flows are `=>`; interface types (`:AIDL`) are checked between ports.

```
system NativeServices {
  container cameraserver {
    service CameraService   in: connect:AIDL   out: hal:AIDL, permission:AIDL, cb
    service Camera3Device   in: submit:AIDL    out: hal:AIDL, buffers
  }
  …
}
CameraManager.binder  -> CameraService.connect    : connectDevice()
CameraService.hal     -> CameraProvider.provider  : getCameraDeviceInterface
Camera3Device.hal     -> CameraDeviceHal.session  : processCaptureRequest
CameraDeviceHal.ioctl -> V4L2Driver.ioctl         : VIDIOC_QBUF
Camera3Device.buffers => BufferQueue.produce      : queueBuffer
```

| Whole stack, far (semantic zoom: one arc per pair of layers) | The HAL up close, `CameraDeviceHal` selected |
|---|---|
| ![AOSP far](../examples/07-aosp-camera.png) | ![AOSP HAL](../examples/07-aosp-camera-hal.png) |

The full routing in 2D: ![AOSP 2D](../examples/07-aosp-camera-2d.png)

These pictures were made with the render command (section 7):

```sh
npm run render -- examples/07-aosp-camera.arch3d --cam far --lod on
npm run render -- examples/07-aosp-camera.arch3d --out examples/07-aosp-camera-hal.png --focus HAL --k 1.8 --select CameraDeviceHal --panel
npm run render -- examples/07-aosp-camera.arch3d --view svg2d --out examples/07-aosp-camera-2d.png --width 1800 --height 1100
```

Bigger models: [`fixtures/northwind.arch3d`](../fixtures/northwind.arch3d) (a web shop),
[`fixtures/nested-deep.arch3d`](../fixtures/nested-deep.arch3d) (four levels) and
`fixtures/gen-1000.arch3d` (1,000 generated components — open the app with `?fixture=gen-1000`).

---

## 5. Importing Mermaid and D2

Click **Import…** and choose a file. The format is detected from the extension (`.arch3d`,
`.mmd`/`.mermaid`, `.d2`) or, for other names, from the first line (`architecture-beta`).
The file is converted to `.arch3d` text in the editor, so you can keep editing it.

**Mermaid `architecture-beta`** ([`examples/05-mermaid.mmd`](../examples/05-mermaid.mmd)):

```
architecture-beta
    group shop(cloud)[Shop]
    service web(internet)[Web] in shop
    service api(server)[API] in shop
    service db(database)[Database] in shop
    web:R --> L:api
    api:R --> L:db
```

- `group` → container, `service` → component; the icon picks the kind
  (`database`/`disk` → database, `internet` → external, `server`/`cloud` → service).
- Edge sides (`L R T B`) become ports on those sides. `--`, `-->`, `<--`, `<-->` are accepted.
- `junction`, `title` and anything else are skipped with a W301 warning.

**D2** ([`fixtures/adapters/northwind.d2`](../fixtures/adapters/northwind.d2)): nested
objects become containers; `shape: cylinder` → database, `queue` → queue, `person` → actor;
dashed connections (`style.stroke-dash`) become asynchronous links. The D2 compiler is large
(~8 MB) and is loaded only when you import a `.d2` file. It is not available in the single
offline file.

---

## 6. Sharing: the single offline HTML file

```sh
npm run export -- my-model.arch3d --out my-model.html
```

`my-model.html` contains everything (≈ 2.6 MB): the app, the layout engine, the font and your
model. It needs no server and no internet — double-click it, attach it to an email, put it on
a USB stick. Readers can edit the model in it too (changes are not saved back to the file).

- Only `.arch3d` models can be embedded (import Mermaid/D2 in the app first, then copy the text).
- `--cdn` makes a variant that first tries to load the layout engine from a CDN (3 s timeout)
  and falls back to the built-in copy. It is not smaller; it exists for environments that
  prefer CDN-served libraries.

---

## 7. Script reference

Run these in the project folder. Arguments go after `--`.

| Command | What it does |
|---|---|
| `npm run dev -- [model.arch3d\|.mmd\|.d2] [--port 5173] [--host] [--open]` | The app at http://localhost:5173. With a file: edit it in the app and save it back ([details](#editing-a-file-on-disk)). |
| `npm run build` | Production build into `dist/` (static files — see [DEPLOY.md](DEPLOY.md)) |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm run export -- [model.arch3d] [--cdn] [--out file.html]` | Single offline HTML file. Defaults: `fixtures/northwind.arch3d`, `dist/archi3d-standalone.html` (`…-cdn.html` with `--cdn`) |
| `npm run render -- <model> [options]` | Render a model (`.arch3d`, `.mmd`, `.d2`) to a PNG with headless Chrome. Options: `--out file.png`, `--view scene\|svg2d`, `--cam far\|mid\|near\|iso` (default iso), `--focus <Id> --k <n>`, `--width 1600 --height 1000 --scale 1`, `--edges ortho\|arc`, `--lod off\|on` (default off: everything open), `--bundle`, `--select <Id>` (+ `--panel` to show the info panel), `--theme light\|dark`, `--browser chromium\|chrome\|msedge`. Builds the app first if the sources changed. |
| `npm run generate -- [components] [seed]` | Write a random test model `fixtures/gen-<components>.arch3d` (defaults 1000, 42). The same seed always gives the same model. |
| `npm test` | Unit tests (Vitest, Node) |
| `npm run lint` | ESLint (including the "core must not import three.js" rule) and TypeScript |
| `npm run test:visual` | Build, export, then screenshot tests (Playwright). Set `PW_CHANNEL=chrome` (or `msedge`) to use an installed browser. Pictures for review land in `artifacts/step-N/`. |
| `npm run test:visual:update` | Same, but accept new reference images — only after looking at them |
| `npm run vscode:build` / `npm run vscode:package` | Build the VS Code extension into `vscode/dist/` / also make `vscode/archi3d-<version>.vsix` (section 10) |
| `npm run test:vscode` | Run the extension inside a real VS Code with a throw-away profile (needs VS Code installed; `VSCODE_BIN` to point at it) |
| `npm run vendor` | Copy pinned libraries and fonts into `vendor/` with SHA-256 hashes |
| `npm run offline:pack` | Fill `offline/npm-cache` so `npm ci --offline --cache offline/npm-cache` works with no internet |

---

## 8. URL parameters

**App** (`index.html`, or the dev server's root):

| Parameter | Effect |
|---|---|
| `fixture=<name>` | Start with a bundled model: `northwind`, `nested-deep`, `tiny`, `gen-1000`, … |
| `test=1` | Deterministic mode for tests (no animation; exposes `window.__archi`) |

**Harness** (`harness.html`, one view per page — handy for screenshots and debugging):

| Parameter | Values |
|---|---|
| `view` | `parse` (source + syntax tree), `model` (tables), `svg2d` (2D layout), `proj` (top/side projections), `scene` (3D) |
| `fixture` | as above, also `errors/bad-line`, `adapters/northwind.mmd`, `adapters/northwind.d2` |
| `cam` | `far`, `mid`, `near`, `iso`, or `focus` with `focus=<id>&k=<distance in footprint diagonals>` |
| `edges` | `ortho`, `arc` |
| `gap` | level spacing (default 60) |
| `lod=off`, `bundle=on`, `select=<id>`, `theme=dark`, `font=<url>` | as named |

Example: `http://localhost:5173/harness.html?view=scene&fixture=nested-deep&cam=iso&edges=arc`

---

## 9. Windows (WSL / Ubuntu)

Archi3D runs in WSL (Ubuntu on Windows) like on any Linux; the browser can be your normal
Windows browser.

```sh
# inside Ubuntu (WSL)
sudo apt update && sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
cd ~/archi3d            # keep the project in the Linux file system, not /mnt/c (much faster)
npm ci
npm run dev             # open http://localhost:5173 in Windows — WSL forwards localhost
```

**As a rendering tool** — PNG pictures from the command line (install the headless browser once:
`npx playwright install --with-deps chromium`):

```sh
npm run render -- ~/models/payments.arch3d --out ~/models/payments.png --cam iso
npm run render -- ~/models/payments.arch3d --view svg2d --theme dark
explorer.exe "$(wslpath -w ~/models/payments.png)"
```

…or a self-contained interactive viewer to open in Windows:

```sh
npm run export -- ~/models/payments.arch3d --out ~/models/payments.html
explorer.exe "$(wslpath -w ~/models/payments.html)"
```

To also run the screenshot tests in WSL, install Playwright's browser once:
`npx playwright install --with-deps chromium` (then run `npm run test:visual` without `PW_CHANNEL`).

---

## 10. VS Code extension

A live 3D preview inside VS Code, next to the file you are editing.

**Install**

```sh
npm run vscode:package                       # → vscode/archi3d-0.1.0.vsix
code --install-extension vscode/archi3d-0.1.0.vsix
```

(or in VS Code: *Extensions* view → `…` menu → *Install from VSIX…*). On WSL, run VS Code on
Windows with the *WSL* extension and install the `.vsix` into the WSL side when asked.

**Use**

| What | How |
|---|---|
| Open the preview | Open a `.arch3d` or Mermaid `.mmd` file → the preview button in the editor title, `Ctrl+K V` (`Cmd+K V`), or *Archi3D: Open 3D Preview to the Side* |
| Live update | Just type — the preview follows ~0.3 s later and keeps your camera; switching to another model file re-frames |
| Jump to the definition | Click a block in the preview; double-click flies in |
| Errors and warnings | Squiggles in the editor and entries in the *Problems* panel (codes as in section 3) |
| Save a picture | *Archi3D: Save 3D Preview as PNG…* (exactly what the preview shows, at screen resolution) |
| Share | *Archi3D: Export Standalone HTML…* — the same single offline file as `npm run export` |
| Buttons in the preview | Semantic zoom, edge style, bundling, *Fit* |

The preview follows VS Code's light/dark theme. Everything works offline. Not yet supported in
VS Code: D2 files (use the app's Import), completion and go-to-definition.

**Develop / test the extension**

```sh
npm run vscode:build      # vscode/dist/ (extension, preview, export template)
npm run test:vscode       # opens VS Code with a throw-away profile under test-results/,
                          # runs tests/vscode/runner.cjs, saves what the preview drew to artifacts/vscode/
```

To debug: open the `vscode/` folder in VS Code and press `F5` (*Run Extension*), or run
`code --extensionDevelopmentPath="$PWD/vscode" examples`.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Labels appear in a plain font and the console says "using HTML labels" | The label font could not be loaded; the view switched to HTML labels on purpose. Check that `vendor/fonts/` and the build's `assets/` are served. |
| Blank 3D view | The browser has WebGL disabled. Check `chrome://gpu`; on servers/VMs start Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader`. |
| "Laying out…" stays for a long time | Very large models take a few seconds (1,000 components ≈ 1 s on a laptop). |
| D2 import fails in the offline file | Expected: the D2 compiler is only in the full app. |
| `npm ci --offline` fails | Run `npm run offline:pack` once while online. |
| Visual tests: "Executable doesn't exist" | Set `PW_CHANNEL=chrome` (or `msedge`), or run `npx playwright install chromium`. |

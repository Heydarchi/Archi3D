# Archi3D user guide

With Archi3D you write your system in a small text file: components, their ports (interfaces)
and the links between them. Archi3D shows it as a 3D view that you can rotate, zoom and click.
Containers (systems, domains, groups...) are drawn as levels on top of each other, so you can see
how things are nested.

- [1. Getting started](#1-getting-started)
- [2. The app](#2-the-app)
- [3. The language](#3-the-language)
- [4. Examples](#4-examples)
- [5. Import Mermaid and D2](#5-import-mermaid-and-d2)
- [6. One offline HTML file](#6-one-offline-html-file)
- [7. Scripts](#7-scripts)
- [8. URL parameters](#8-url-parameters)
- [9. Windows (WSL / Ubuntu)](#9-windows-wsl--ubuntu)
- [10. VS Code extension](#10-vs-code-extension)
- [11. Problems and fixes](#11-problems-and-fixes)

---

## 1. Getting started

You need Node.js 20 or newer. In the project folder:

```sh
npm ci                     # without internet: npm ci --offline --cache offline/npm-cache
npm run dev                # then open http://localhost:5173
```

The app starts with an example model (`northwind`). Change the text on the left, the 3D view on
the right updates about 0.3 seconds after you stop typing.

To work on your own file, give it to `npm run dev`:

```sh
npm run dev -- my-system.arch3d      # opens it in the editor, Save writes it back
```

More about this in [Edit a file on disk](#edit-a-file-on-disk).

To make one file that you can send by email or just double click:

```sh
npm run export -- examples/03-containers.arch3d --out shop.html
```

---

## 2. The app

```
┌───────────── editor ─────────────┬───────────────── 3D view ──────────────────┐
│ northwind.arch3d  Import…  1 err │      [Bundling] [Semantic zoom] [Edges]     │
│  1 # Northwind Shop              │                                             │
│  2 external Customer out: …      │            plates, blocks, links            │
│  …                               │                                             │
│                                  │ ┌ info panel ┐                              │
│                                  │ │ All › Shop │                              │
└──────────────────────────────────┴─┴────────────┴─────────────────────────────┘
```

On small screens (phones) the editor goes to the bottom.

### Editor

| What | How |
|---|---|
| Errors and warnings | Red or yellow underline, move the mouse over it to see the message. The count is on the top right. |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on Mac) |
| Indent | `Tab` |
| Open another file | Import... (`.arch3d`, Mermaid `.mmd`, D2 `.d2`) |

A mistake doesn't stop the view. Everything that is valid is still drawn while you type.

### Edit a file on disk

```sh
npm run dev -- path/to/my-system.arch3d          # also possible: --port 5174, --host, --open
```

- The editor shows the file. Save (the button, or `Ctrl+S` / `Cmd+S`) writes it back.
  A `●` before the name means you have unsaved changes. If you close the tab, it asks first.
- If the file doesn't exist yet, it starts with a small example and the first save creates it.
- You can change the file somewhere else at the same time (VS Code, vim, `git pull`). When it changes
  on disk, the app loads it again and keeps your camera. If you also have unsaved changes, it asks
  you: use the disk version or keep yours. It never overwrites anything without asking. Saving is
  also refused if the file was changed after you opened it, and you get the same question.
- Mermaid (`.mmd`) or D2 (`.d2`) files are converted to `.arch3d` when they open. Save writes
  `my-system.arch3d` next to them, the original file is not changed.
- Only the file you gave on the command line can be read or written, and only through the dev
  server on your own machine. It listens on `localhost`, unless you add `--host`.

### 3D view

| What | Mouse | Touch |
|---|---|---|
| Rotate | drag with the left button | one finger |
| Move | drag with the right button | two fingers |
| Zoom (to the mouse position) | scroll wheel | pinch |
| Select | click on a block or plate | tap |
| Fly in | double click | double tap |
| Go back | click All (or a parent) in the breadcrumb of the info panel | |
| Clear the selection | click on the empty ground | |

What you see:

- Plates are containers. Every nesting level is one floor higher.
- Blocks are components: boxes, cylinders for databases, flat boxes for queues and light,
  half transparent boxes for externals and actors.
- Ports: teal is provided (`in`), red is required (`out`).
- Links: solid line is synchronous (`->`), dashed is asynchronous (`=>`). The arrow is at the target.

When you select something, it and its direct links become orange and the rest fades out. For a
container, the links that cross its border are shown. The info panel shows the kind, the ports,
what it depends on and what uses it.

Buttons on the top right:

| Button | What it does |
|---|---|
| Semantic zoom: on/off | On: from far away the containers close (you see a box) and the links inside them are drawn as one arc between two containers. They open when you come closer. Port and link labels only show when there is enough space. Off: everything open. |
| Edges: ortho/arc | Links with right angles, or as arcs. |
| Bundling: off/on | Links between closed containers follow the nesting tree and are bundled together (hierarchical edge bundling). Links of the selected element are not bundled. |

---

## 3. The language

One statement per line. `#` or `//` starts a comment. The full grammar is in [GRAMMAR.md](GRAMMAR.md).

The files use the extension `.arch3d`. I picked this name because no other tool uses it, so editors
don't confuse it with something else. Old files with `.arch` still work in the app and the command
line tools, but the VS Code extension only knows `.arch3d`. To rename: `git mv model.arch model.arch3d`.

### Components

```
kind Name [in: port, port…] [out: port, port…]
```

- `kind` only decides the shape: `database` or `db` is a cylinder, `queue` a flat box,
  `external` or `actor` a transparent box, everything else (`component`, `service`, `ui`...) a box.
- `Name`: letters, numbers, `_` and `-`. It must be unique in the file.
- `in` ports are what the component provides (drawn on the left side), `out` ports are what it
  needs (right side).
- A port can have a type: `in: orders:REST`.

### Containers

```
system Shop {          # any word as kind, "{" at the end opens the container
  service Orders
  container Backend {  # containers can be nested
    database OrderDB
  }
}                      # "}" closes the last opened one
```

### Links

```
From[.port] -> To[.port] [: label]     # synchronous call
From[.port] => To[.port] [: label]     # asynchronous message or event (dashed)
From[.port] <- To[.port] [: label]     # same as To -> From
```

- If you leave out the port, the first port with the right direction is used. If there is none,
  a port without a name is created.
- If you use a port in a link that is not declared, it is created for you.
- Links can go to containers too: `Frontend -> Backend : REST`.
- Links use names, not paths: `OrderDB`, not `Shop.Backend.OrderDB`.

### Messages

| Code | Meaning |
|---|---|
| E001 | The line is not a valid statement (typo, a wrong character) |
| E002 | `}` but no container is open |
| E003 | A container is never closed (shown on the line where it starts) |
| E101 | A name is defined twice |
| E102 | A link uses a name that doesn't exist |
| E103 | A component links to itself |
| W201 | Both ports have a type and the types are different |
| W202 | An `in` port is used as link source, or an `out` port as target |
| W301 | (Import) a Mermaid line that is not supported was skipped |

---

## 4. Examples

All of them are in [`examples/`](../examples). The unit tests check that they have no errors.

Hello: [`examples/01-hello.arch3d`](../examples/01-hello.arch3d)

```
ui       Web
service  Api
database Store

Web -> Api : HTTPS
Api -> Store
```

Ports and types: [`examples/02-ports.arch3d`](../examples/02-ports.arch3d)

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

Nesting: [`examples/03-containers.arch3d`](../examples/03-containers.arch3d)

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

Links to containers and the reverse arrow: [`examples/04-container-links.arch3d`](../examples/04-container-links.arch3d)

```
container Mobile   { … }
container Platform { … }
Mobile -> Platform : HTTPS
App <- Push : notifications     # means Push -> App
```

### Android app

[`examples/06-android-app.arch3d`](../examples/06-android-app.arch3d): the UI layer (Activity,
Fragments, ViewModel), then the use cases, then the data layer (Repository, Room, Retrofit, a
WorkManager sync worker, an FCM push service), plus the platform services and the backend.
`StateFlow` updates, WorkManager jobs and push messages are asynchronous (`=>`).

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

### AOSP camera stack

[`examples/07-aosp-camera.arch3d`](../examples/07-aosp-camera.arch3d) follows one camera preview
through the whole platform. The app calls `CameraManager` in the framework. Binder sends
`connectDevice()` to `CameraService` in the native `cameraserver` process. Before that there is a
lookup in `ServiceManager` and a permission check in `system_server`. `CameraService` talks to the
camera HAL (`ICameraProvider` and the device session, over AIDL) and the HAL talks to the V4L2
kernel driver and the sensor. The frames come back as callbacks and buffers through
`BufferQueue` and `Gralloc` to the `Surface` of the app, and `SurfaceFlinger` puts them on the
screen with `HWComposer` and the display driver. Binder and HAL calls are `->`, callbacks and
buffers are `=>`. The port types (`:AIDL`) are checked between the ports.

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

| The whole stack from far (one arc between two layers) | The HAL from close, `CameraDeviceHal` selected |
|---|---|
| ![AOSP far](../examples/07-aosp-camera.png) | ![AOSP HAL](../examples/07-aosp-camera-hal.png) |

All the links in 2D: ![AOSP 2D](../examples/07-aosp-camera-2d.png)

I made these pictures with the render command (section 7):

```sh
npm run render -- examples/07-aosp-camera.arch3d --cam far --lod on
npm run render -- examples/07-aosp-camera.arch3d --out examples/07-aosp-camera-hal.png --focus HAL --k 1.8 --select CameraDeviceHal --panel
npm run render -- examples/07-aosp-camera.arch3d --view svg2d --out examples/07-aosp-camera-2d.png --width 1800 --height 1100
```

Bigger models: [`fixtures/northwind.arch3d`](../fixtures/northwind.arch3d) (a web shop),
[`fixtures/nested-deep.arch3d`](../fixtures/nested-deep.arch3d) (four levels) and
`fixtures/gen-1000.arch3d` (1000 generated components, open the app with `?fixture=gen-1000`).

---

## 5. Import Mermaid and D2

Click Import... and pick a file. The format comes from the extension (`.arch3d`, `.mmd`/`.mermaid`,
`.d2`). For other names it looks at the first line (`architecture-beta`). The file is converted to
`.arch3d` text in the editor, so you can continue editing it.

Mermaid `architecture-beta` ([`examples/05-mermaid.mmd`](../examples/05-mermaid.mmd)):

```
architecture-beta
    group shop(cloud)[Shop]
    service web(internet)[Web] in shop
    service api(server)[API] in shop
    service db(database)[Database] in shop
    web:R --> L:api
    api:R --> L:db
```

- `group` becomes a container and `service` a component. The icon decides the kind:
  `database`/`disk` is a database, `internet` an external, `server`/`cloud` a service.
- The sides of a link (`L R T B`) become ports on that side. `--`, `-->`, `<--` and `<-->` work.
- `junction`, `title` and other lines are skipped with a W301 warning.

D2 ([`fixtures/adapters/northwind.d2`](../fixtures/adapters/northwind.d2)): nested objects
become containers. `shape: cylinder` is a database, `queue` a queue and `person` an actor. Dashed
connections (`style.stroke-dash`) become asynchronous links. The D2 compiler is big (about 8 MB),
so it is only loaded when you import a `.d2` file. It is not in the offline HTML file.

---

## 6. One offline HTML file

```sh
npm run export -- my-model.arch3d --out my-model.html
```

`my-model.html` has everything inside (about 2.6 MB): the app, the layout engine, the font and your
model. It doesn't need a server or internet. You can double click it, send it by email or put it on
a USB stick. People can also edit the model in it, but the changes are not saved to the file.

- Only `.arch3d` models can go inside. For Mermaid or D2, import them in the app first and copy the text.
- `--cdn` makes a version that tries to load the layout engine from a CDN first (3 seconds timeout)
  and uses the built in copy if that fails. It is not smaller. It is only for places that prefer
  libraries from a CDN.

---

## 7. Scripts

Run them in the project folder. Put arguments after `--`.

| Command | What it does |
|---|---|
| `npm run dev -- [model.arch3d\|.mmd\|.d2] [--port 5173] [--host] [--open]` | The app on http://localhost:5173. With a file you can edit it in the app and save it back ([more](#edit-a-file-on-disk)). |
| `npm run build` | Production build in `dist/` (static files, see [DEPLOY.md](DEPLOY.md)) |
| `npm run preview` | Serve the production build on http://localhost:4173 |
| `npm run export -- [model.arch3d] [--cdn] [--out file.html]` | One offline HTML file. Default model `fixtures/northwind.arch3d`, default output `dist/archi3d-standalone.html` (`…-cdn.html` with `--cdn`) |
| `npm run render -- <model> [options]` | Make a PNG of a model (`.arch3d`, `.mmd`, `.d2`) with headless Chrome. Options: `--out file.png`, `--view scene\|svg2d`, `--cam far\|mid\|near\|iso` (default iso), `--focus <Id> --k <n>`, `--width 1600 --height 1000 --scale 1`, `--edges ortho\|arc`, `--lod off\|on` (default off, everything open), `--bundle`, `--select <Id>` (and `--panel` to show the info panel), `--theme light\|dark`, `--browser chromium\|chrome\|msedge`. If the sources changed it builds the app first. |
| `npm run generate -- [components] [seed]` | Make a random test model `fixtures/gen-<components>.arch3d` (default 1000 and 42). The same seed gives always the same model. |
| `npm test` | Unit tests (Vitest, Node) |
| `npm run lint` | ESLint (also the rule that core must not import three.js) and TypeScript |
| `npm run test:visual` | Build, export, then the screenshot tests (Playwright). Use `PW_CHANNEL=chrome` (or `msedge`) for your installed browser. The pictures to check are in `artifacts/step-N/`. |
| `npm run test:visual:update` | Same, but takes the new pictures as reference. Only do this after you checked them. |
| `npm run vscode:build` / `npm run vscode:package` | Build the VS Code extension in `vscode/dist/` / also make `vscode/archi3d-<version>.vsix` (section 10) |
| `npm run vscode:publish -- --publisher <id>` | Checks, packages and publishes the extension ([RELEASE.md](RELEASE.md)) |
| `npm run test:vscode` | Runs the extension in a real VS Code with a temporary profile (VS Code must be installed, `VSCODE_BIN` can point to it) |
| `npm run icon` | Makes `vscode/icon.png` again from the icon design |
| `npm run notices` | Writes the third party license files again (after changing dependencies) |
| `npm run vendor` | Copies the pinned libraries and fonts to `vendor/` with SHA-256 hashes |
| `npm run offline:pack` | Fills `offline/npm-cache` so `npm ci --offline --cache offline/npm-cache` works without internet |

---

## 8. URL parameters

App (`index.html`, or the root of the dev server):

| Parameter | What it does |
|---|---|
| `fixture=<name>` | Start with one of the bundled models: `northwind`, `nested-deep`, `tiny`, `gen-1000`, ... |
| `test=1` | Test mode (no animation, `window.__archi` for the tests) |

Harness (`harness.html`, one view per page, useful for screenshots and debugging):

| Parameter | Values |
|---|---|
| `view` | `parse` (source and syntax tree), `model` (tables), `svg2d` (2D layout), `proj` (top and side view), `scene` (3D) |
| `fixture` | like above, and also `errors/bad-line`, `adapters/northwind.mmd`, `adapters/northwind.d2` |
| `cam` | `far`, `mid`, `near`, `iso`, or `focus` with `focus=<id>&k=<distance in footprint diagonals>` |
| `edges` | `ortho`, `arc` |
| `gap` | space between levels (default 60) |
| `lod=off`, `bundle=on`, `select=<id>`, `theme=dark`, `font=<url>` | what the name says |

Example: `http://localhost:5173/harness.html?view=scene&fixture=nested-deep&cam=iso&edges=arc`

---

## 9. Windows (WSL / Ubuntu)

Archi3D works in WSL (Ubuntu on Windows) like on any Linux. You can use your normal Windows browser.

```sh
# inside Ubuntu (WSL)
sudo apt update && sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
cd ~/archi3d            # keep the project in the Linux file system, not in /mnt/c (much faster)
npm ci
npm run dev             # open http://localhost:5173 in Windows, WSL forwards localhost
```

As a render tool, to make PNG pictures from the command line (install the headless browser once:
`npx playwright install --with-deps chromium`):

```sh
npm run render -- ~/models/payments.arch3d --out ~/models/payments.png --cam iso
npm run render -- ~/models/payments.arch3d --view svg2d --theme dark
explorer.exe "$(wslpath -w ~/models/payments.png)"
```

Or one HTML file that you can open in Windows and click around:

```sh
npm run export -- ~/models/payments.arch3d --out ~/models/payments.html
explorer.exe "$(wslpath -w ~/models/payments.html)"
```

For the screenshot tests in WSL, install Playwright's browser once with
`npx playwright install --with-deps chromium` and run `npm run test:visual` without `PW_CHANNEL`.

---

## 10. VS Code extension

A 3D preview inside VS Code, next to the file you are editing.

Install:

```sh
npm run vscode:package                       # makes vscode/archi3d-0.1.0.vsix
code --install-extension vscode/archi3d-0.1.0.vsix
```

Or in VS Code: Extensions view, `…` menu, Install from VSIX. On WSL, run VS Code on Windows with
the WSL extension and install the `.vsix` on the WSL side when it asks.

Use:

| What | How |
|---|---|
| Open the preview | Open a `.arch3d` or Mermaid `.mmd` file, then the preview button in the editor title, `Ctrl+K V` (`Cmd+K V`) or "Archi3D: Open 3D Preview to the Side" |
| Live update | Just type. The preview updates after about 0.3 seconds and keeps the camera. When you switch to another model file it frames the new one. |
| Go to the definition | Click a block in the preview, double click to fly in |
| Errors and warnings | In the editor and in the Problems panel (same codes as in section 3) |
| Save a picture | "Archi3D: Save 3D Preview as PNG..." (what you see in the preview, in screen resolution) |
| Share | "Archi3D: Export Standalone HTML...", the same offline file as `npm run export` |
| Buttons in the preview | Semantic zoom, edge style, bundling, Fit |

The preview uses the light or dark theme of VS Code. Everything works offline. Not supported in
VS Code yet: D2 files (use Import in the app), completion and go to definition.

Develop and test the extension:

```sh
npm run vscode:build      # vscode/dist/ (extension, preview, export template)
npm run test:vscode       # opens VS Code with a temporary profile in test-results/,
                          # runs tests/vscode/runner.cjs and saves the preview pictures in artifacts/vscode/
```

To debug: open the `vscode/` folder in VS Code and press `F5` (Run Extension), or run
`code --extensionDevelopmentPath="$PWD/vscode" examples`.

How to publish a new version is in [RELEASE.md](RELEASE.md).

---

## 11. Problems and fixes

| Problem | Fix |
|---|---|
| The labels have a plain font and the console says "using HTML labels" | The label font couldn't be loaded, so it uses HTML labels. Check that `vendor/fonts/` and `assets/` of the build are served. |
| The 3D view is empty | WebGL is off in the browser. Check `chrome://gpu`. On servers or VMs start Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader`. |
| "Laying out..." takes long | Very big models need a few seconds (1000 components take about 1 second on a laptop). |
| D2 import doesn't work in the offline file | That's expected, the D2 compiler is only in the full app. |
| `npm ci --offline` fails | Run `npm run offline:pack` once while you are online. |
| Visual tests say "Executable doesn't exist" | Set `PW_CHANNEL=chrome` (or `msedge`), or run `npx playwright install chromium`. |

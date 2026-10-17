# Archi3D for VS Code

Live 3D preview of software architecture models while you type.

![The AOSP camera stack with CameraDeviceHal selected](images/hal-selected.png)

- **Open 3D Preview to the Side** — the editor title button, `Ctrl+K V` (`Cmd+K V` on macOS), or the
  command palette. The preview follows the document as you type and keeps the camera where you left it.
- **Click a block** to jump to where it is defined; double-click to fly in.
- **Problems** — parse and model errors/warnings for `.arch3d` and Mermaid `architecture-beta` (`.mmd`) files
  show up as squiggles and in the Problems panel.
- **Save 3D Preview as PNG…** and **Export Standalone HTML…** (one file that works offline).
- Syntax colouring for `.arch3d`.

Works offline: everything, including the layout engine and the font, ships inside the extension.

D2 files are not previewed yet (use the Archi3D app's Import).

Example models (an Android app, the AOSP camera stack, …) and the language guide:
https://github.com/Heydarchi/Archi3D

License: MIT. Third-party licences: `THIRD_PARTY_NOTICES.md`.

![The preview in a dark theme](images/preview-dark.png)

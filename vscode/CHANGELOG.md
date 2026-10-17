# Changelog

## 0.2.0 (2026-10-17)

- Six link kinds: `->` call, `=>` message, `~>` event, `<=>` session, `>>` stream, `<>` shared.
  Each one has its own line style. Words work too: `A event B`.
- Several targets in one line: `A ~> B, C : label`.
- Element keywords with their own 3D shape: user, ui, app, service, library, driver, kernel, device,
  database, cache, storage, queue, topic, external.
- Optional title after the name, shown as the label: `driver V4L2 "V4L2 camera driver"`.
- Syntax colors for the new arrows, link words and titles.
- Mermaid `[Title]` is kept as the title, `<-->` is a session.

## 0.1.0 (2026-10-17)

First version.

- 3D preview for `.arch3d` and Mermaid `architecture-beta` (`.mmd`) files next to the editor.
- Click a block to go to its definition, double click to fly in.
- Errors and warnings in the editor and in the Problems panel.
- Save the preview as PNG, export one offline HTML file.
- Syntax colors for `.arch3d`.

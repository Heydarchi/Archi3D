# Archi3D keywords

All keywords of the `.arch3d` language. The full grammar is in [GRAMMAR.md](GRAMMAR.md).

| Keyword | Function | Category |
|---|---|---|
| `user` | A person (phone user, user at the shell). Drawn as a person on a base. | Element |
| `actor` | Same as `user`. | Element |
| `ui` | A screen: Activity, SystemUI, GTK window. Drawn as a monitor on a base. | Element |
| `app` | An app: APK, system app, desktop app. Drawn as a phone on a base. | Element |
| `service` | A service or daemon. Drawn as a box. | Element |
| `library` | A library: AAR, HAL implementation, `.so`. Drawn as stacked layers. | Element |
| `driver` | A kernel driver. Drawn as a chip. | Element |
| `kernel` | The kernel or a kernel subsystem. Drawn as a flat octagon. | Element |
| `device` | Hardware: sensor, modem, USB device. Drawn as a box on feet. | Element |
| `database` | A database: Room, SQLite, PostgreSQL. Drawn as a cylinder. | Element |
| `db` | Same as `database`. | Element |
| `cache` | A cache: LruCache, Redis. Drawn as a hexagon. | Element |
| `storage` | Files or a file system: `/sdcard`, block device. Drawn as stacked disks. | Element |
| `queue` | A message queue, Handler queue. Drawn as a low box. | Element |
| `topic` | Broadcasts, D-Bus signals, MQTT topic. Drawn as a pipe. | Element |
| `external` | Something outside your system: backend, remote host. Drawn as a see-through box. | Element |
| any other word (`component`, `system`, `container`, `group`, `domain`…) | A plain box, or a container when followed by `{`. | Element / container |
| `layer` | A top-level container drawn as its own floor. The first layer written is on top. | Container |
| `{` … `}` | Opens and closes a container. | Structure |
| `in:` | Ports the element provides (west side). | Ports |
| `out:` | Ports the element needs (east side). | Ports |
| `"Title"` | Label shown instead of the name. | Element attribute |
| `->` / `-->` / `call` | Call: ask and wait for the answer. Solid line. | Link kind |
| `=>` / `message` | Message: send and don't wait, one receiver. Dashed line. | Link kind |
| `~>` / `event` | Event: tell anyone who listens. Dotted line. | Link kind |
| `<=>` / `session` | Session: connection kept open both ways. Two lines, arrows at both ends. | Link kind |
| `>>` / `stream` | Stream: data that keeps flowing. Thick line with flow marks. | Link kind |
| `<>` / `shared` | Shared: both use the same memory or data. Wide band, squares at the ends. | Link kind |
| `<-` | A call written right to left: `A <- B` is `B -> A`. | Link kind |
| `,` (after a target) | Several targets: `A ~> B, C` is two links. | Link |
| `: label` | Text on a link. | Link |
| `[color: …]` | Colour of an element, container or link: `#rrggbb`, `#rgb` or a name. | Attribute |
| `[dark: …]` | Colour for the dark theme (otherwise the same as `color`). | Attribute |
| `[tag: …]` | A tag, can repeat. Used by `style tag` and "Colour by: tag". | Attribute |
| `style kind <kind> [...]` | Colour for every element of one kind. | Style |
| `style tag <tag> [...]` | Colour for every element with this tag. | Style |
| `style link <kind> [...]` | Colour for every link of one kind. | Style |
| `red`, `orange`, `amber`, `green`, `teal`, `blue`, `indigo`, `purple`, `pink`, `brown`, `slate`, `gray` | Named colours, tuned for light and dark themes. | Colour name |
| `#` / `//` | Comment to the end of the line (not inside quotes or `[ ]`). | Comment |


Note: the `[color: …]`, `[dark: …]`, `[tag: …]` and `style` rows describe the colours work, which is still on the `feat/colours` branch and not merged yet.
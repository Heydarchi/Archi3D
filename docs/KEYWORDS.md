# Archi3D keywords

All keywords of the `.arch3d` language on one page. How they fit together is in
[GRAMMAR.md](GRAMMAR.md).

## Elements

The first word of a line is the kind. It only decides the shape.

| Keyword | Example | Drawn as | Use it for |
|---|---|---|---|
| `user` (or `actor`) | `user User "Phone user"` | a person on a base | the phone user, a user at the shell |
| `ui` | `ui Settings` | a monitor on a base | Activity, SystemUI, a GTK window |
| `app` | `app Camera "Camera app"` | a phone on a base | an APK, a system app, a desktop app |
| `service` | `service CameraService` | a box | a Service, a daemon, a systemd unit |
| `library` | `library Hal "Camera HAL"` | stacked layers | an AAR, a HAL implementation, a `.so` |
| `driver` | `driver V4L2 "V4L2 driver"` | a chip | a kernel driver or module |
| `kernel` | `kernel Linux` | a flat octagon | the kernel, a kernel subsystem |
| `device` | `device Sensor "Image sensor"` | a box on feet | a sensor, a modem, a USB device |
| `database` (or `db`) | `database Orders` | a cylinder | Room, SQLite, PostgreSQL |
| `cache` | `cache Thumbs` | a hexagon | LruCache, Redis |
| `storage` | `storage Sdcard "/sdcard"` | stacked disks | files, a file system, a block device |
| `queue` | `queue Jobs` | a low box | a message queue, a Handler queue |
| `topic` | `topic Broadcasts` | a pipe | broadcasts, D-Bus signals, an MQTT topic |
| `external` | `external Cloud` | a see-through box | something outside your system |
| any other word | `component Parser`, `daemon Logd` | a plain box | anything else |

## Containers and layers

| Keyword | Example | Means |
|---|---|---|
| `{` … `}` | `system Shop {` … `}` | a line ending with `{` opens a container, `}` closes it. Any kind works: `system`, `container`, `group`, `domain`… |
| `layer` | `layer Kernel "Linux kernel" {` … `}` | a top-level container drawn as its own floor. The first layer in the file is on top |

## On an element

| Keyword | Example | Means |
|---|---|---|
| `"Title"` | `service Api "Orders API"` | the label shown instead of the name |
| `in:` | `in: connect, query:SQL` | ports the element provides (left side); `:SQL` is a type |
| `out:` | `out: hal, status` | ports the element needs (right side) |

## Links

| Keyword | Example | Means | Drawn as |
|---|---|---|---|
| `->` / `-->` / `call` | `App -> Api` | call: ask and wait for the answer | solid line |
| `=>` / `message` | `Api => Mailer` | message: send and don't wait, one receiver | dashed line |
| `~>` / `event` | `Bus ~> Mail` | event: tell anyone who listens | dotted line |
| `<=>` / `session` | `App <=> Service` | session: a connection kept open, both ways | two lines, arrows at both ends |
| `>>` / `stream` | `Sensor >> Driver` | stream: data that keeps flowing | thick line with flow marks |
| `<>` / `shared` | `Hal <> Gralloc` | shared: both use the same memory or data | wide band, squares at the ends |
| `<-` | `A <- B` | a call written right to left, the same as `B -> A` | solid line |
| `.port` | `Camera.open -> Service.connect` | a link from or to a port | |
| `,` | `Bus ~> Mail, Sync` | several targets, one link each | |
| `: label` | `App -> Api : REST` | text on the link | |

## Colours

| Keyword | Example | Means |
|---|---|---|
| `[color: …]` | `service Api [color: #2e7d6b]` | colour of an element, container or link: `#rrggbb`, `#rgb` or a name |
| `[dark: …]` | `[color: #dbe9f6, dark: #2a3d52]` | another colour for the dark theme |
| `[tag: …]` | `[tag: vendor, tag: camera]` | a tag, used by `style tag` and "Colour by: tag" |
| `style kind` | `style kind driver [color: slate]` | colour for every element of one kind |
| `style tag` | `style tag vendor [color: #e8871e]` | colour for every element with this tag |
| `style link` | `style link event [color: purple]` | colour for every link of one kind |
| colour names | `red`, `orange`, `amber`, `green`, `teal`, `blue`, `indigo`, `purple`, `pink`, `brown`, `slate`, `gray` | shortcuts that change with the light and dark theme |

On a link, `[ ]` comes after the targets and before the label: `A -> B [color: red] : alloc`.

## Comments

| Keyword | Example | Means |
|---|---|---|
| `#` | `# my notes` | a comment to the end of the line (not inside quotes or `[ ]`) |
| `//` | `// my notes` | the same |

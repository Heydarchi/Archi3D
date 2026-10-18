# The `.arch3d` language

A `.arch3d` file describes a system: its elements, how they are grouped and how they talk to
each other. Archi3D draws it in 3D.

This page is the reference. For a short list of all keywords see [KEYWORDS.md](KEYWORDS.md), for
how to use the app see the [user guide](USER_GUIDE.md).

## A whole file first

```
# Camera on a phone

style kind driver [color: slate]

user User "Phone user"

layer Apps "Applications" {
  app Camera "Camera app"           out: open
}
layer Platform {
  system CameraServer {
    service CameraService           in: connect   out: hal, status
  }
  library Hal "Camera HAL" [tag: vendor]  in: session
}
layer Kernel "Linux kernel" {
  driver V4L2 "V4L2 driver"         in: ioctl
}

User -> Camera : tap
Camera.open -> CameraService.connect : openCamera()
CameraService.status ~> Camera : onOpened
CameraService.hal <=> Hal.session : HAL session
Hal -> V4L2.ioctl [color: red] : VIDIOC_QBUF
```

Line by line:

| Line | What it is |
|---|---|
| `# Camera on a phone` | a comment |
| `style kind driver [color: slate]` | a style line: every `driver` is slate |
| `user User "Phone user"` | an element: kind `user`, name `User`, title `Phone user` |
| `layer Apps "Applications" {` | a layer (a floor); the first one is on top |
| `app Camera "Camera app"  out: open` | an element with one `out:` port called `open` |
| `system CameraServer {` | a container inside the layer |
| `library Hal "Camera HAL" [tag: vendor]` | an element with a tag |
| `}` | closes the last opened container or layer |
| `User -> Camera : tap` | a call from `User` to `Camera`, with the label `tap` |
| `Camera.open -> CameraService.connect` | a call from port `open` to port `connect` |
| `CameraService.status ~> Camera` | an event |
| `CameraService.hal <=> Hal.session` | a session |
| `Hal -> V4L2.ioctl [color: red] : VIDIOC_QBUF` | a call with its own colour and a label |

## The rules in short

- One statement per line. A line is one of six things: a comment, an element, a container, a `}`,
  a link or a style line. Empty lines are fine.
- Indentation doesn't matter. Indent containers so you can read them.
- Names are unique in the whole file. Links always use the name, never a path.
- Order doesn't matter: a link may come before the elements it uses.
- A mistake doesn't stop the drawing. A line that can't be read is skipped and marked, the rest
  is drawn.

## Comments

```
# a comment
// also a comment
service Api   # a comment after a statement
```

`#` or `//` starts a comment to the end of the line. Not inside a `"title"`, and not inside `[ ]`,
where `#` starts a colour like `#2e7d6b`.

## Elements

```
kind Name ["Title"] [[attributes]] [in: port, port ...] [out: port, port ...]
```

```
service  Api
database Orders "Order database"   in: sql
driver   V4L2 "V4L2 driver" [color: #2e7d6b]   in: ioctl   out: irq
```

- **kind** is the first word. It only decides the shape. The [element keywords](#element-keywords)
  below have their own shapes. Any other word works too and is drawn as a plain box, for example
  `component` or `daemon`.
- **Name** is letters, digits, `_` and `-`, starting with a letter or `_`: `Api`, `order-db`,
  `V4L2`.
- **Title** (optional) is text in double quotes, shown as the label instead of the name. Use it
  for long names with spaces: `"Order database"`. Write `\"` for a quote inside it.
- **Attributes** (optional) are in `[ ]`, see [Colours](#colours).
- **Ports** (optional) are the connection points. `in:` lists what the element provides (drawn on
  the left), `out:` what it needs (on the right). A port can have a type after a colon:
  `in: api:REST`. If two linked ports both have a type and the types differ, you get a warning.

## Containers

```
kind Name ["Title"] [[attributes]] [in: ...] [out: ...] {
  ...
}
```

```
system Shop {
  service Orders
  container Backend {
    database OrderDB
  }
}
```

- An element with `{` at the end of its line is a container. Anything can go inside, also other
  containers. Each level of nesting is drawn one step higher.
- `}` on its own line closes the last opened container. Nothing else may be on the line after `{`.
- Any word works as the kind of a container: `system`, `container`, `group`, `domain`... Only
  `layer` is special, see [Layers](#layers).

## Element keywords

A short list on purpose. The same words work for Android apps, AOSP and plain Linux.

| Keyword | Drawn as | Android app | AOSP | Linux |
|---|---|---|---|---|
| `user` (or `actor`) | a person | the phone user | the user, a developer with adb | a user at the shell |
| `ui` | a screen | Activity, Fragment, Compose screen | SystemUI, Settings | GTK or Qt window, terminal |
| `app` | a phone | the app (APK) | system apps: Camera, Launcher | desktop application |
| `service` | a box | Service, WorkManager worker | system_server services, native daemons | daemon, systemd unit |
| `library` | stacked layers | AAR, Jetpack library | HAL implementation, libbinder | shared library (`.so`) |
| `driver` | a chip | | kernel driver under a HAL | kernel module, device driver |
| `kernel` | a flat octagon | | Linux kernel, binder driver | kernel, a subsystem |
| `device` | a box on feet | sensor | camera sensor, modem | hardware, USB device |
| `database` (or `db`) | a cylinder | Room, SQLite | MediaProvider database | PostgreSQL, SQLite |
| `cache` | a hexagon | LruCache | thumbnail cache | Redis, page cache |
| `storage` | stacked disks | files, SharedPreferences | `/data`, `/sdcard` | file system, block device |
| `queue` | a low box | Handler and MessageQueue | Looper queue | message queue |
| `topic` | a pipe | broadcast, Flow | broadcast Intents, event log | D-Bus signals, MQTT topic |
| `external` | a see-through box | your backend server | a vendor part outside AOSP | a remote host |

## Links

```
From[.port] arrow To[.port] [, To[.port] ...] [[attributes]] [: label]
```

```
Web -> Api                                 # a call, ports picked for you
Web.api -> Api.http : REST                 # port to port, with a label
Api => Mailer : WelcomeMail                # a message
Bus ~> Mail, Sync, Audit : BOOT_COMPLETED  # one event, three links
Camera.bind <=> CameraService.aidl         # a session
Api event Bus                              # a word works instead of the arrow
```

- **Ports**: `Api.http` is the port `http` of `Api`. Without a port, the element's first port of
  the right side is used (an `out:` port for the sender, an `in:` port for the receiver). If it has
  none, an unnamed one is made. A port used in a link but not declared is made for you.
- **Several targets**: commas after the arrow make one link per target, all with the same kind,
  label and colour.
- **Label** (optional) is everything after the `:` to the end of the line.
- **Containers** can be linked too: `Frontend -> Backend : HTTPS`.
- `A <- B` is the same as `B -> A`. It takes one target only.
- A word can stand for the arrow, see the next table.

## Link kinds

Six kinds. Pick by how the two sides talk, not by the technology.

| Arrow | Word | Means | Drawn as | Android / AOSP | Linux |
|---|---|---|---|---|---|
| `->` (or `-->`) | `call` | ask and wait for the answer | solid line | method call, AIDL call, Binder transaction | function call, syscall, `ioctl`, D-Bus method |
| `=>` | `message` | send and don't wait, one receiver | dashed line | explicit Intent, `Handler.post`, `oneway` AIDL | message queue, socket send |
| `~>` | `event` | tell anyone who listens | dotted line | broadcast Intent, LiveData/Flow, callbacks | signal, uevent, D-Bus signal, inotify |
| `<=>` | `session` | a connection kept open, both ways | two thin lines, arrows at both ends | bound service (`bindService` + AIDL), HAL with callbacks | Unix socket, TCP connection |
| `>>` | `stream` | data that keeps flowing | thick line with flow marks | camera frames, audio, sensor data | pipe, V4L2 buffers, ALSA |
| `<>` | `shared` | both use the same memory or data | wide see-through band, squares at the ends | ashmem, gralloc buffers, a shared file | shared memory, `mmap` |

## Layers

```
layer Name ["Title"] {
  ...
}
```

```
layer Apps "Applications" {        # top floor
  system Apps { ... }
}
layer Framework "Java framework" {
  system Framework { ... }
  system SystemServer { ... }      # a floor can hold several systems
}
layer Kernel "Linux kernel" {      # bottom floor
  system Kernel { ... }
}
```

- A top-level container with the kind `layer` is a floor. The first layer in the file is the top
  floor, the next one is below it, and so on. To change the order, move the blocks.
- Keep your systems and containers as they are and put them inside layers. A layer only says
  where things stand in the stack.
- Links between floors go straight up or down.
- An element outside every layer (a `user`, a `device`) stands next to the floor it links to most.
- A `layer` must be at the top level and have `{ }`. Otherwise you get W203 and it is drawn as a
  normal container or element.

## Colours

There are three ways, from one element to many.

**One element, container or link**, with `[ ]` after the name or title (for a link: after the
targets, before the label):

```
driver V4L2 "V4L2 driver" [color: #2e7d6b]
system HAL [color: #fde7c8, dark: #3d3326] { ... }     # a container gets a tinted plate
CameraService -> Gralloc [color: red] : alloc
```

**Many at once**, with a `style` line:

```
style kind driver   [color: slate]      # every driver
style tag vendor    [color: #e8871e]    # everything with [tag: vendor]
style link event    [color: purple]     # every event link
```

**Without writing anything**: the Colour button in the app colours by layer, by top container or
by tag.

The attributes in `[ ]`, separated by commas:

| Attribute | Value | Means |
|---|---|---|
| `color` | `#rrggbb`, `#rgb` or a colour name | the colour |
| `dark` | the same | the colour in the dark theme (without it: the same as `color`) |
| `tag` | a name | a tag, can repeat: `[tag: vendor, tag: camera]` |

- A `#rrggbb` colour is used exactly as written, in the light and in the dark theme.
- The names change with the theme: `red`, `orange`, `amber`, `green`, `teal`, `blue`, `indigo`,
  `purple`, `pink`, `brown`, `slate`, `gray`.
- Which colour wins: the element's own, then a `style tag` (first tag first), then a `style kind`.
  For links: the link's own, then a `style link`.

## Messages

A message shows the line and the place. Errors skip the line, warnings keep it.

| Code | Kind | When | How to fix it |
|---|---|---|---|
| E001 | error | The line can't be read: a typo, a stray character, a title without its closing `"`, a `[` without `]`, a comma with nothing after it | Check the line against the forms on this page |
| E002 | error | `}` with no open container | Remove the `}` or add the missing `{` |
| E003 | error | A container is never closed (shown where it starts) | Add the `}` |
| E101 | error | A name is used twice | Rename one of them, names are for the whole file |
| E102 | error | A link uses a name that doesn't exist | Check the spelling, or add the element |
| E103 | error | An element links to itself | Remove the link |
| W201 | warning | Both ports of a link have a type and they differ | Make the types the same, or remove one |
| W202 | warning | An `in:` port is used as a sender, or an `out:` port as a receiver | Swap the link, or move the port to the other list |
| W203 | warning | A `layer` is inside a container or has no `{ }` | Put it at the top level with `{ }` |
| W204 | warning | An unknown attribute in `[ ]`, or a value that is not a colour | Use `color`, `dark` or `tag`, and `#rrggbb`, `#rgb` or a colour name |
| W301 | warning | (Mermaid import) a line that is not supported was skipped | Nothing to do, or draw that part in `.arch3d` |

The codes don't change between versions, so tools and tests can rely on them.

## For tool makers: the grammar (EBNF)

```
file       = { line } ;
line       = ws [ statement ] [ comment ] newline ;
statement  = close | node | edge | style ;
close      = "}" { ws "}" } ;
node       = kind ws name [ ws title ] [ ws attrs ] { ws portlist } [ ws "{" ] ;
title      = '"' { char except '"' and "\" | "\" char } '"' ;
attrs      = "[" [ attr { "," attr } ] "]" ;
attr       = ("color" | "dark") ":" colour | "tag" ":" ident ;
colour     = "#" hex hex hex [ hex hex hex ] | colourname ;
portlist   = ("in:" | "out:") ws port { ws? "," ws? port } ;
port       = ident [ ":" ident ] ;
edge       = ref ws? link ws? ref { ws? "," ws? ref } [ ws attrs ] [ ws ":" ws label ] ;
link       = arrow | ws linkword ws ;
arrow      = "->" | "-->" | "=>" | "~>" | "<=>" | ">>" | "<>" | "<-" ;
linkword   = "call" | "message" | "event" | "session" | "stream" | "shared" ;
style      = "style" ws ("kind" | "tag" | "link") ws ident ws attrs ;
ref        = ident [ "." ident ] ;
kind       = ident ;  name = ident ;
ident      = letter { letter | digit | "_" | "-" } ;
label      = { any character except newline } ;
comment    = ("#" | "//") { any character except newline } ;   (not inside quotes or [ ])
```

A node may be called like a link word: `service event in: x` declares an element named `event`.
A line `A event B` is a link.

## Not in the language yet

- Delegation: `port => Child.port` inside a container, to pass a container's interface through to
  the element that implements it.
- More attributes, for example `[team: payments]`.

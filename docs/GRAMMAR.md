# The `.arch3d` language (v1)

Files use the extension `.arch3d`. It is a small language, one statement per line, for elements,
their ports and the links between them. `#` or `//` starts a comment (not inside quotes).

## Statements

```
kind Name ["Title"] [in: port, port ...] [out: port, port ...]   # an element
kind Name ["Title"] [in: ...] [out: ...] {                       # a container (nests anything)
}                                                                # closes the innermost container
From[.port] arrow To[.port] [, To[.port] ...] [: label]          # a link (or several)
From[.port] word  To[.port] [, To[.port] ...] [: label]          # the same with a word
```

For example:

```
user     Person   "Phone user"
app      Camera   "Camera app"    out: bind
service  CamSvc   "CameraService" in: aidl
Person  -> Camera : tap
Camera.bind <=> CamSvc.aidl : AIDL
CamSvc  ~> Gallery, Thumbnails : NEW_PICTURE
```

- **kind** decides the shape only. See the keyword table below. Any other word is allowed and is
  drawn as a plain box, for example `component`, `system`, `container`, `group` or `domain`.
- **Name** is `[A-Za-z_][A-Za-z0-9_-]*` and must be unique in the whole file. Links refer to
  elements by name, never by path.
- **Title** is optional text in double quotes, shown as the label instead of the name. It may have
  spaces and `#`. Write `\"` for a quote and `\\` for a backslash. A title with no closing quote
  is an E001 error.
- **Ports** may carry an interface type: `in: http:REST, query:Search`. `in` is a provided
  interface (drawn on the west side), `out` is a required interface (east).
- **Links**: if a port is left out, the element's first port of the right direction is used. If it
  has none, an anonymous port is made. A port named in a link but not declared is made
  automatically (its direction comes from its side of the arrow).
- **Several targets**: `A ~> B, C, D : label` is three links with the same kind and label.
  `<-` reads right to left, so it takes only one target.
- Links may target containers (no ports): `Ordering -> Identity : auth`.

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

`A <- B` is the same as `B -> A`. `message`, `event` and `stream` count as async (the `async` flag
in the model). The word form is handy when you think in words: `App.x event Svc.y : DONE`.
A node may still be called like a link word: `service event in: x` declares an element named `event`.

## EBNF

```
file       = { line } ;
line       = ws [ statement ] [ comment ] newline ;
statement  = close | node | edge ;
close      = "}" { ws "}" } ;
node       = kind ws name [ ws title ] { ws portlist } [ ws "{" ] ;
title      = '"' { char except '"' and "\" | "\" char } '"' ;
portlist   = ("in:" | "out:") ws port { ws? "," ws? port } ;
port       = ident [ ":" ident ] ;
edge       = ref ws? link ws? ref { ws? "," ws? ref } [ ws ":" ws label ] ;
link       = arrow | ws linkword ws ;
arrow      = "->" | "-->" | "=>" | "~>" | "<=>" | ">>" | "<>" | "<-" ;
linkword   = "call" | "message" | "event" | "session" | "stream" | "shared" ;
ref        = ident [ "." ident ] ;
kind       = ident ;  name = ident ;
ident      = letter { letter | digit | "_" | "-" } ;
label      = { any character except newline } ;
comment    = ("#" | "//") { any character except newline } ;
```

## Diagnostics (stable codes, tests assert on them)

| Code | Severity | When |
|---|---|---|
| E001 | error | A line matches no statement (also: a title with no closing quote, a trailing comma) |
| E002 | error | `}` with no open container |
| E003 | error | Container not closed by end of file (reported on the line that opened it) |
| E101 | error | Name defined twice |
| E102 | error | Link refers to an unknown name |
| E103 | error | Link from a component to itself |
| W201 | warning | Both ends of a link have port types and they differ |
| W202 | warning | A port declared `in` is used as a link source, or `out` as a target |
| W301 | warning | Import adapters (Mermaid): a line the adapter does not support is skipped |

Every diagnostic carries `line` (1-based), `col` (1-based) and `endCol`.
Errors never stop parsing: the parser recovers at the next line and the model is
built from everything that is valid, so the 3D view keeps working while you type.

## Planned (not v1)

- Delegation: `port => Child.port` inside a container, to pass a container's
  interface through to the component that implements it.
- Tags and metadata: `component X [team: payments, tech: Go]`.
- Your own colours per element or kind.

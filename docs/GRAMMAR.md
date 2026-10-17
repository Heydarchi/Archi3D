# The `.arch3d` language (v1)

Files use the extension `.arch3d`. A deliberately tiny, line-based language for components, their interfaces (ports)
and the links between them. One statement per line. `#` or `//` starts a comment.

## Statements

```
kind Name [in: port, port ...] [out: port, port ...]       # a component
kind Name [in: ...] [out: ...] {                           # a container (nests anything)
}                                                          # closes the innermost container
From[.port] -> To[.port] [: label]                         # synchronous link (call)
From[.port] => To[.port] [: label]                         # asynchronous link (event/message)
From[.port] <- To[.port] [: label]                         # same as To -> From
```

- **kind** decides the shape only. Known kinds: `component`, `service`, `ui`,
  `database` (alias `db`), `queue`, `external` (alias `actor`), and any container
  word you like (`system`, `container`, `group`, `domain`...). Unknown kinds are
  allowed and drawn as plain boxes.
- **Name** is `[A-Za-z_][A-Za-z0-9_-]*` and must be unique in the whole file.
  Links refer to components by name, never by path.
- **Ports** may carry an interface type: `in: http:REST, query:Search`.
  `in` = provided interface (drawn on the west side), `out` = required interface (east).
- **Links**: if a port is omitted, the component's first port of the right
  direction is used; if it has none, an anonymous port is created. A port named in
  a link but not declared is created automatically (direction taken from its side
  of the arrow).
- Links may target containers (no ports): `Ordering -> Identity : auth`.

## EBNF

```
file       = { line } ;
line       = ws [ statement ] [ comment ] newline ;
statement  = close | node | edge ;
close      = "}" { ws "}" } ;
node       = kind ws name { ws portlist } [ ws "{" ] ;
portlist   = ("in:" | "out:") ws port { ws? "," ws? port } ;
port       = ident [ ":" ident ] ;
edge       = ref ws? arrow ws? ref [ ws ":" ws label ] ;
ref        = ident [ "." ident ] ;
arrow      = "->" | "-->" | "=>" | "<-" ;
kind       = ident ;  name = ident ;
ident      = letter { letter | digit | "_" | "-" } ;
label      = { any character except newline } ;
comment    = ("#" | "//") { any character except newline } ;
```

## Diagnostics (stable codes — tests assert on them)

| Code | Severity | When |
|---|---|---|
| E001 | error | A line matches no statement |
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

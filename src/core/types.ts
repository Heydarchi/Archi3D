// Contracts between the pipeline stages. See docs/ARCHITECTURE.md, always change both together.

// ---------- shared ----------
export type Id = string;                 // component or container name (unique per file)
export type PortId = `${Id}.${string}`;  // "OrderAPI.db"
export interface Loc { line: number; col: number; endCol: number }
export interface Diagnostic { code: string; severity: 'error' | 'warning'; message: string; loc: Loc }

// ---------- dsl ----------
/** Compass side of a port; unset = in ports west, out ports east (layout direction RIGHT). */
export type PortSide = 'N' | 'E' | 'S' | 'W';
export interface PortDecl { name: string; iface?: string; side?: PortSide; loc: Loc }
/** `[color: #2e7d6b, dark: #4fb3d9, tag: vendor]`: colours as written (hex or a name), tags in order. */
export interface Attrs { color?: string; dark?: string; tags?: string[]; loc: Loc }
export interface AstNode {
  type: 'node'; kind: string; name: string; title?: string; container: boolean; attrs?: Attrs;
  ins: PortDecl[]; outs: PortDecl[]; children: AstItem[]; loc: Loc;
}
export interface AstRef { name: string; port?: string; loc: Loc }
/**
 * How two elements talk. call: ask and wait. message: send one-way. event: announce to whoever
 * listens. session: long-lived connection, both sides talk. stream: continuous data one way.
 * shared: both use the same memory.
 */
export type LinkKind = 'call' | 'message' | 'event' | 'session' | 'stream' | 'shared';
/** async: the sender doesn't wait (message, event, stream). Kept for older code, use `kind`. */
export interface AstEdge { type: 'edge'; from: AstRef; to: AstRef; kind: LinkKind; async: boolean; label?: string; attrs?: Attrs; loc: Loc }
/** `style kind driver [color: …]`, `style tag vendor [...]`, `style link event [...]`: colours for many at once. */
export interface AstStyle { type: 'style'; target: 'kind' | 'tag' | 'link'; name: string; attrs: Attrs; loc: Loc }
export type AstItem = AstNode | AstEdge | AstStyle;
export interface ParseResult { items: AstItem[]; diagnostics: Diagnostic[] }

// ---------- model ----------
export type Shape =
  | 'box' | 'db' | 'queue' | 'ext'                       // service/component, database, queue, external
  | 'person' | 'screen' | 'phone'                         // user, ui, app
  | 'library' | 'chip' | 'kernel' | 'device'              // library, driver, kernel, device
  | 'cache' | 'storage' | 'topic';                        // cache, storage, topic
export interface Port { id: PortId; name: string; dir: 'in' | 'out'; iface?: string; side?: PortSide; implicit: boolean }
/** A resolved colour: `light` for the light theme, `dark` for the dark theme ("#rrggbb"). */
export interface ColorPair { light: string; dark: string }
export interface ModelNode {
  id: Id; kind: string; title?: string; shape: Shape; container: boolean; color?: ColorPair; tags?: string[];
  parent: Id | null; depth: number; children: Id[]; ports: Port[]; loc: Loc;
}
export interface ModelEdge {
  id: string;                               // "e0", "e1" in source order
  from: { node: Id; port?: PortId }; to: { node: Id; port?: PortId };
  kind: LinkKind; async: boolean; label?: string; lca: Id | null;   // lowest common container, null = top level
  color?: ColorPair;
}
export interface ArchModel { nodes: Record<Id, ModelNode>; roots: Id[]; edges: ModelEdge[]; diagnostics: Diagnostic[] }

// ---------- layout ----------
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }
export interface LayoutOptions { direction: 'RIGHT' | 'DOWN'; nodeSpacing: number; layerSpacing: number }
export interface Layout2D {
  boxes: Record<Id, Rect>;            // absolute, top-left origin
  ports: Record<PortId, Pt>;          // absolute port centres
  routes: Record<string, Pt[]>;       // edge id -> absolute polyline, first/last point on the ports
  bounds: Rect;
}

// ---------- scene ----------
export interface V3 { x: number; y: number; z: number }   // y is up
/** floor: the layer this stands on, when the model has layers. */
export interface PlateSpec { id: Id; depth: number; center: V3; size: V3; floor?: Id; color?: ColorPair }
export interface BlockSpec { id: Id; shape: Shape; center: V3; size: V3; floor?: Id; color?: ColorPair }
/** A layer drawn as a floor: from y (its base) up to top (where the next floor starts), first written on top. */
export interface FloorSpec { id: Id; index: number; y: number; top: number; center: V3; size: V3 }
export interface PortSpec  { id: PortId; owner: Id; dir: 'in' | 'out'; pos: V3 }
export interface EdgeSpec  { id: string; points: V3[]; kind: LinkKind; async: boolean; label?: string; labelAt?: V3; color?: ColorPair }
/** alt: a second place for a container title, used when the first one would cover another label. */
export interface LabelSpec { id: string; text: string; anchor: V3; alt?: V3; role: 'container' | 'component' | 'port' | 'edge' }
export interface SceneOptions { levelGap: number; blockHeight: number; edgeMode: 'ortho' | 'arc' }
export interface SceneSpec {
  plates: PlateSpec[]; blocks: BlockSpec[]; ports: PortSpec[]; edges: EdgeSpec[]; labels: LabelSpec[];
  bounds: { min: V3; max: V3 };
  /** Only when the model has layers (top-level containers of kind "layer"). */
  floors?: FloorSpec[];
}

// ---------- lod (semantic zoom) ----------
/** aspect = viewport width / height (optional; < 1 means width limits what fits). */
export interface CameraState { position: V3; target: V3; fovDeg: number; viewportH: number; aspect?: number }
export type ContainerState = 'open' | 'closed' | 'hidden';
export interface LodResult {
  containers: Record<Id, ContainerState>;
  visibleLabels: Set<string>;
  visibleEdges: Set<string>;
  /** Container titles moved to their `alt` place for this camera. */
  movedLabels?: Record<string, V3>;
  /** Floors above the one you look at, faded out so they don't cover it. */
  fadedFloors?: Set<Id>;
}

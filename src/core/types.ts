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
export interface AstNode {
  type: 'node'; kind: string; name: string; container: boolean;
  ins: PortDecl[]; outs: PortDecl[]; children: AstItem[]; loc: Loc;
}
export interface AstRef { name: string; port?: string; loc: Loc }
export interface AstEdge { type: 'edge'; from: AstRef; to: AstRef; async: boolean; label?: string; loc: Loc }
export type AstItem = AstNode | AstEdge;
export interface ParseResult { items: AstItem[]; diagnostics: Diagnostic[] }

// ---------- model ----------
export type Shape = 'box' | 'db' | 'queue' | 'ext';
export interface Port { id: PortId; name: string; dir: 'in' | 'out'; iface?: string; side?: PortSide; implicit: boolean }
export interface ModelNode {
  id: Id; kind: string; shape: Shape; container: boolean;
  parent: Id | null; depth: number; children: Id[]; ports: Port[]; loc: Loc;
}
export interface ModelEdge {
  id: string;                               // "e0", "e1" in source order
  from: { node: Id; port?: PortId }; to: { node: Id; port?: PortId };
  async: boolean; label?: string; lca: Id | null;   // lowest common container, null = top level
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
export interface PlateSpec { id: Id; depth: number; center: V3; size: V3 }
export interface BlockSpec { id: Id; shape: Shape; center: V3; size: V3 }
export interface PortSpec  { id: PortId; owner: Id; dir: 'in' | 'out'; pos: V3 }
export interface EdgeSpec  { id: string; points: V3[]; async: boolean; label?: string; labelAt?: V3 }
export interface LabelSpec { id: string; text: string; anchor: V3; role: 'container' | 'component' | 'port' | 'edge' }
export interface SceneOptions { levelGap: number; blockHeight: number; edgeMode: 'ortho' | 'arc' }
export interface SceneSpec {
  plates: PlateSpec[]; blocks: BlockSpec[]; ports: PortSpec[]; edges: EdgeSpec[]; labels: LabelSpec[];
  bounds: { min: V3; max: V3 };
}

// ---------- lod (semantic zoom) ----------
/** aspect = viewport width / height (optional; < 1 means width limits what fits). */
export interface CameraState { position: V3; target: V3; fovDeg: number; viewportH: number; aspect?: number }
export type ContainerState = 'open' | 'closed' | 'hidden';
export interface LodResult {
  containers: Record<Id, ContainerState>;
  visibleLabels: Set<string>;
  visibleEdges: Set<string>;
}

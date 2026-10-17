// ArchModel → ELK graph (layered, left to right, hierarchical, orthogonal routes).
import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api';
import type { ArchModel, Id, Layout2D, LayoutOptions, ModelNode } from '../types';
import { CONTAINER_PADDING, PORT_SIZE, componentSize } from './size';

export const ROOT_ID = '__root';

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = { direction: 'RIGHT', nodeSpacing: 44, layerSpacing: 70 };

const padding = (p: typeof CONTAINER_PADDING) => `[top=${p.top},left=${p.left},bottom=${p.bottom},right=${p.right}]`;

const SIDES = { N: 'NORTH', E: 'EAST', S: 'SOUTH', W: 'WEST' } as const;

const ports = (n: ModelNode, opts: LayoutOptions): ElkPort[] =>
  n.ports.map((p) => ({
    id: p.id, width: PORT_SIZE, height: PORT_SIZE,
    layoutOptions: {
      'elk.port.side': p.side ? SIDES[p.side]
        : p.dir === 'in' ? (opts.direction === 'RIGHT' ? 'WEST' : 'NORTH') : (opts.direction === 'RIGHT' ? 'EAST' : 'SOUTH'),
    },
  }));

/**
 * `previous` (the last layout of an earlier version of the text) is passed to ELK as position
 * hints with semi-interactive crossing minimisation, so an edit moves as little as possible.
 */
export function toElk(model: ArchModel, options: Partial<LayoutOptions> = {}, previous?: Layout2D): ElkNode {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const hint = (id: Id): { x?: number; y?: number } => {
    const b = previous?.boxes[id];
    if (!b) return {};
    const parent = model.nodes[id].parent;
    const pb = parent ? previous?.boxes[parent] : { x: 0, y: 0 };
    return pb ? { x: b.x - pb.x, y: b.y - pb.y } : {};
  };
  const node = (id: Id): ElkNode => ({ ...hint(id), ...nodeBody(id) });
  const nodeBody = (id: Id): ElkNode => {
    const n = model.nodes[id];
    if (n.container) {
      return {
        id,
        ports: ports(n, opts),
        layoutOptions: { 'elk.padding': padding(CONTAINER_PADDING), 'elk.portConstraints': 'FIXED_SIDE' },
        children: n.children.map(node),
      };
    }
    return { id, ...componentSize(n), ports: ports(n, opts), layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' } };
  };
  const edges: ElkExtendedEdge[] = model.edges.map((e) => ({
    id: e.id,
    sources: [e.from.port ?? e.from.node],
    targets: [e.to.port ?? e.to.node],
  }));
  return {
    id: ROOT_ID,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': opts.direction,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
      'elk.spacing.nodeNode': String(opts.nodeSpacing),
      'elk.layered.spacing.edgeNodeBetweenLayers': '24',
      'elk.spacing.edgeEdge': '14',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.randomSeed': '1',
      // Keep source order where possible: an edit then moves as little as possible. (On every
      // container this crashes elkjs 0.9.3; on the root it applies to the whole hierarchy.)
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.padding': '[top=30,left=30,bottom=30,right=30]',
      ...(previous ? { 'elk.layered.crossingMinimization.semiInteractive': 'true' } : {}),
    },
    children: model.roots.map(node),
    edges,
  };
}

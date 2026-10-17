// Component box size from its name length and port count (as in the prototype).
import type { ModelNode } from '../types';

export const PORT_SIZE = 10;
export const CONTAINER_PADDING = { top: 46, left: 26, bottom: 26, right: 26 };

export function componentSize(n: ModelNode): { width: number; height: number } {
  const named = (dir: 'in' | 'out') => n.ports.filter((p) => p.dir === dir && !p.name.startsWith('_')).length;
  const portCount = Math.max(named('in'), named('out'), 1);
  return {
    width: Math.max(120, n.id.length * 9 + 44),
    height: Math.max(64, portCount * 24 + 24),
  };
}

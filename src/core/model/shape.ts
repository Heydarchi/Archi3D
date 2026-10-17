import type { Shape } from '../types';

const SHAPES: Record<string, Shape> = { database: 'db', db: 'db', queue: 'queue', external: 'ext', actor: 'ext' };

/** The kind decides the shape only; unknown kinds are plain boxes. */
export const shapeOf = (kind: string): Shape => SHAPES[kind.toLowerCase()] ?? 'box';

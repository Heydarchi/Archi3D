import type { Shape } from '../types';

// A short list on purpose. The same words work for Android, AOSP and Linux (see docs/GRAMMAR.md).
const SHAPES: Record<string, Shape> = {
  user: 'person', actor: 'person',
  ui: 'screen', app: 'phone', library: 'library', driver: 'chip', kernel: 'kernel', device: 'device',
  database: 'db', db: 'db', cache: 'cache', storage: 'storage',
  queue: 'queue', topic: 'topic', external: 'ext',
};

/** The kind decides the shape only; unknown kinds are plain boxes. */
export const shapeOf = (kind: string): Shape => SHAPES[kind.toLowerCase()] ?? 'box';

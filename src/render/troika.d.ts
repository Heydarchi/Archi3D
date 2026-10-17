// The parts of troika-three-text this project uses (its shipped types don't model Text as a Mesh).
declare module 'troika-three-text' {
  import type { Mesh } from 'three';
  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: number | string;
    anchorX: number | 'left' | 'center' | 'right';
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom';
    outlineWidth: number | string;
    outlineColor: number | string;
    outlineOpacity: number;
    fillOpacity: number;
    sdfGlyphSize: number;
    sync(callback?: () => void): void;
    dispose(): void;
  }
  export function preloadFont(opts: { font?: string; characters?: string | string[]; sdfGlyphSize?: number }, callback: () => void): void;
  export function configureTextBuilder(config: { useWorker?: boolean; unicodeFontsURL?: string | null; sdfGlyphSize?: number }): void;
}

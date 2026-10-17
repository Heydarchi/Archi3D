// All colours in one place so light and dark themes are a single swap.
export interface Palette {
  background: number; grid: number; ink: number;
  plates: number[]; plateOpacity: number;
  block: Record<'box' | 'db' | 'queue' | 'ext', number>; outline: number;
  in: number; out: number; edge: number; accent: number;
  label: { container: string; component: string; port: string; edge: string; halo: string };
}

export const LIGHT: Palette = {
  background: 0xeef1f5, grid: 0xd5dce4, ink: 0x1f2933,
  plates: [0xb9c7d2, 0xcad6de, 0xd8e1e7, 0xe3eaef], plateOpacity: 0.92,
  block: { box: 0xf4f6f7, db: 0xd6e4ef, queue: 0xefe3cc, ext: 0xe6e1ee }, outline: 0x7b8a97,
  in: 0x14a3a3, out: 0xd64545, edge: 0x3e5568, accent: 0xe8871e,
  label: { container: '#334e68', component: '#1f2933', port: '#52606d', edge: '#3e5568', halo: '#eef1f5' },
};

export const DARK: Palette = {
  background: 0x141b21, grid: 0x26313a, ink: 0xe4e7eb,
  plates: [0x1d2932, 0x24323c, 0x2c3c47, 0x344652], plateOpacity: 0.92,
  block: { box: 0x2a3640, db: 0x233544, queue: 0x3a3326, ext: 0x302a3c }, outline: 0x6f8291,
  in: 0x2bc0c0, out: 0xef6b6b, edge: 0x9fb3c8, accent: 0xf0a04b,
  label: { container: '#bcccdc', component: '#e4e7eb', port: '#9aa5b1', edge: '#9fb3c8', halo: '#141b21' },
};

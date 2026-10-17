// All fixtures bundled at build time (no runtime fetch), keyed like "northwind", "errors/bad-line"
// or "adapters/northwind.mmd" (non-.arch files keep their extension).
const files = import.meta.glob('/fixtures/**/*.{arch,mmd,d2}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const fixtures: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.replace(/^\/fixtures\//, '').replace(/\.arch$/, ''), text]),
);

export function getFixture(name: string): string {
  const src = fixtures[name];
  if (src === undefined) throw new Error(`Unknown fixture "${name}". Known: ${Object.keys(fixtures).join(', ')}`);
  return src;
}

export const defaultFixture = 'northwind';

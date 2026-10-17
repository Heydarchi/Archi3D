// D2 is a large WASM compiler: loaded only when a .d2 file is imported.
import type { D2Diagram } from '../core/adapters/d2';

export async function compileD2(text: string): Promise<D2Diagram> {
  const { D2 } = await import('@terrastruct/d2');
  const { diagram } = await new D2().compile(text);
  return diagram as unknown as D2Diagram;
}

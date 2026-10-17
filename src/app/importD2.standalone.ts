// The single-file export leaves the D2 compiler out (it alone is ~8 MB).
import type { D2Diagram } from '../core/adapters/d2';

export async function compileD2(_text: string): Promise<D2Diagram> {
  throw new Error('D2 import is not included in the standalone file; use the full app.');
}

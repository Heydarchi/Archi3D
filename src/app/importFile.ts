// Import: any supported format → .arch text for the editor (plus the adapter's warnings).
import { fromD2Diagram } from '../core/adapters/d2';
import { detectFormat, type SourceFormat } from '../core/adapters/detect';
import { fromMermaid } from '../core/adapters/mermaid';
import { printArch } from '../core/dsl/print';
import type { ArchModel, Diagnostic } from '../core/types';
import { compileD2 } from './importD2';

export interface Imported { format: SourceFormat; source: string; warnings: Diagnostic[] }

export async function modelFromText(name: string, text: string): Promise<{ format: SourceFormat; model: ArchModel | null }> {
  const format = detectFormat(name, text);
  if (format === 'mermaid') return { format, model: fromMermaid(text) };
  if (format === 'd2') return { format, model: fromD2Diagram(await compileD2(text)) };
  return { format, model: null };
}

export async function importText(name: string, text: string): Promise<Imported> {
  const { format, model } = await modelFromText(name, text);
  if (!model) return { format, source: text, warnings: [] };
  return {
    format,
    source: printArch(model, `Imported from ${name} (${format === 'mermaid' ? 'Mermaid architecture-beta' : 'D2'})`),
    warnings: model.diagnostics,
  };
}

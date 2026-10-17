// Which reader to use for a file: by extension, then by its first meaningful line.
export type SourceFormat = 'arch' | 'mermaid' | 'd2';

export function detectFormat(fileName: string, text: string): SourceFormat {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === 'arch') return 'arch';
  if (ext === 'mmd' || ext === 'mermaid') return 'mermaid';
  if (ext === 'd2') return 'd2';
  const first = text.split(/\r?\n/).map((l) => l.replace(/%%.*$/, '').trim()).find(Boolean) ?? '';
  return first === 'architecture-beta' ? 'mermaid' : 'arch';
}

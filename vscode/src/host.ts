// The extension's logic that does not need VS Code: reading a document into a model,
// the webview page, and filling the standalone-HTML template. Unit-tested in Node.
import { detectFormat, type SourceFormat } from '../../src/core/adapters/detect';
import { fromMermaid } from '../../src/core/adapters/mermaid';
import { parse } from '../../src/core/dsl/parse';
import { printArch } from '../../src/core/dsl/print';
import { buildModel } from '../../src/core/model/build';
import type { Diagnostic, Loc } from '../../src/core/types';

export const SOURCE_PLACEHOLDER = '__ARCHI3D_SOURCE_PLACEHOLDER__';
export const NAME_PLACEHOLDER = '__ARCHI3D_NAME_PLACEHOLDER__';

export interface Analysis {
  format: SourceFormat;
  /** .arch3d text for the preview (Mermaid is converted). */
  archText: string;
  diagnostics: Diagnostic[];
  /** Where each component/container is defined in the document. */
  locations: Record<string, Loc>;
  /** Set when the format cannot be previewed here. */
  unsupported?: string;
}

export function analyze(fileName: string, text: string): Analysis {
  const format = detectFormat(fileName, text);
  if (format === 'd2') {
    return { format, archText: '', diagnostics: [], locations: {}, unsupported: 'D2 files are not previewed in VS Code yet — import them in the Archi3D app.' };
  }
  const model = format === 'mermaid' ? fromMermaid(text) : buildModel(parse(text));
  const locations = Object.fromEntries(Object.values(model.nodes).map((n) => [n.id, n.loc]));
  return { format, archText: format === 'mermaid' ? printArch(model) : text, diagnostics: model.diagnostics, locations };
}

export const isModelFile = (fileName: string, languageId: string): boolean =>
  languageId === 'arch3d' || /\.(arch3d|mmd|mermaid)$/i.test(fileName);

/** The webview page: one script from the extension, a strict CSP, workers from blob: URLs. */
export function previewHtml(o: { cspSource: string; scriptUri: string; nonce: string; title: string }): string {
  const csp = [
    "default-src 'none'",
    // blob: for worker code the page itself creates (troika text, layout); importScripts needs it.
    `script-src 'nonce-${o.nonce}' blob:`,
    `style-src ${o.cspSource} 'unsafe-inline'`,
    `img-src ${o.cspSource} data: blob:`,
    `font-src ${o.cspSource} data:`,
    'worker-src blob:',
    `connect-src ${o.cspSource} data: blob:`,
  ].join('; ');
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
</head>
<body>
<script nonce="${o.nonce}" src="${esc(o.scriptUri)}"></script>
</body>
</html>`;
}

/** Put a model into the prebuilt standalone page (built with placeholder strings). */
export function fillTemplate(template: string, name: string, source: string): string {
  const literal = (s: string) => JSON.stringify(s).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const put = (html: string, token: string, value: string) => {
    const re = new RegExp(`(["'\`])${token}\\1`, 'g');
    const hits = html.match(re)?.length ?? 0;
    if (hits !== 1) throw new Error(`The export template is damaged (${token} found ${hits} times).`);
    return html.replace(re, () => literal(value));
  };
  return put(put(template, SOURCE_PLACEHOLDER, source), NAME_PLACEHOLDER, name);
}

export function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

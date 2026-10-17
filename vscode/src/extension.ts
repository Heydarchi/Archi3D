// Archi3D for VS Code: live 3D preview, problems for .arch/.mmd files, PNG and HTML export.
import * as vscode from 'vscode';
import type { HostMessage, PreviewMessage } from '../../src/app/previewProtocol';
import type { Diagnostic } from '../../src/core/types';
import { analyze, fillTemplate, isModelFile, nonce, previewHtml } from './host';

const baseName = (uri: vscode.Uri) => uri.path.slice(uri.path.lastIndexOf('/') + 1);

function toVsDiagnostic(d: Diagnostic, doc: vscode.TextDocument): vscode.Diagnostic {
  const line = Math.min(Math.max(0, d.loc.line - 1), doc.lineCount - 1);
  const text = doc.lineAt(line).text;
  const from = Math.min(Math.max(0, d.loc.col - 1), text.length);
  const to = Math.max(from + 1, Math.min(d.loc.endCol - 1, text.length));
  const out = new vscode.Diagnostic(new vscode.Range(line, from, line, to), d.message,
    d.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
  out.code = d.code;
  out.source = 'archi3d';
  return out;
}

class Preview {
  static current: Preview | undefined;
  private readonly panel: vscode.WebviewPanel;
  private doc: vscode.TextDocument;
  private requests = new Map<number, (dataUrl: string) => void>();
  private nextRequest = 1;
  private disposables: vscode.Disposable[] = [];

  static show(ctx: vscode.ExtensionContext, doc: vscode.TextDocument): Preview {
    if (Preview.current) {
      Preview.current.bind(doc);
      Preview.current.panel.reveal(vscode.ViewColumn.Beside, true);
      return Preview.current;
    }
    Preview.current = new Preview(ctx, doc);
    return Preview.current;
  }

  private constructor(private ctx: vscode.ExtensionContext, doc: vscode.TextDocument) {
    this.doc = doc;
    const media = vscode.Uri.joinPath(ctx.extensionUri, 'dist', 'media');
    this.panel = vscode.window.createWebviewPanel('archi3d.preview', `3D · ${baseName(doc.uri)}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] });
    const w = this.panel.webview;
    w.html = previewHtml({ cspSource: w.cspSource, scriptUri: w.asWebviewUri(vscode.Uri.joinPath(media, 'preview.js')).toString(), nonce: nonce(), title: 'Archi3D preview' });
    w.onDidReceiveMessage((m: PreviewMessage) => this.onMessage(m), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    vscode.workspace.onDidChangeTextDocument((e) => { if (e.document === this.doc) this.update(); }, null, this.disposables);
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed && ed.document !== this.doc && isModelFile(ed.document.fileName, ed.document.languageId)) this.bind(ed.document);
    }, null, this.disposables);
  }

  private post(m: HostMessage) { void this.panel.webview.postMessage(m); }

  bind(doc: vscode.TextDocument) {
    this.doc = doc;
    this.panel.title = `3D · ${baseName(doc.uri)}`;
    this.update();
  }

  update() {
    const a = analyze(this.doc.fileName, this.doc.getText());
    if (a.unsupported) { void vscode.window.showInformationMessage(a.unsupported); return; }
    this.post({ type: 'update', name: baseName(this.doc.uri), source: a.arch });
  }

  private onMessage(m: PreviewMessage) {
    if (m.type === 'ready') this.update();
    else if (m.type === 'pick' && m.id) void this.reveal(m.id);
    else if (m.type === 'captured') { this.requests.get(m.requestId)?.(m.dataUrl); this.requests.delete(m.requestId); }
  }

  /** Jump to where the clicked element is defined. */
  private async reveal(id: string) {
    const loc = analyze(this.doc.fileName, this.doc.getText()).locations[id];
    if (!loc) return;
    const range = new vscode.Range(loc.line - 1, loc.col - 1, loc.line - 1, loc.endCol - 1);
    const shown = vscode.window.visibleTextEditors.find((e) => e.document === this.doc);
    const editor = await vscode.window.showTextDocument(this.doc, { viewColumn: shown?.viewColumn ?? vscode.ViewColumn.One, preserveFocus: true, selection: range });
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  capture(): Promise<string> {
    const requestId = this.nextRequest++;
    return new Promise((resolve, reject) => {
      this.requests.set(requestId, resolve);
      setTimeout(() => { if (this.requests.delete(requestId)) reject(new Error('The preview did not answer.')); }, 10_000);
      this.post({ type: 'capture', requestId });
    });
  }

  get document() { return this.doc; }

  dispose() {
    Preview.current = undefined;
    this.disposables.forEach((d) => d.dispose());
    this.panel.dispose();
  }
}

function activeModelDocument(): vscode.TextDocument | undefined {
  const doc = vscode.window.activeTextEditor?.document ?? Preview.current?.document;
  return doc && isModelFile(doc.fileName, doc.languageId) ? doc : undefined;
}

export function activate(ctx: vscode.ExtensionContext): void {
  const problems = vscode.languages.createDiagnosticCollection('archi3d');
  const check = (doc: vscode.TextDocument) => {
    if (!isModelFile(doc.fileName, doc.languageId)) return;
    const a = analyze(doc.fileName, doc.getText());
    problems.set(doc.uri, a.diagnostics.map((d) => toVsDiagnostic(d, doc)));
  };
  vscode.workspace.textDocuments.forEach(check);
  ctx.subscriptions.push(
    problems,
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidChangeTextDocument((e) => check(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => problems.delete(doc.uri)),

    vscode.commands.registerCommand('archi3d.openPreview', () => {
      const doc = activeModelDocument();
      if (!doc) { void vscode.window.showWarningMessage('Open a .arch or Mermaid (.mmd) file first.'); return; }
      Preview.show(ctx, doc);
    }),

    vscode.commands.registerCommand('archi3d.savePng', async () => {
      const preview = Preview.current;
      if (!preview) { void vscode.window.showWarningMessage('Open the 3D preview first (Archi3D: Open 3D Preview to the Side).'); return; }
      const dataUrl = await preview.capture();
      const target = await vscode.window.showSaveDialog({
        defaultUri: preview.document.uri.with({ path: preview.document.uri.path.replace(/\.[^./]+$/, '') + '.png' }),
        filters: { 'PNG image': ['png'] },
      });
      if (!target) return;
      await vscode.workspace.fs.writeFile(target, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
      void vscode.window.showInformationMessage(`Saved ${baseName(target)}`);
    }),

    // Not listed in the command palette: the preview's current frame as a PNG data URL (used by tests).
    vscode.commands.registerCommand('archi3d.capturePreview', () => Preview.current?.capture()),

    vscode.commands.registerCommand('archi3d.exportHtml', async () => {
      const doc = activeModelDocument();
      if (!doc) { void vscode.window.showWarningMessage('Open a .arch or Mermaid (.mmd) file first.'); return; }
      const a = analyze(doc.fileName, doc.getText());
      if (a.unsupported) { void vscode.window.showWarningMessage(a.unsupported); return; }
      const template = new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(ctx.extensionUri, 'dist', 'template.html')));
      const target = await vscode.window.showSaveDialog({
        defaultUri: doc.uri.with({ path: doc.uri.path.replace(/\.[^./]+$/, '') + '.html' }),
        filters: { 'HTML page': ['html'] },
      });
      if (!target) return;
      await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(fillTemplate(template, baseName(doc.uri).replace(/\.[^.]+$/, ''), a.arch)));
      const open = await vscode.window.showInformationMessage(`Exported ${baseName(target)} — a single file that works offline.`, 'Open in browser');
      if (open) void vscode.env.openExternal(target);
    }),
  );
}

export function deactivate(): void {
  Preview.current?.dispose();
}

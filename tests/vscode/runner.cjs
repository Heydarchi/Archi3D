// Runs inside VS Code (extension development host): opens files, runs the commands, checks results.
// Started by scripts/test-vscode.mjs. Writes test-results/vscode-it/result.json.
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..', '..');
const out = path.join(root, 'test-results', 'vscode-it');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, fn, ms = 15000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for: ${what}`);
    await sleep(100);
  }
}
const webviewTabs = () => vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.input instanceof vscode.TabInputWebview);

exports.run = async function run() {
  const checks = [];
  const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); if (!ok) throw new Error(`${name} ${detail}`); };
  try {
    const ext = vscode.extensions.all.find((e) => e.packageJSON.name === 'archi3d');
    check('extension is loaded', ext);

    const ports = await vscode.workspace.openTextDocument(path.join(root, 'examples', '02-ports.arch'));
    await vscode.window.showTextDocument(ports);
    check('.arch files get the "arch" language', ports.languageId === 'arch', ports.languageId);
    await until('activation', () => ext.isActive);

    const commands = await vscode.commands.getCommands(true);
    for (const c of ['archi3d.openPreview', 'archi3d.savePng', 'archi3d.exportHtml']) check(`command ${c}`, commands.includes(c));

    fs.mkdirSync(out, { recursive: true });
    const brokenFile = path.join(out, 'broken.arch');
    fs.writeFileSync(brokenFile, 'component A\nA -> Missing\n');
    const broken = await vscode.workspace.openTextDocument(brokenFile);
    await vscode.window.showTextDocument(broken);
    const diags = await until('E102 in Problems', () => {
      const d = vscode.languages.getDiagnostics(broken.uri);
      return d.length ? d : null;
    });
    check('problems: E102 on line 2, columns of "Missing"', diags[0].code === 'E102' && diags[0].range.start.line === 1 && diags[0].range.start.character === 5, JSON.stringify(diags[0].range));

    // Live diagnostics while editing.
    const editor = vscode.window.activeTextEditor;
    await editor.edit((e) => e.insert(new vscode.Position(2, 0), 'component Missing\n'));
    await until('problems cleared after the fix', () => vscode.languages.getDiagnostics(broken.uri).length === 0);
    check('problems update as you type', true);

    const aosp = await vscode.workspace.openTextDocument(path.join(root, 'examples', '07-aosp-camera.arch'));
    await vscode.window.showTextDocument(aosp);
    await vscode.commands.executeCommand('archi3d.openPreview');
    const tab = await until('preview tab', () => webviewTabs().find((t) => t.label.startsWith('3D ·')));
    check('preview opens beside the editor', tab.label === '3D · 07-aosp-camera.arch', tab.label);

    // The preview follows the active model document.
    const mmd = await vscode.workspace.openTextDocument(path.join(root, 'examples', '05-mermaid.mmd'));
    await vscode.window.showTextDocument(mmd, vscode.ViewColumn.One);
    await until('preview follows the Mermaid file', () => webviewTabs().find((t) => t.label === '3D · 05-mermaid.mmd'));
    check('preview follows the active .mmd document', true);
    check('Mermaid file has no problems', vscode.languages.getDiagnostics(mmd.uri).length === 0);

    // Ask the webview for its frame through the same path "Save as PNG" uses, and keep it for review.
    const png = async (file) => {
      await sleep(3000);
      const url = await vscode.commands.executeCommand('archi3d.capturePreview');
      check(`capture ${file}`, typeof url === 'string' && url.startsWith('data:image/png;base64,'));
      const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      fs.mkdirSync(path.join(root, 'artifacts', 'vscode'), { recursive: true });
      fs.writeFileSync(path.join(root, 'artifacts', 'vscode', file), buf);
      return buf;
    };
    const mermaidShot = await png('in-vscode-mermaid.png');
    check('the preview drew a real frame', mermaidShot.length > 20_000, `${mermaidShot.length} bytes`);
    await vscode.window.showTextDocument(aosp, vscode.ViewColumn.One);
    await until('preview follows back to AOSP', () => webviewTabs().find((t) => t.label === '3D · 07-aosp-camera.arch'));
    await png('in-vscode-aosp.png');
    check('preview is still open', webviewTabs().length === 1);
  } finally {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(checks, null, 2));
  }
};

// npm run dev [-- <model.arch3d|.mmd|.d2>] [--port 5173] [--host] [--open]
// Starts the app. With a file, the editor opens that file and Save writes it back.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { archiFilePlugin, saveTarget } from './dev-file-plugin.mjs';

export async function startDev({ file, port = 5173, host = false, open = false, strictPort = false, logLevel = 'info' } = {}) {
  const server = await createServer({
    plugins: file ? [archiFilePlugin(file)] : [],
    server: { port, host, open, strictPort },
    logLevel,
  });
  await server.listen();
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const file = args.find((a, i) => !a.startsWith('--') && !['--port'].includes(args[i - 1]));
  const path = file ? resolve(file) : undefined;
  const server = await startDev({ file: path, port: Number(value('--port') ?? 5173), host: args.includes('--host'), open: args.includes('--open') });
  server.printUrls();
  if (path) {
    console.log(`\n  Editing ${path}${existsSync(path) ? '' : ' (new file, the first save creates it)'}`);
    if (saveTarget(path) !== path) console.log(`  Saves go to ${saveTarget(path)} (the original is not changed)`);
    console.log('  Save in the app with the Save button or Ctrl/Cmd+S.\n');
  }
}

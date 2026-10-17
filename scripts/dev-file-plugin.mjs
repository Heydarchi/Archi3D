// Dev-server plugin: lets the app edit exactly one model file on disk.
//   GET  /__archi/file  → { name, path, text, hash, saveAs, exists }
//   PUT  /__archi/file  { text, baseHash } → { hash } | 409 { text, hash } if it changed on disk since baseHash
// Changes made to the file by other programs are pushed to the page as the 'archi:file' event.
// Only the file given on the command line can be read or written. .mmd/.d2 files are read-only;
// saving writes the converted model to a sibling .arch3d file.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unwatchFile, watchFile, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

export const FILE_ENDPOINT = '/__archi/file';
const MAX_BYTES = 5 * 1024 * 1024;

export const hashText = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** Where saves go: the file itself for .arch3d/.arch, name.arch3d for a bare name, a sibling .arch3d for imported formats. */
export function saveTarget(file) {
  const ext = extname(file).toLowerCase();
  if (ext === '.arch3d' || ext === '.arch') return file;   // .arch: the older name, saved in place
  return ext === '' ? `${file}.arch3d` : join(dirname(file), `${basename(file, extname(file))}.arch3d`);
}

const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

function writeAtomic(file, text) {
  const tmp = join(dirname(file), `.${basename(file)}.${process.pid}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES) { fail(new Error('too large')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export function archiFilePlugin(filePath) {
  const file = resolve(filePath);
  const target = saveTarget(file);
  let lastWritten = null;      // hash of our own last save, so its watcher event is not echoed back
  return {
    name: 'archi-file',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(FILE_ENDPOINT, async (req, res) => {
        try {
          if (req.method === 'GET') {
            const text = readText(file);
            return json(res, 200, { name: basename(file), path: file, text, hash: hashText(text), saveAs: target, exists: existsSync(file) });
          }
          if (req.method === 'PUT') {
            const { text, baseHash } = JSON.parse(await readBody(req));
            if (typeof text !== 'string') return json(res, 400, { error: 'text missing' });
            const current = readText(target);
            // Saving over the original only when nobody changed it since the page loaded it.
            if (target === file && existsSync(file) && baseHash && hashText(current) !== baseHash) {
              return json(res, 409, { text: current, hash: hashText(current) });
            }
            writeAtomic(target, text);
            lastWritten = hashText(text);
            return json(res, 200, { hash: lastWritten, path: target });
          }
          res.statusCode = 405;
          res.end();
        } catch (err) {
          json(res, 500, { error: String(err instanceof Error ? err.message : err) });
        }
      });

      // Our own watcher: Vite's skips git-ignored folders, and polling one file also works on
      // network drives, WSL's /mnt and with editors that save by renaming a temp file.
      let seen = hashText(readText(file));
      watchFile(file, { interval: 250 }, () => {
        const text = readText(file);
        const hash = hashText(text);
        if (hash === seen) return;
        seen = hash;
        if (hash === lastWritten) return;
        server.ws.send({ type: 'custom', event: 'archi:file', data: { text, hash } });
      });
      server.httpServer?.on('close', () => unwatchFile(file));
    },
    // The model file may live inside the project (e.g. fixtures/): never hot-reload the page for it.
    handleHotUpdate(ctx) {
      if (resolve(ctx.file) === file) return [];
      return undefined;
    },
  };
}

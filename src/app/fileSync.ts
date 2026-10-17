// Editing one model file on disk through the dev server (npm run dev -- model.arch3d).
// Absent in builds, the standalone file and the dev server without a file: then openModelFile() is null.

export interface ModelFile {
  name: string;
  path: string;
  /** Where Save writes: the file itself, or a sibling .arch3d for .mmd/.d2. */
  saveAs: string;
  exists: boolean;
  text: string;
  hash: string;
}

export type SaveResult =
  | { status: 'saved'; hash: string }
  | { status: 'conflict'; text: string; hash: string }
  | { status: 'error'; message: string };

const ENDPOINT = '/__archi/file';

export async function openModelFile(): Promise<ModelFile | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null;
    return (await r.json()) as ModelFile;
  } catch {
    return null;
  }
}

/** Save `text`; `baseHash` is the disk version it was based on (a conflict if the disk moved on). */
export async function saveModelFile(text: string, baseHash: string | null): Promise<SaveResult> {
  try {
    const r = await fetch(ENDPOINT, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, baseHash }) });
    const body = await r.json();
    if (r.status === 409) return { status: 'conflict', text: body.text, hash: body.hash };
    if (!r.ok) return { status: 'error', message: body.error ?? r.statusText };
    return { status: 'saved', hash: body.hash };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/** Called when another program changes the file. */
export function onDiskChange(fn: (text: string, hash: string) => void): void {
  import.meta.hot?.on('archi:file', (d: { text: string; hash: string }) => fn(d.text, d.hash));
}

export const STARTER_MODEL = `# New Archi3D model. The language is explained in docs/USER_GUIDE.md
ui       Web      out: api
service  Api      in: api    out: db
database Store    in: db

Web.api -> Api.api : HTTPS
Api.db  -> Store.db
`;

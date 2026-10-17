// The layout worker for the single-file export: built from inlined code through a Blob URL, so it
// works from file:// with no network. In CDN mode it first tries ELK from pinned CDN URLs (3 s
// timeout) and falls back to the inlined copy.
import { cdnUrls, workerCode, workerWithoutElk } from 'virtual:archi-standalone';

export const CDN_TIMEOUT_MS = 3000;

const SHIM = 'self.document = self.document || {};\n'; // see elkWorkerShim.ts

const fromCode = (code: string) =>
  new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));

async function fetchWithTimeout(url: string, ms: number): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function createLayoutWorker(): Promise<Worker> {
  for (const url of cdnUrls) {
    const elk = await fetchWithTimeout(url, CDN_TIMEOUT_MS);
    if (elk) {
      (globalThis as { __archiElkSource?: string }).__archiElkSource = url;
      return fromCode(`${SHIM}${elk}\n;${workerWithoutElk}`);
    }
  }
  if (cdnUrls.length) console.warn('Archi3D: CDN not reachable; using the inlined layout engine.');
  (globalThis as { __archiElkSource?: string }).__archiElkSource = 'inline';
  return fromCode(`${SHIM}${workerCode}`);
}

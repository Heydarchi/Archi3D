// elk.bundled.js checks `typeof document === 'undefined' && typeof self !== 'undefined'` at load
// time; inside our own Web Worker that is true, so it hijacks self.onmessage and never exports
// its in-process worker ("c is not a constructor"). A placeholder `document` while elkjs loads
// sends it down its module path instead. It must stay: elkjs loads its in-process worker
// lazily, on the first `new ELK()`. Import this before anything that imports elkjs; only the
// layout worker (which runs nothing else) uses it.
const g = globalThis as { document?: unknown };
if (typeof g.document === 'undefined') g.document = {};
export {};

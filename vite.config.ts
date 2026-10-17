import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 9000, // the lazily loaded D2 compiler is ~8 MB
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        harness: resolve(import.meta.dirname, 'harness.html'),
        preview: resolve(import.meta.dirname, 'preview.html'),
      },
    },
  },
  worker: { format: 'es' },
  preview: { port: 4173, strictPort: true },
  server: { port: 5173 },
});

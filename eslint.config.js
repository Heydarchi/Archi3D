import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const browserGlobals = {
  window: 'readonly', document: 'readonly', console: 'readonly', performance: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', setTimeout: 'readonly',
  clearTimeout: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Worker: 'readonly',
  self: 'readonly', HTMLElement: 'readonly', HTMLCanvasElement: 'readonly', fetch: 'readonly',
  ResizeObserver: 'readonly', PointerEvent: 'readonly', MouseEvent: 'readonly', Blob: 'readonly',
};
const nodeGlobals = { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly' };

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'vendor', 'offline', 'artifacts', 'test-results', 'reference', 'playwright-report', 'vscode/dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js,mjs}'],
    languageOptions: { globals: { ...browserGlobals, ...nodeGlobals } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // CommonJS files (the VS Code test runner is loaded with require()).
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...nodeGlobals, require: 'readonly', module: 'writable', exports: 'writable', __dirname: 'readonly', setTimeout: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // The pure core: no three.js, no DOM. Runs in Node, a worker and the browser.
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: { console: 'readonly' } },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['three', 'three/*'], message: 'src/core must not import three.js.' },
          { group: ['camera-controls', 'troika-three-text'], message: 'src/core must not import rendering libraries.' },
          { group: ['**/render/**', '**/app/**', '**/debug/**'], message: 'src/core must not import downstream layers.' },
        ],
      }],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'self'],
    },
  },
  {
    files: ['src/debug/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['three', 'three/*'], message: 'Debug views are SVG; no three.js.' }],
      }],
    },
  },
  {
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/app/**'], message: 'src/render must not import src/app.' }],
      }],
    },
  },
);

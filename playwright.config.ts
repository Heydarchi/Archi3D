import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/visual',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFilePath}/{arg}{ext}',
  expect: {
    // threshold: how different a pixel's colour may be before it counts (Playwright's default 0.2 hid
    // real changes between light greys). maxDiffPixelRatio: how many pixels may differ.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, threshold: 0.08, animations: 'disabled' },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    // Keep a full trace when a test fails: npx playwright show-trace test-results/<test>/trace.zip
    trace: 'retain-on-failure',
    channel: process.env.PW_CHANNEL || undefined,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/harness.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

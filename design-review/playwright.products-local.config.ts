import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../e2e-platform',
  testMatch: 'products-ui.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    trace: 'off',
    actionTimeout: 15000,
  },
  outputDir: '../artifacts/products-ui-live/test-results',
});

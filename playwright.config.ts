import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true },
  webServer: [
    {
      command: 'npm run api',
      env: { ENABLE_LEGACY_API: '1' },
      url: 'http://127.0.0.1:3001/api/pages',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      env: { VITE_LEGACY_UI: '1' },
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm --prefix ../frontend_runtime run dev',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
    },
  ],
});

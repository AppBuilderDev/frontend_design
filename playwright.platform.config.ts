import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const database = join(mkdtempSync(join(tmpdir(), 'appbuilder-browser-')), 'platform.sqlite');
export default defineConfig({
  testDir: './e2e-platform',
  workers: 1,
  timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:5183', headless: true, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node --import tsx tests/fixtures/api.ts',
      cwd: '../backend',
      url: 'http://127.0.0.1:3101/api/v1/auth/session',
      reuseExistingServer: false,
      env: {
        API_PORT: '3101',
        PLATFORM_DB: database,
        CORS_ORIGINS: 'http://127.0.0.1:5183,http://127.0.0.1:5184',
      },
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5183 --strictPort',
      url: 'http://127.0.0.1:5183',
      reuseExistingServer: false,
      env: {
        PLATFORM_API_TARGET: 'http://127.0.0.1:3101',
        VITE_RUNTIME_URL: 'http://127.0.0.1:5184',
      },
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184 --strictPort',
      cwd: '../frontend_runtime',
      url: 'http://127.0.0.1:5184',
      reuseExistingServer: false,
      env: { PLATFORM_API_TARGET: 'http://127.0.0.1:3101', VITE_API_URL: 'http://127.0.0.1:3101' },
    },
  ],
});

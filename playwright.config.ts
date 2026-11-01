import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/layout',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { browserName: 'chromium', channel: 'msedge', headless: true, baseURL: 'http://127.0.0.1:5187' },
  globalSetup: './tests/layout/global-setup.ts',
});

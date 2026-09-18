import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    headless: true,
    launchOptions: {
      executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  webServer: {
    command: 'PORT=4174 BASE_PATH=/ pnpm run dev',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
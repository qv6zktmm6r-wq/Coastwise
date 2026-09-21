import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/production-fixtures',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  projects: [
    {
      name: 'production-check-fixtures',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE
            ?? process.env.CHROMIUM_PATH
            ?? '/repl/tools/bin/chromium',
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
  ],
  use: {
    baseURL: 'https://live-app.fixture',
    headless: true,
  },
});
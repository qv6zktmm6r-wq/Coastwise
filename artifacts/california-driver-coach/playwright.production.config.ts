import { defineConfig, devices } from '@playwright/test';

const productionUrl = process.env.PRODUCTION_URL;

if (!productionUrl) {
  throw new Error(
    'PRODUCTION_URL is required. Obtain it from Replit deployment metadata before running the production smoke check.',
  );
}

const parsedProductionUrl = new URL(productionUrl);
if (
  parsedProductionUrl.protocol !== 'https:'
  || parsedProductionUrl.hostname === 'localhost'
  || parsedProductionUrl.hostname.endsWith('.replit.dev')
) {
  throw new Error(
    `PRODUCTION_URL must be a published HTTPS URL from deployment metadata, received: ${productionUrl}`,
  );
}

export default defineConfig({
  testDir: './tests/production',
  testMatch: 'live-app.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  projects: [
    {
      name: 'production-chromium',
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
    baseURL: parsedProductionUrl.origin,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
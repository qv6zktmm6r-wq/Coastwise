import { defineConfig, devices } from '@playwright/test';

const productionUrl = process.env.PRODUCTION_URL;
const deploymentVisibility = process.env.PRODUCTION_DEPLOYMENT_VISIBILITY;
const externalAccessToken = process.env.PRODUCTION_EXTERNAL_ACCESS_TOKEN;

if (!productionUrl) {
  throw new Error(
    'PRODUCTION_URL is required. Obtain it from Replit deployment metadata before running the production smoke check.',
  );
}

if (!deploymentVisibility) {
  throw new Error(
    'PRODUCTION_DEPLOYMENT_VISIBILITY is required. Set it to the visibility reported by Replit deployment metadata.',
  );
}

if (!['public', 'private', 'password'].includes(deploymentVisibility)) {
  throw new Error(
    'PRODUCTION_DEPLOYMENT_VISIBILITY must be public, private, or password.',
  );
}

if (deploymentVisibility === 'private' && !externalAccessToken) {
  throw new Error(
    'PRODUCTION_EXTERNAL_ACCESS_TOKEN is required for a private deployment. Use a Production external-access token.',
  );
}

if (deploymentVisibility === 'public' && externalAccessToken) {
  throw new Error(
    'Do not provide PRODUCTION_EXTERNAL_ACCESS_TOKEN for a public deployment.',
  );
}

if (deploymentVisibility === 'password') {
  throw new Error(
    'Password-protected deployments cannot be validated by this automated check. Change the deployment to private and use a Production external-access token, or make it public.',
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
    trace: externalAccessToken ? 'off' : 'retain-on-failure',
  },
});

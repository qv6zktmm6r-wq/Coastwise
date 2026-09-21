import { chromium } from '@playwright/test';

const productionUrl = process.env.PRODUCTION_URL;
if (!productionUrl) {
  throw new Error(
    'PRODUCTION_URL is required. Supply the published URL from deployment metadata; do not guess it.',
  );
}

const parsedUrl = new URL(productionUrl);
if (parsedUrl.protocol !== 'https:') {
  throw new Error(`PRODUCTION_URL must use https: "${productionUrl}"`);
}

const chromiumPath =
  process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  process.env.CHROMIUM_PATH ??
  '/repl/tools/bin/chromium';

const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  const failures = [];

  page.on('pageerror', (error) => {
    failures.push(`page error: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`console error: ${message.text()}`);
    }
  });

  const healthUrl = new URL('/api/healthz', parsedUrl);
  const healthResponse = await page.request.get(healthUrl);
  if (!healthResponse.ok()) {
    throw new Error(
      `Production API health check failed (${healthResponse.status()}): ${healthUrl}`,
    );
  }

  const healthBody = await healthResponse.json();
  if (healthBody?.status !== 'ok') {
    throw new Error(`Production API health response is invalid: ${JSON.stringify(healthBody)}`);
  }

  const response = await page.goto(parsedUrl.toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (!response?.ok()) {
    throw new Error(`Production web app returned ${response?.status() ?? 'no response'}`);
  }

  await page.waitForTimeout(2_000);
  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('Coastwise')) {
    throw new Error('Production web app did not render Coastwise content');
  }
  if (bodyText.includes('Something went wrong')) {
    throw new Error('Production web app rendered the global error boundary');
  }
  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }

  console.log(`Production smoke passed: ${parsedUrl.origin}`);
} finally {
  await browser.close();
}
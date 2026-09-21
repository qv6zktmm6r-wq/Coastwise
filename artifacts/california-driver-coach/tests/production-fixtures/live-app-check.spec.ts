import { expect, test, type Page } from '@playwright/test';
import { checkLiveApp } from '../production/live-app-check';

const healthyStartScreen = `
  <main>
    <h1>What are you working on today?</h1>
    <button data-testid="button-goal-permit">Permit</button>
    <button data-testid="button-goal-driving">Driving</button>
  </main>
`;

async function serveFixture(page: Page, body: string, script = '', status = 200) {
  await page.route('https://live-app.fixture/**', async (route) => {
    await route.fulfill({
      status,
      contentType: 'text/html',
      body: `<!doctype html><html><body>${body}<script>${script}</script></body></html>`,
    });
  });
}

const healthyApi = async () => ({ status: 200, body: { status: 'ok' } });

test('accepts a healthy API and usable start screen', async ({ page, request }) => {
  await serveFixture(page, healthyStartScreen);

  await expect(checkLiveApp({ page, request, getHealth: healthyApi })).resolves.toBeUndefined();
});

test('rejects a non-200 app document', async ({ page, request }) => {
  await serveFixture(page, healthyStartScreen, '', 503);

  await expect(checkLiveApp({ page, request, getHealth: healthyApi }))
    .rejects.toThrow('App document must return HTTP 200 (received 503)');
});

test('rejects an unhealthy API', async ({ page, request }) => {
  await serveFixture(page, healthyStartScreen);

  await expect(checkLiveApp({
    page,
    request,
    getHealth: async () => ({ status: 503, body: { status: 'unavailable' } }),
  })).rejects.toThrow('API health endpoint must return HTTP 200');
});

test('rejects the global fallback screen', async ({ page, request }) => {
  await serveFixture(
    page,
    '<main data-testid="global-error-boundary"><h1>Something went wrong</h1></main>',
  );

  await expect(checkLiveApp({ page, request, getHealth: healthyApi }))
    .rejects.toThrow('Published app must not render the global error boundary');
});

test('rejects an uncaught page error', async ({ page, request }) => {
  await serveFixture(page, healthyStartScreen, 'setTimeout(() => { throw new Error("fixture page failure"); })');

  await expect(checkLiveApp({ page, request, getHealth: healthyApi }))
    .rejects.toThrow('Published app must not raise uncaught page errors');
});

test('rejects a critical console error', async ({ page, request }) => {
  await serveFixture(page, healthyStartScreen, 'console.error("fixture console failure")');

  await expect(checkLiveApp({ page, request, getHealth: healthyApi }))
    .rejects.toThrow('Published app must not log critical console errors');
});
import { expect, test } from '@playwright/test';

test('published app serves a healthy API and usable start screen', async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  const criticalConsoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      criticalConsoleErrors.push(message.text());
    }
  });

  const healthResponse = await request.get('/api/healthz');
  expect(healthResponse.status(), 'API health endpoint must return HTTP 200').toBe(200);
  await expect(healthResponse.json()).resolves.toEqual({ status: 'ok' });

  const response = await page.goto('/', { waitUntil: 'networkidle' });
  expect(response?.status(), 'App document must return HTTP 200').toBe(200);

  await expect.soft(page.getByTestId('global-error-boundary')).toHaveCount(0);
  await expect.soft(
    page.getByRole('heading', { name: 'Something went wrong' }),
    'Published app must not render the global error boundary',
  ).toHaveCount(0);
  await expect.soft(
    page.getByRole('heading', { name: 'What are you working on today?' }),
  ).toBeVisible();
  await expect.soft(page.getByTestId('button-goal-permit')).toBeVisible();
  await expect.soft(page.getByTestId('button-goal-driving')).toBeVisible();

  expect.soft(pageErrors, 'Published app must not raise uncaught page errors').toEqual([]);
  expect.soft(
    criticalConsoleErrors,
    'Published app must not log critical console errors',
  ).toEqual([]);
});
import type { APIRequestContext, Page } from '@playwright/test';

type HealthResult = {
  status: number;
  body: unknown;
};

type LiveAppCheckOptions = {
  page: Page;
  request: APIRequestContext;
  getHealth?: () => Promise<HealthResult>;
};

export async function checkLiveApp({
  page,
  request,
  getHealth = async () => {
    const response = await request.get('/api/healthz');
    return {
      status: response.status(),
      body: await response.json(),
    };
  },
}: LiveAppCheckOptions): Promise<void> {
  const pageErrors: string[] = [];
  const criticalConsoleErrors: string[] = [];
  const failures: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      criticalConsoleErrors.push(message.text());
    }
  });

  const health = await getHealth();
  if (health.status !== 200) {
    failures.push(`API health endpoint must return HTTP 200 (received ${health.status})`);
  }
  if (JSON.stringify(health.body) !== JSON.stringify({ status: 'ok' })) {
    failures.push(`API health endpoint must return {"status":"ok"}`);
  }

  const response = await page.goto('/', { waitUntil: 'networkidle' });
  if (response?.status() !== 200) {
    failures.push(`App document must return HTTP 200 (received ${response?.status() ?? 'no response'})`);
  }

  if (await page.getByTestId('global-error-boundary').count() > 0
    || await page.getByRole('heading', { name: 'Something went wrong' }).count() > 0) {
    failures.push('Published app must not render the global error boundary');
  }
  if (!await page.getByRole('heading', { name: 'What are you working on today?' }).isVisible()) {
    failures.push('Published app must show the usable start screen heading');
  }
  if (!await page.getByTestId('button-goal-permit').isVisible()) {
    failures.push('Published app must show the permit goal');
  }
  if (!await page.getByTestId('button-goal-driving').isVisible()) {
    failures.push('Published app must show the driving goal');
  }

  if (pageErrors.length > 0) {
    failures.push(`Published app must not raise uncaught page errors: ${pageErrors.join('\n')}`);
  }
  if (criticalConsoleErrors.length > 0) {
    failures.push(
      `Published app must not log critical console errors: ${criticalConsoleErrors.join('\n')}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}
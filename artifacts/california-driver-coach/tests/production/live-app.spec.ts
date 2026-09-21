import { expect, test } from '@playwright/test';
import { headersForProductionRequest } from '../../src/production-access';
import { checkLiveApp } from './live-app-check';

test('published app serves a healthy API and usable start screen', async ({
  page,
  request,
}) => {
  const productionOrigin = new URL(test.info().project.use.baseURL).origin;
  const externalAccessToken = process.env.PRODUCTION_EXTERNAL_ACCESS_TOKEN;

  await page.route('**/*', async (route) => {
    const interceptedRequest = route.request();
    await route.continue({
      headers: headersForProductionRequest(
        interceptedRequest.url(),
        productionOrigin,
        externalAccessToken,
        interceptedRequest.headers(),
      ),
    });
  });

  await expect(checkLiveApp({
    page,
    request,
    getHealth: async () => {
      const healthUrl = new URL('/api/healthz', productionOrigin).toString();
      const healthResponse = await request.get(healthUrl, {
        headers: headersForProductionRequest(
          healthUrl,
          productionOrigin,
          externalAccessToken,
        ),
      });
      return {
        status: healthResponse.status(),
        body: await healthResponse.json(),
      };
    },
  })).resolves.toBeUndefined();

  expect(
    page.url(),
    'App document must remain on the published Coastwise deployment',
  ).toBe(new URL('/', productionOrigin).toString());
});

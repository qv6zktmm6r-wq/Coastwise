import { expect, test } from '@playwright/test';
import { checkLiveApp } from './live-app-check';

test('published app serves a healthy API and usable start screen', async ({
  page,
  request,
}) => {
  await expect(checkLiveApp({ page, request })).resolves.toBeUndefined();
});
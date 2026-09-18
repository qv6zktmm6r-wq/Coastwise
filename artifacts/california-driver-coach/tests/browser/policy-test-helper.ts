import type { Page } from '@playwright/test';

export async function acknowledgeCurrentPolicyBeforeNavigation(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('coastwise-policy-acknowledgement', JSON.stringify({
      acknowledgements: [{ version: '2026-09-18', acknowledgedAt: new Date().toISOString() }],
    }));
  });
}
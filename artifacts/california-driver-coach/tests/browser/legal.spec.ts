import { expect, test } from '@playwright/test';

test('keeps privacy and safety terms discoverable from Settings', async ({ page }) => {
  await page.goto('/settings');
  await page.getByTestId('button-acknowledge-policy').click();
  await expect(page.getByTestId('legal-links-card')).toBeVisible();

  await page.getByTestId('link-privacy').click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId('privacy-page')).toContainText('without an account');
  await expect(page.getByTestId('privacy-page')).toContainText(/precise routes, coaching-event positions and notes, annotations, and recording formats stay in the browser/i);

  await page.goto('/settings');
  await page.getByTestId('link-terms').click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByTestId('terms-page')).toContainText('Never read, tap, aim a camera, or troubleshoot Coastwise while driving');
  await expect(page.getByTestId('terms-page')).toContainText('educational guidance');
});

test('allows policies to be read before the material notice is acknowledged', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByTestId('privacy-page')).toBeVisible();
  await expect(page.getByTestId('material-policy-notice')).toHaveCount(0);

  await page.goto('/terms');
  await expect(page.getByTestId('terms-page')).toBeVisible();
  await expect(page.getByTestId('material-policy-notice')).toHaveCount(0);
});
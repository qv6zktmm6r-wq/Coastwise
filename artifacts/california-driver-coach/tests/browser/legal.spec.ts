import { expect, test } from '@playwright/test';

test('keeps privacy and safety terms discoverable from Settings', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByTestId('legal-links-card')).toBeVisible();

  await page.getByTestId('link-privacy').click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId('privacy-page')).toContainText('No account is required');
  await expect(page.getByTestId('privacy-page')).toContainText(/drive video files remain on the recording device and are not included in cloud sync/i);

  await page.goto('/settings');
  await page.getByTestId('link-terms').click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByTestId('terms-page')).toContainText('Only a passenger should operate Coastwise');
  await expect(page.getByTestId('terms-page')).toContainText('An account is not required');
});
import { expect, test } from '@playwright/test';
import { acknowledgeCurrentPolicyBeforeNavigation } from './policy-test-helper';

const mobileNavItems = [
  'link-mobile-nav-today',
  'link-mobile-nav-permit-practice',
  'link-mobile-nav-drive-practice',
  'link-mobile-nav-parent-view',
];

test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => acknowledgeCurrentPolicyBeforeNavigation(page));

test('keeps each start-screen goal tied to its own study tools', async ({ page }) => {
  await page.goto('/');

  const permitGoal = page.getByTestId('button-goal-permit');
  const drivingGoal = page.getByTestId('button-goal-driving');
  const permitAction = page.getByTestId('button-open-permit-menu');
  const drivingAction = page.getByTestId('button-open-driving-menu');
  const scenariosAction = page.getByTestId('button-open-scenarios');

  await expect(permitGoal).toHaveAttribute('aria-expanded', 'false');
  await expect(drivingGoal).toHaveAttribute('aria-expanded', 'false');
  await expect(permitAction).toHaveCount(0);
  await expect(drivingAction).toHaveCount(0);
  await expect(scenariosAction).toHaveCount(0);

  await permitGoal.click();
  await expect(permitGoal).toHaveAttribute('aria-expanded', 'true');
  await expect(drivingGoal).toHaveAttribute('aria-expanded', 'false');
  await expect(permitAction).toBeVisible();
  await expect(drivingAction).toHaveCount(0);
  await expect(scenariosAction).toHaveCount(0);

  await drivingGoal.click();
  await expect(permitGoal).toHaveAttribute('aria-expanded', 'false');
  await expect(drivingGoal).toHaveAttribute('aria-expanded', 'true');
  await expect(permitAction).toHaveCount(0);
  await expect(drivingAction).toBeVisible();
  await expect(scenariosAction).toBeVisible();

  await scenariosAction.click();
  await expect(page).toHaveURL(/\/scenarios$/);
  await expect(page.getByRole('heading', { name: 'Build your calm before the traffic does.' })).toBeVisible();

  await page.goto('/');
  await page.getByTestId('button-goal-permit').click();
  await page.getByTestId('button-open-permit-menu').click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole('heading', { name: 'A clear next step for permit practice.' })).toBeVisible();

  await page.goto('/');
  await page.getByTestId('button-goal-driving').click();
  await page.getByTestId('button-open-driving-menu').click();
  await expect(page).toHaveURL(/\/drive$/);
  await expect(page.getByRole('heading', { name: 'Every drive is a building block.' })).toBeVisible();

  for (const testId of mobileNavItems) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
  await expect(page.locator('[data-testid^="link-mobile-nav-"]')).toHaveCount(4);
});

test('starts a free-drive dashcam without building a route', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'The deterministic fake camera is configured for Chromium.');
  await context.grantPermissions(['camera', 'geolocation'], { origin: 'http://127.0.0.1:4174' });
  await context.setGeolocation({ latitude: 34.0522, longitude: -118.2437 });
  await page.goto('/drive');

  await page.getByTestId('button-start-free-drive').click();
  await expect(page.getByTestId('preflight-checklist')).toContainText('Free Drive');
  await expect(page.getByTestId('preflight-checklist')).toBeInViewport();

  for (const checkbox of await page.getByRole('checkbox').all()) {
    await checkbox.check();
  }
  await page.getByTestId('button-confirm-preflight').click();

  await expect(page.getByText('Recording locally')).toBeVisible();
  await expect(page.locator('video[autoplay]')).toBeVisible();
  await expect(page.getByTestId('active-recording-panel')).toBeInViewport();
  await expect(page.getByTestId('text-gps-status')).toContainText(/Live|Finding/);
  await expect(page.getByTestId('text-current-speed')).toBeVisible();
  await expect(page.getByTestId('text-motion-status')).toBeVisible();
  const cameraBounds = await page.locator('video[autoplay]').boundingBox();
  expect(cameraBounds?.height).toBeGreaterThan(150);
  expect(cameraBounds?.height).toBeLessThan(360);
  await page.getByTestId('button-stop-gps-drive').click();
});
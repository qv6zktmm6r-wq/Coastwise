import { expect, test } from '@playwright/test';
import { acknowledgeCurrentPolicyBeforeNavigation } from './policy-test-helper';

test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => acknowledgeCurrentPolicyBeforeNavigation(page));

test('keeps every mobile destination named, active, reachable, and large enough', async ({ page }) => {
  await page.goto('/');

  const destinations = [
    { testId: 'link-mobile-nav-today', path: '/', name: 'Today' },
    { testId: 'link-mobile-nav-permit-practice', path: '/practice', name: 'Permit & knowledge' },
    { testId: 'link-mobile-nav-drive-practice', path: '/drive', name: 'Driving exam' },
    { testId: 'link-mobile-nav-parent-view', path: '/parent', name: 'Parent view' },
  ];

  for (const destination of destinations) {
    const link = page.getByTestId(destination.testId);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${destination.path === '/' ? '/$' : `${destination.path}$`}`));
    await expect(link).toHaveAccessibleName(destination.name);
    await expect(link).toHaveAttribute('aria-current', 'page');
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByTestId('button-header-settings')).toHaveAccessibleName('Open settings');
});

test('contains drawer focus, restores it on Escape, and focuses the destination after navigation', async ({ page }) => {
  await page.goto('/');

  const open = page.getByTestId('button-open-navigation');
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('button-close-navigation')).toBeFocused();
  await expect(page.locator('nav[aria-label="Primary navigation"]')).toHaveAttribute('inert', '');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
  await expect(page.locator('main')).toHaveAttribute('inert', '');

  await page.getByTestId('link-brand').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('link-settings')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('link-brand')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await expect(open).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');
  await page.getByTestId('link-brand').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main h1[tabindex="-1"]')).toBeFocused();
  await expect(page.getByTestId('link-brand')).not.toBeFocused();

  await open.focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('link-nav-permit-practice').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.locator('main h1[tabindex="-1"]')).toBeFocused();
  await expect(page.getByTestId('link-mobile-nav-permit-practice')).toHaveAttribute('aria-current', 'page');
});

test('shows keyboard focus and disables page transitions for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const open = page.getByTestId('button-open-navigation');
  await open.focus();
  const focusStyle = await open.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusStyle).not.toBe('none');

  await page.getByTestId('link-mobile-nav-permit-practice').click();
  const transition = page.locator('.page-transition');
  await expect(transition).toHaveCSS('animation-name', 'none');
  await expect(transition).toHaveCSS('animation-duration', '0s');
});
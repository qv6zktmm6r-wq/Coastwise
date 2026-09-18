import { expect, test } from '@playwright/test';

test('keeps browser video controls and coached moments synchronized', async ({ page }) => {
  await page.addInitScript(() => {
    const playbackTimes = new WeakMap<HTMLMediaElement, number>();
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() {
        return playbackTimes.get(this) ?? 0;
      },
      set(value: number) {
        playbackTimes.set(this, value);
      },
    });
  });

  await page.goto('/drive?reviewFixture=1');

  const video = page.getByTestId('video-drive-review');
  await expect(video).toBeVisible();
  await page.getByTestId('button-review-event-fixture-turn').click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBe(12);

  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = 24.1;
    element.dispatchEvent(new Event('timeupdate'));
  });
  await expect(page.getByTestId('review-selected-event')).toContainText('Following distance reminder');

  await page.getByTestId('button-delete-review-event-fixture-turn').click();
  await expect(video).toBeVisible();
  await expect(page.getByTestId('button-review-event-fixture-turn')).toHaveCount(0);
  await expect(page.getByText('2 coached moments')).toBeVisible();

  await page.getByTestId('button-delete-drive-video').click();
  await expect(video).toHaveCount(0);
  await expect(page.locator('[data-testid^="button-review-event-"]')).toHaveCount(0);
});
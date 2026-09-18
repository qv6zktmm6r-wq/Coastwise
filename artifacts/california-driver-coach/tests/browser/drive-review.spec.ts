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

test('seeks decoded review video with native media events', async ({ page }) => {
  await page.goto('/drive?reviewFixture=1');

  const video = page.getByTestId('video-drive-review');
  await expect(video).toBeVisible();
  await video.evaluate((element: HTMLVideoElement) => {
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    return new Promise<void>((resolve, reject) => {
      element.addEventListener('loadedmetadata', () => resolve(), { once: true });
      element.addEventListener('error', () => reject(element.error), { once: true });
    });
  });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.duration)).toBe(30);

  const nativeSeek = video.evaluate((element: HTMLVideoElement) => new Promise<number>((resolve) => {
    element.addEventListener('seeked', () => resolve(element.currentTime), { once: true });
  }));
  await page.getByTestId('button-review-event-fixture-turn').click();
  await expect(nativeSeek).resolves.toBeCloseTo(12, 1);

  const nativeTimeUpdate = video.evaluate((element: HTMLVideoElement) => new Promise<number>((resolve) => {
    element.addEventListener('timeupdate', () => resolve(element.currentTime), { once: true });
    element.currentTime = 24.1;
  }));
  await expect(nativeTimeUpdate).resolves.toBeCloseTo(24.1, 1);
  await expect(page.getByTestId('review-selected-event')).toContainText('Following distance reminder');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(24.1, 1);
});
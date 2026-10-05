import { expect, test } from '@playwright/test';

test('reduced motion: native scroll, no intro crane, content shown at once', async ({ page }) => {
  await page.goto('/?test=1&tier=low');
  await page.waitForFunction(() => (window as unknown as { __stage?: { ready: boolean } }).__stage?.ready === true, null, {
    timeout: 180_000,
  });
  // Lenis adds this class when it takes over smoothing; reduced motion keeps native scroll.
  expect(await page.evaluate(() => document.documentElement.classList.contains('lenis'))).toBe(false);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

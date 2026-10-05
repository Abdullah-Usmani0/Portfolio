import { expect, test } from '@playwright/test';
import { collectErrors, open, type SiteHook } from './site.ts';

test('with reduced motion, a dive opens on its first step and steps without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.jump('learners'));
  await page.locator('#learners .more').click();
  await expect(page.locator('.dive-title')).toHaveText('A cohort plays it first');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('.dive-title')).toHaveText('Five learners, five habits');
  await page.keyboard.press('Escape');
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
  expect(errors).toEqual([]);
});

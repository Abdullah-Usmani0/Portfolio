import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('without WebGL the story still reads, over Blender posters', async ({ page }) => {
  await page.goto('/?test=1');
  const state = await page.evaluate(() => (window as unknown as { __stage: { tier: string } }).__stage);
  expect(state.tier).toBe('static');
  expect(await page.locator('canvas').count()).toBe(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Muhammad Abdullah Usmani');
  await expect(page.locator('img[src^="/stills/"]').first()).toBeAttached();
  await expect(page.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:abdullahusmani74@gmail.com');
});

test('no serious accessibility violations', async ({ page }) => {
  await page.goto('/?test=1');
  // @axe-core/playwright is typed against its own playwright-core; the runtime API matches.
  const results = await new AxeBuilder({ page: page as never }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

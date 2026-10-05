import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { collectErrors, open, PHONE } from './site.ts';

test('every word is on the page, without WebGL too, and no phone number anywhere', async ({ page }) => {
  await open(page);
  await expect(page.locator('h1')).toContainText('Muhammad Abdullah Usmani');
  for (const kicker of ['Humanoid NPCs', 'Curriculum Council', 'Scenario generation', 'Simulated learners', 'Real-time voice']) {
    await expect(page.getByText(kicker, { exact: true }).first()).toBeAttached();
  }
  await expect(page.getByText('abdullahusmani74@gmail.com').first()).toBeAttached();
  const text = await page.locator('body').innerText();
  for (const re of PHONE) expect(text).not.toMatch(re);
});

test('the CV opens at #cv, has no phone number, passes axe, and leads back to the valley', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, '/#cv');
  await expect(page.locator('.cv-name')).toHaveText('Muhammad Abdullah Usmani');
  await expect(page.locator('.cv')).toContainText('abdullahusmani74@gmail.com');
  await expect(page.locator('.cv')).toContainText('Founding AI Engineer');
  const text = await page.locator('.cv').innerText();
  for (const re of PHONE) expect(text).not.toMatch(re);

  // The axe package brings its own copy of Playwright's types; the page is the same object.
  const axe = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).include('.cv').analyze();
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await page.locator('.cv-back').click();
  await expect(page.locator('.cv')).toHaveCount(0);
  await expect(page.locator('h1')).toContainText('Muhammad Abdullah Usmani');
  expect(errors).toEqual([]);
});

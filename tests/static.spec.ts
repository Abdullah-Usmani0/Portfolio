import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { collectErrors, open, PHONE, type SiteHook } from './site.ts';

test('every word is on the page, without WebGL too, and no phone number anywhere', async ({ page }) => {
  await open(page);
  await expect(page.locator('h1')).toContainText('Muhammad Abdullah Usmani');
  for (const kicker of ['AI coworkers', 'Curriculum Council', 'Scenario generation', 'Simulated learners', 'Real-time voice']) {
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

  await page.locator('.page-back').click();
  await expect(page.locator('.cv')).toHaveCount(0);
  await expect(page.locator('h1')).toContainText('Muhammad Abdullah Usmani');
  expect(errors).toEqual([]);
});

test('How it works explains all six systems plainly, passes axe, and leads back', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, '/#systems');
  await expect(page.locator('.systems h1')).toContainText('in plain words');
  await expect(page.locator('.systems .sys')).toHaveCount(6);
  for (const kicker of ['Curriculum Council', 'Scenario generation', 'Simulated learners', 'AI coworkers', 'Context engineering', 'Real-time voice']) {
    await expect(page.locator('.systems .sys .eyebrow', { hasText: kicker })).toHaveCount(1);
  }
  const text = await page.locator('.systems').innerText();
  for (const re of PHONE) expect(text).not.toMatch(re);

  const axe = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).include('.systems').analyze();
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await page.locator('.page-back').click();
  await expect(page.locator('.systems')).toHaveCount(0);
  await expect(page.locator('h1')).toContainText('Muhammad Abdullah Usmani');
  expect(errors).toEqual([]);
});

test('a scene card opens How it works at its own system', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.jump('learners'));
  await page.locator('#learners .read-plainly').click({ force: true });
  await expect(page.locator('#sys-learners')).toBeInViewport();
  expect(new URL(page.url()).hash).toBe('#systems/learners');
});

test('a shared /cv link closes with Back, to the valley', async ({ page }) => {
  await open(page, '/cv');
  await expect(page.locator('.cv-name')).toBeVisible();
  await page.locator('.page-back').click();
  await expect(page.locator('.cv')).toHaveCount(0);
  await expect(page.locator('h1')).toContainText('Muhammad Abdullah Usmani');
  expect(new URL(page.url()).pathname).toBe('/');
});

test('the sound starts with the first click, and turning it off is remembered', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  expect(await page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.sound)).toMatchObject({ on: true, playing: false, audio: 'none' });
  await page.locator('h1').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.sound.audio)).toBe('running');
  const speaker = page.locator('.nav [data-sound]');
  await expect(speaker).toHaveAttribute('aria-pressed', 'true');
  await speaker.click();
  await expect(speaker).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.sound.audio)).toBe('suspended');

  await page.reload();
  await page.waitForFunction(() => 'missingAnchors' in ((window as unknown as { __site?: object }).__site ?? {}));
  await page.locator('h1').click();
  expect(await page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.sound)).toMatchObject({ on: false, audio: 'none' });
  expect(errors).toEqual([]);
});

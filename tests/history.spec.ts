import { expect, test, type Page } from '@playwright/test';
import { collectErrors, open, type SiteHook } from './site.ts';

/** Browser Back and Forward, and the page's own ways back, never strand the visitor. */

const jump = (page: Page, id: string) => page.evaluate((s) => (window as unknown as { __site: SiteHook }).__site.jump(s), id);
const hash = (page: Page) => new URL(page.url()).hash;
/** Clicks a scene card's button once the card has faded in; a click while it is still hidden falls through. */
const press = async (page: Page, selector: string) => {
  const el = page.locator(selector);
  await expect(el).toBeVisible();
  await el.click();
};
const valley = async (page: Page) => {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).toContainText('Muhammad Abdullah Usmani');
};

test('a shared /cv link: after a click, the browser Back button goes to the valley', async ({ page }) => {
  await open(page, '/cv');
  await page.locator('.cv-name').click();
  await page.goBack();
  await valley(page);
  await expect(page.locator('.cv')).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/');
});

test('a shared /cv link: the page’s Back, then the browser’s, never brings the CV back', async ({ page }) => {
  await open(page, '/cv');
  await page.locator('.page-back').click();
  await valley(page);
  await page.goBack();
  expect(page.url()).not.toMatch(/\/cv|#cv/);
});

test('a valley first reached from a page starts at its top, not at the page’s scroll', async ({ page }) => {
  await open(page, '/systems');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.locator('.page-back').click();
  await valley(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('a dive watched from How it works leaves no address behind, and Back retraces the visit', async ({ page }) => {
  await open(page, '/#systems/voice');
  await page.locator('#sys-voice .sys-watch').click();
  await expect(page.locator('.dive.is-open .dive-title')).toHaveText('A call, not a chat');
  await page.locator('.dive-back').click();
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
  await expect.poll(() => hash(page)).toBe('');

  await jump(page, 'learners');
  await press(page, '#learners .read-plainly');
  await expect(page.locator('.systems')).toBeVisible();
  await page.locator('.page-back').click();
  await valley(page);
  await page.waitForTimeout(600);
  await expect(page.locator('.dive.is-open')).toHaveCount(0);

  await page.goBack();
  await expect(page.locator('.systems')).toBeVisible();
  await page.locator('.page-back').click();
  await valley(page);
});

test('the browser Back button closes a dive, and Forward opens it again', async ({ page }) => {
  await open(page);
  await jump(page, 'learners');
  await press(page, '#learners .more');
  await expect(page.locator('.dive.is-open .dive-title')).toHaveText('A cohort plays it first');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('.dive-title')).toHaveText('Five learners, five habits');

  await page.goBack();
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
  expect(page.url()).toContain('test=1');
  await valley(page);

  await page.goForward();
  await expect(page.locator('.dive.is-open .dive-title')).toHaveText('Five learners, five habits');
  await page.locator('.dive-back').click();
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
  await expect.poll(() => hash(page)).toBe('');
});

test('the nav scrolls without adding history', async ({ page, isMobile }) => {
  await open(page);
  const before = await page.evaluate(() => window.history.length);
  if (isMobile) {
    // On a phone only the name shows: it goes back to the top.
    await jump(page, 'learners');
    const y = await page.evaluate(() => window.scrollY);
    await expect(page.locator('.nav-name')).toBeVisible();
    await page.locator('.nav-name').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(y);
  } else {
    await expect(page.locator('nav a[href="#summit"]')).toBeVisible();
    await page.locator('nav a[href="#summit"]').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  }
  expect(await page.evaluate(() => window.history.length)).toBe(before);
  await expect.poll(() => hash(page)).toBe('');
});

test('a burst of Escapes on the CV goes back once, and stays on the site', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the nav links are hidden on a phone');
  await open(page);
  await page.locator('nav a[href="#cv"]').click();
  await expect(page.locator('.cv')).toBeVisible();
  await page.evaluate(() => {
    for (let k = 0; k < 3; k++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  await valley(page);
  await expect(page.locator('.cv')).toHaveCount(0);
  expect(page.url()).toContain('test=1');
});

test('where history writes are refused, Back still works and nothing throws', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the nav links are hidden on a phone');
  await page.addInitScript(() => {
    const refuse = () => {
      throw new DOMException('History is locked', 'SecurityError');
    };
    History.prototype.pushState = refuse;
    History.prototype.replaceState = refuse;
  });
  const errors = collectErrors(page);
  await open(page);
  await page.locator('nav a[href="#cv"]').click();
  await expect(page.locator('.cv')).toBeVisible();
  await page.locator('.page-back').click();
  await valley(page);
  await page.goBack();
  await expect(page.locator('.cv')).toHaveCount(0);

  await jump(page, 'learners');
  await press(page, '#learners .more');
  await expect(page.locator('.dive.is-open .dive-title')).toHaveText('A cohort plays it first');
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.locator('.dive-back').click();
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('after a dive the page scrolls again, even where Lenis never hears the end of its transition', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard scrolling');
  await open(page);
  // Older engines never fire the 1 ms transition Lenis waits for; this one is told not to either.
  await page.addStyleTag({ content: 'html.lenis { transition: none !important; }' });
  await jump(page, 'learners');
  await press(page, '#learners .more');
  await expect(page.locator('.dive.is-open')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('clip');
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y);
});

test('the browser never restores the scroll on its own', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the nav links are hidden on a phone');
  await open(page);
  await page.locator('nav a[href="#cv"]').click();
  await expect(page.locator('.cv')).toBeVisible();
  await page.locator('.page-back').click();
  await valley(page);
  expect(await page.evaluate(() => window.history.scrollRestoration)).toBe('manual');
});

test('a reloaded page goes back to the valley without adding history', async ({ page }) => {
  await open(page, '/#cv');
  await page.locator('.cv-name').click();
  const length = await page.evaluate(() => window.history.length);
  await page.reload();
  await page.waitForFunction(() => 'missingAnchors' in ((window as unknown as { __site?: object }).__site ?? {}));
  await page.locator('.page-back').click();
  await valley(page);
  expect(await page.evaluate(() => window.history.length)).toBe(length);
});

test('a dive opened from a shared address does not open again after a page round trip', async ({ page }) => {
  await open(page, '/#learners/cohort');
  await expect(page.locator('.dive.is-open .dive-title')).toHaveText('A cohort plays it first');
  await page.locator('.dive-back').click();
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
  await expect.poll(() => hash(page)).toBe('');
  await press(page, '#learners .read-plainly');
  await expect(page.locator('.systems')).toBeVisible();
  await page.locator('.page-back').click();
  await valley(page);
  await page.waitForTimeout(600);
  await expect(page.locator('.dive.is-open')).toHaveCount(0);
});

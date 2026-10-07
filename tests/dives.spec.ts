import { expect, test } from '@playwright/test';
import { collectErrors, DIVE_SCENES, open, type SiteHook } from './site.ts';

test('every dive opens from its scene, steps through to its end and closes, with every anchor in place', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  // The world registers its anchors as it draws its set pieces.
  await page.waitForFunction(() => document.documentElement.dataset.world === 'on');

  for (const scene of DIVE_SCENES) {
    await page.evaluate((s) => (window as unknown as { __site: SiteHook }).__site.jump(s), scene);
    await page.waitForTimeout(400);
    expect(await page.evaluate((s) => (window as unknown as { __site: SiteHook }).__site.missingAnchors(s), scene), `${scene}: anchors the world never registered`).toEqual([]);

    await page.locator(`#${scene} .more`).click();
    await expect(page.locator('.dive.is-open .dive-card')).toBeVisible();
    const count = await page.locator('.dive-dots li').count();
    expect(count, scene).toBeGreaterThanOrEqual(7);

    const next = page.getByRole('button', { name: 'Next step' });
    const titles: string[] = [];
    for (let k = 0; k < count; k++) {
      const title = (await page.locator('.dive-title').textContent()) ?? '';
      titles.push(title);
      if (k < count - 1) {
        await next.click();
        await expect(page.locator('.dive-title')).not.toHaveText(title);
      }
    }
    expect(new Set(titles).size, `${scene}: every step has its own title`).toBe(count);
    await expect(next).toBeDisabled();

    await page.locator('.dive-back').click();
    await expect(page.locator('.dive.is-open')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('back from the CV or How it works lands where the visitor was, without rebuilding the valley', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.waitForFunction(() => document.documentElement.dataset.world === 'on');
  await page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.jump('learners'));
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.s);
  await page.evaluate(() => ((window as unknown as { __canvas?: Element | null }).__canvas = document.querySelector('canvas.world')));

  for (const [link, shown] of [
    ['nav a[href="#cv"]', '.cv'],
    ['nav a[href="#systems"]', '.systems'],
  ] as const) {
    await page.locator(link).click();
    await expect(page.locator(shown)).toBeVisible();
    await expect(page.locator('main')).toBeHidden();
    await page.locator('.page-back').click();
    await expect(page.locator(shown)).toHaveCount(0);
    await expect(page.locator('main')).toBeVisible();
    const after = await page.evaluate(() => (window as unknown as { __site: SiteHook }).__site.s);
    expect(Math.abs(after - before), `${shown}: back to the same scene`).toBeLessThan(0.2);
  }
  expect(await page.evaluate(() => document.querySelector('canvas.world') === (window as unknown as { __canvas?: Element | null }).__canvas), 'the same world, not a rebuilt one').toBe(true);

  // How it works sends the visitor back into a dive.
  await page.goto('/?test=1#systems/voice');
  await page.locator('#sys-voice .sys-watch').click();
  await expect(page.locator('.dive.is-open .dive-title')).toHaveText('A call, not a chat');
  expect(errors).toEqual([]);
});

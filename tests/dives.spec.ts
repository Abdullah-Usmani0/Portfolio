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

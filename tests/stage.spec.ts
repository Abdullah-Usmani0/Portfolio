import { expect, test, type Page } from '@playwright/test';

interface StageHook {
  ready: boolean;
  tier: string;
  act: number;
  tod: number;
  progress: number;
  frames: number;
  cam: [number, number, number];
}

const hook = (page: Page) => page.evaluate(() => (window as unknown as { __stage: StageHook }).__stage);

/** Mean luminance and spread of the canvas, read back through a tiny 2D canvas. */
const canvasStats = (page: Page) =>
  page.evaluate(() => {
    const gl = document.querySelector('canvas');
    if (!gl) return null;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 36;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(gl, 0, 0, 64, 36);
    const { data } = ctx.getImageData(0, 0, 64, 36);
    let sum = 0;
    let sq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
      sum += y;
      sq += y * y;
    }
    const mean = sum / n;
    return { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
  });

async function scrollToSection(page: Page, i: number) {
  await page.evaluate((index) => {
    const sec = document.querySelectorAll('main > section')[index];
    if (!sec) throw new Error(`no section ${index}`);
    const r = sec.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: 'instant' });
  }, i);
}

test('the valley renders in real WebGL and the journey reaches every act', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?test=1&tier=low');
  await page.waitForFunction(() => (window as unknown as { __stage?: StageHook }).__stage?.ready === true, null, { timeout: 180_000 });

  const first = await hook(page);
  expect(first.tier).toBe('low');
  await expect.poll(async () => (await hook(page)).frames, { timeout: 60_000 }).toBeGreaterThan(first.frames + 3);

  // Not black and not a flat fill: there is a lit scene on the canvas.
  const px = await canvasStats(page);
  expect(px).not.toBeNull();
  expect(px!.mean).toBeGreaterThan(30);
  expect(px!.std).toBeGreaterThan(8);

  const sections = await page.locator('main > section').count();
  expect(sections).toBe(6);
  for (const i of [1, 3, 5]) {
    await scrollToSection(page, i);
    await expect.poll(async () => (await hook(page)).act, { timeout: 60_000 }).toBe(i);
  }
  // Night by the last act, and the chapter rail agrees.
  expect((await hook(page)).tod).toBeGreaterThan(0.95);
  await expect(page.getByRole('navigation', { name: 'Chapters' }).locator('[aria-current="step"]')).toContainText('A mind');
  expect(errors).toEqual([]);
});

test('the sun dial takes over time of day from the keyboard, and Escape gives it back', async ({ page }) => {
  await page.goto('/?test=1&tier=low');
  await page.waitForFunction(() => (window as unknown as { __stage?: StageHook }).__stage?.ready === true, null, { timeout: 180_000 });
  const dial = page.getByRole('slider', { name: 'Time of day' });
  await dial.focus();
  await page.keyboard.press('End');
  await expect(dial).toHaveAttribute('aria-valuenow', '100');
  await expect.poll(async () => (await hook(page)).tod).toBeGreaterThan(0.99);
  await expect(page.getByRole('button', { name: 'Follow scroll' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await hook(page)).tod).toBeLessThan(0.05);
});

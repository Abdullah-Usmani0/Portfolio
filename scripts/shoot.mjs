#!/usr/bin/env node
// Screenshot sweep: loads the built site in headless Chromium (SwiftShader WebGL), waits for
// the stage to report ready, then captures each act. State is asserted through the
// read-only `window.__stage` hook, not by guessing from pixels.
//
//   node scripts/shoot.mjs --url http://127.0.0.1:4173 --out shots --tier mid --size 1600x900
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://127.0.0.1:4173');
const out = arg('out', 'shots');
const tier = arg('tier', 'mid');
const [width, height] = arg('size', '1600x900').split('x').map(Number);
const acts = (arg('acts', '0,1,2,3,4') ?? '').split(',').map(Number);
const settleMs = Number(arg('settle', '6000'));
const extra = arg('query', '');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const t0 = Date.now();
await page.goto(`${url}/?test=1&tier=${tier}${extra ? `&${extra}` : ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__stage?.ready && window.__stage.frames > 8, null, { timeout: 180_000 });
console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`, await page.evaluate(() => window.__stage));
// Let the intro crane finish.
await page.waitForTimeout(settleMs);

for (const act of acts) {
  await page.evaluate((i) => {
    const sec = document.querySelectorAll('main > section')[i];
    if (!sec) return;
    const r = sec.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: 'instant' });
  }, act);
  const f0 = await page.evaluate(() => window.__stage.frames);
  await page.waitForTimeout(settleMs);
  const s = await page.evaluate(() => window.__stage);
  const fps = ((s.frames - f0) / (settleMs / 1000)).toFixed(1);
  const file = join(out, `act${act}.png`);
  await page.screenshot({ path: file });
  console.log(`act ${act}: stage act=${s.act} tod=${s.tod.toFixed(2)} ~${fps} fps -> ${file}`);
}

const errors = logs.filter((l) => /error|warn/i.test(l));
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();

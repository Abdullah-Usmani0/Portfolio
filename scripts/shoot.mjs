#!/usr/bin/env node
// Screenshot sweep for reviewing the page: hero after the intro, then each section.
// --file renders the artifact page inside a copy of the artifact host's skeleton, so the
// review sees what the live link shows.
//
//   node scripts/shoot.mjs --file dist-artifact/page.html --out shots --size 1440x900
//   node scripts/shoot.mjs --url http://127.0.0.1:4173 --out shots --size 390x844
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const out = arg('out', 'shots');
const [width, height] = arg('size', '1440x900').split('x').map(Number);
const sections = arg('sections', 'npcs,councils,scenarios,learners,voice,mind,ascent,summit').split(',').filter(Boolean);
const reduced = process.argv.includes('--reduced');
mkdirSync(out, { recursive: true });

let url = arg('url', '');
const file = arg('file', '');
if (file) {
  // The host's skeleton: charset + viewport meta and its small reset (see the Artifact docs).
  const shell = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui;background:#fafaf9}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${readFileSync(file, 'utf8')}</body></html>`;
  const wrapped = resolve(out, '_artifact.html');
  writeFileSync(wrapped, shell);
  url = pathToFileURL(wrapped).href;
}
if (!url) throw new Error('pass --file or --url');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
  reducedMotion: reduced ? 'reduce' : 'no-preference',
  isMobile: width < 600,
  hasTouch: width < 600,
});
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

// --query a=1&b=2: extra URL parameters for the page (debug switches).
const query = arg('query', '');
await page.goto(`${url}${url.includes('?') ? '&' : '?'}test=1${query ? `&${query}` : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__site !== undefined, null, { timeout: 30_000 });
await page.waitForTimeout(Number(arg('intro', '4200')));
const tag = `${width}x${height}`;
await page.screenshot({ path: join(out, `${tag}-00-hero.png`) });
console.log('hero', await page.evaluate(() => ({ look: window.__site.look, smooth: window.__site.smooth })));

for (const [i, id] of sections.entries()) {
  await page.evaluate((s) => window.__site.jump(s), id);
  await page.waitForTimeout(Number(arg('settle', '1800')));
  const name = join(out, `${tag}-${String(i + 1).padStart(2, '0')}-${id}.png`);
  await page.screenshot({ path: name });
  console.log(id, await page.evaluate(() => window.__site.look));
}

// --at 6.5,7.5: shoot the journey part-way between scenes (scene positions, 0 = the first).
for (const at of arg('at', '').split(',').filter(Boolean).map(Number)) {
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-scene]')].map((el) => el.id));
  const yOf = async (id) => {
    await page.evaluate((s) => window.__site.jump(s), id);
    await page.waitForTimeout(300);
    return page.evaluate(() => window.scrollY);
  };
  const a = Math.floor(at);
  const b = Math.min(ids.length - 1, a + 1);
  const ya = await yOf(ids[a]);
  const yb = await yOf(ids[b]);
  await page.evaluate((y) => window.scrollTo(0, y), ya + (yb - ya) * (at - a));
  await page.waitForTimeout(Number(arg('settle', '1800')));
  await page.screenshot({ path: join(out, `${tag}-at-${String(at).replace('.', '_')}.png`) });
  console.log('at', at, await page.evaluate(() => window.__site.s.toFixed(3)));
}

// --dive a,b: open each scene's deep dive and shoot every step (or --steps 0,3,7).
for (const dive of arg('dive', '').split(',').filter(Boolean)) {
  await page.evaluate((s) => window.__site.jump(s), dive);
  await page.waitForTimeout(1500);
  await page.evaluate((s) => window.__site.dive(s, 0), dive);
  await page.waitForSelector('.dive-dots li');
  const count = await page.evaluate(() => document.querySelectorAll('.dive-dots li').length);
  const steps = arg('steps', '') ? arg('steps', '').split(',').map(Number).filter((k) => k < count) : [...Array(count).keys()];
  for (const step of steps) {
    await page.evaluate(([s, k]) => window.__site.dive(s, k), [dive, step]);
    await page.waitForTimeout(Number(arg('settle', '2600')));
    await page.screenshot({ path: join(out, `${tag}-dive-${dive}-${String(step).padStart(2, '0')}.png`) });
    console.log('dive', dive, step, await page.evaluate(() => document.querySelector('.dive-title')?.textContent));
    // Labels that are on the step but not readable right now (crowded out, or not yet in).
    const faded = await page.evaluate(() =>
      [...document.querySelectorAll('.dive-label')].filter((el) => el.style.visibility === 'hidden' || Number(el.style.opacity || 1) < 0.5).map((el) => el.textContent),
    );
    if (faded.length) console.log('  faded:', faded.join(' | '));
  }
  await page.evaluate(() => window.__site.dive(null));
  await page.waitForTimeout(2200);
}

if (logs.length) console.log(logs.slice(0, 20).join('\n'));
await browser.close();

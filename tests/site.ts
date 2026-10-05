import type { Page } from '@playwright/test';

/** The read-only test hook the page exposes under `?test=1` (see src/main.tsx). */
export interface SiteHook {
  dive: (scene: string | null, step?: number) => void;
  jump: (id: string) => void;
  missingAnchors: (scene: string) => string[];
}

/** Every scene with a deep dive, in the order the journey meets them. */
export const DIVE_SCENES = ['councils', 'scenarios', 'learners', 'npcs', 'mind', 'voice', 'ascent'] as const;

/** Errors the page reports while a test runs; a clean page reports none. Without WebGL the
 * world says once that it cannot start, and the page carries on without it: that is expected. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/WebGL context/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** Opens the page with the test hook, and waits for it. */
export async function open(page: Page, path = '/'): Promise<void> {
  // The query goes before any #hash, or it becomes part of the hash.
  const [where = '/', hash] = path.split('#');
  await page.goto(`${where}${where.includes('?') ? '&' : '?'}test=1${hash ? `#${hash}` : ''}`);
  await page.waitForFunction(() => 'missingAnchors' in ((window as unknown as { __site?: object }).__site ?? {}));
}

/** No phone number, in any format (the same rule the content tests hold the copy to). */
export const PHONE = [/\+\d{1,3}[\s-]\d{2}[\s-]?\d{3}/, /(?:\d[\s-]?){9,}/];

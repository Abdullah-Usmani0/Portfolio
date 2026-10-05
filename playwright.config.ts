import { defineConfig } from '@playwright/test';

/** CPU WebGL in headless Chromium — slow, but real WebGL2, so the stage is exercised end to end. */
const swiftshader = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests',
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1280, height: 720 } },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    // Real WebGL: every dive flies, steps through and closes, with every anchor in place.
    { name: 'desktop-webgl', testMatch: /dives\.spec\.ts/, use: { launchOptions: { args: swiftshader } } },
    {
      name: 'reduced-motion',
      testMatch: /motion\.spec\.ts/,
      use: { launchOptions: { args: swiftshader }, contextOptions: { reducedMotion: 'reduce' } },
    },
    // Without WebGL, and on a phone: every word is still there, and the CV prints.
    {
      name: 'no-webgl',
      testMatch: /static\.spec\.ts/,
      use: { launchOptions: { args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis'] } },
    },
    {
      name: 'mobile',
      testMatch: /static\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions: { args: ['--disable-3d-apis'] } },
    },
  ],
});

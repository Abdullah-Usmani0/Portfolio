import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App.tsx';
import { detectTier } from './stage/device.ts';
import { stats } from './stage/stats.ts';
import { stage } from './stage/store.ts';

// Pick the quality tier before anything mounts, so the canvas starts at the right DPR.
stage.getState().setTier(detectTier());

// A read-only test hook (Playwright asserts on state, not pixels) — dev, ?debug or ?test only.
const params = new URLSearchParams(window.location.search);
if (import.meta.env.DEV || params.has('debug') || params.has('test')) {
  // Look-dev only: drive the sun dial from a script.
  Object.assign(window, {
    __setTod: (t: number | null) => stage.getState().setTodOverride(t),
    __setMindPond: (p: boolean | null) => stage.getState().setMindPond(p),
  });
  Object.defineProperty(window, '__stage', {
    configurable: true,
    get: () => {
      const s = stage.getState();
      return { ready: s.ready, tier: s.tier, act: s.act, tod: s.tod, progress: s.progress, frames: stats.frames, cam: stats.cam };
    },
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

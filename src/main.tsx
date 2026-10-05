import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App.tsx';
import { scroller } from './motion/SmoothScroll.tsx';
import { DIVES } from './content/dives.ts';
import { closeDive, openDive, progress, useDive, useDay } from './motion/store.ts';
import { anchorOf } from './world/anchors.ts';

// A read-only hook for tests and screenshots: state, not pixels. Dev, ?debug or ?test only.
const params = new URLSearchParams(window.location.search);
if (import.meta.env.DEV || params.has('debug') || params.has('test')) {
  Object.defineProperty(window, '__site', {
    configurable: true,
    get: () => ({
      look: useDay.getState().label,
      dark: useDay.getState().dark,
      smooth: document.documentElement.classList.contains('lenis'),
      /** Where the journey is: 0 = the first scene centred, 1 = the next, … */
      s: progress.s,
      /** Open a scene's deep dive at a step, or close it. */
      dive: (scene: string | null, step = 0) => (scene ? openDive(scene, step) : closeDive()),
      diveState: () => useDive.getState(),
      /** Anchors a scene's dive flies to, labels or pins that the live world has not registered. */
      missingAnchors: (scene: string) => {
        const dive = DIVES[scene];
        if (!dive) return [`no dive for ${scene}`];
        const used = new Set<string>();
        for (const step of dive.steps) {
          if (step.focus) used.add(step.focus);
          for (const label of step.labels ?? []) used.add(label.anchor);
        }
        for (const pin of dive.pins ?? []) used.add(pin.anchor);
        return [...used].filter((id) => !anchorOf(scene, id));
      },
      /** Jump straight to a section (by id), its middle in the middle of the screen. */
      jump: (id: string) => {
        const el = document.getElementById(id);
        if (el) scroller.lenis?.scrollTo(el, { offset: (el.offsetHeight - window.innerHeight) / 2, immediate: true, force: true });
      },
    }),
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App.tsx';
import { scroller } from './motion/SmoothScroll.tsx';
import { useDay } from './motion/store.ts';

// A read-only hook for tests and screenshots: state, not pixels. Dev, ?debug or ?test only.
const params = new URLSearchParams(window.location.search);
if (import.meta.env.DEV || params.has('debug') || params.has('test')) {
  Object.defineProperty(window, '__site', {
    configurable: true,
    get: () => ({
      look: useDay.getState().label,
      dark: useDay.getState().dark,
      smooth: document.documentElement.classList.contains('lenis'),
      /** Jump straight to a section (by id) without the glide. */
      jump: (id: string) => scroller.lenis?.scrollTo(`#${id}`, { immediate: true, force: true }),
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

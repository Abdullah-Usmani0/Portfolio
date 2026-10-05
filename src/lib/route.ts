import { useSyncExternalStore } from 'react';

/** True on the printable CV: `#cv` (works inside a single-file page too) or a `/cv` path. */
export const isCvRoute = (loc: Pick<Location, 'hash' | 'pathname'>) => loc.hash === '#cv' || /\/cv\/?$/.test(loc.pathname);

const subscribe = (on: () => void) => {
  window.addEventListener('hashchange', on);
  window.addEventListener('popstate', on);
  return () => {
    window.removeEventListener('hashchange', on);
    window.removeEventListener('popstate', on);
  };
};

/** Whether the page should show the printable CV instead of the valley. */
export function useCvRoute(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isCvRoute(window.location),
    () => false,
  );
}

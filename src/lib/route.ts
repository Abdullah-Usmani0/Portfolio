import { useSyncExternalStore } from 'react';

/** The valley, or one of the two reading pages laid over it. */
export type Page = 'valley' | 'cv' | 'systems';

const PAGES = ['cv', 'systems'] as const;
const PAGE_PATH = /\/(cv|systems)\/?$/;

/**
 * Which page an address shows. The hash wins (`#cv`, `#systems`, `#systems/councils`), so it
 * works inside a single-file page too; otherwise a `/cv` or `/systems` path; otherwise the valley.
 */
export function pageOf(loc: Pick<Location, 'hash' | 'pathname'>): Page {
  const head = loc.hash.slice(1).split('/')[0];
  if (head === 'cv' || head === 'systems') return head;
  if (loc.hash.length > 1) return 'valley';
  const m = loc.pathname.match(PAGE_PATH);
  return m ? (m[1] as Page) : 'valley';
}

/** The part of a `#systems/<scene>` address after the page: which system to open at. */
export function sectionOf(loc: Pick<Location, 'hash'>): string | undefined {
  const [head, section] = loc.hash.slice(1).split('/');
  return PAGES.includes(head as (typeof PAGES)[number]) && section ? section : undefined;
}

/** The valley's own address from wherever a page was opened: `/cv` and `/systems` become `/`. */
export function valleyPath(loc: Pick<Location, 'pathname' | 'search'>): string {
  return `${loc.pathname.replace(PAGE_PATH, '/')}${loc.search}`;
}

const CHANGE = 'pagechange';
const emit = () => window.dispatchEvent(new Event(CHANGE));

/** Moves the address; where history is locked (a sandboxed preview), it moves just the hash. */
function go(mode: 'push' | 'replace', state: unknown, url: string) {
  try {
    if (mode === 'push') window.history.pushState(state, '', url);
    else window.history.replaceState(state, '', url);
  } catch {
    window.location.hash = new URL(url, window.location.href).hash;
  }
}

/** Where the visitor was in the valley when a page covered it, so Back returns them there. */
let valleyY = 0;
let shown: Page = typeof window === 'undefined' ? 'valley' : pageOf(window.location);

if (typeof window !== 'undefined') {
  // The page keeps its own scroll; the browser must not move it while history is traversed,
  // or the valley's position is lost before it can be remembered.
  try {
    window.history.scrollRestoration = 'manual';
  } catch {
    // A locked-down frame keeps the browser's own scroll restoration; Back still works.
  }
  // Registered before React subscribes, so the valley's scroll is read before it is hidden.
  const track = () => {
    const next = pageOf(window.location);
    if (shown === 'valley' && next !== 'valley') valleyY = window.scrollY;
    shown = next;
  };
  window.addEventListener('popstate', track);
  window.addEventListener('hashchange', track);
}

/** The valley scroll position to return to. */
export const valleyScroll = () => valleyY;

/** Opens a page. From the valley it is a new history entry (so Back returns); between pages it replaces. */
export function openPage(page: Exclude<Page, 'valley'>, section?: string): void {
  const url = `${window.location.pathname}${window.location.search}#${page}${section ? `/${section}` : ''}`;
  if (shown === 'valley') {
    valleyY = window.scrollY;
    go('push', { fromValley: true }, url);
  } else {
    go('replace', { fromValley: window.history.state?.fromValley === true }, url);
  }
  shown = page;
  emit();
}

/**
 * Back to the valley. A visitor who came from it goes back through history, to where they
 * were; one who arrived on a page directly (a shared `/cv` link) goes to the valley's address.
 * With a hash (a dive, `#councils/town`) it opens there instead, as a new entry.
 */
export function toValley(hash?: string): void {
  if (!hash && window.history.state?.fromValley === true) {
    window.history.back();
    return;
  }
  go('push', null, `${valleyPath(window.location)}${hash ?? ''}`);
  shown = 'valley';
  emit();
}

const subscribe = (on: () => void) => {
  window.addEventListener('hashchange', on);
  window.addEventListener('popstate', on);
  window.addEventListener(CHANGE, on);
  return () => {
    window.removeEventListener('hashchange', on);
    window.removeEventListener('popstate', on);
    window.removeEventListener(CHANGE, on);
  };
};

/** The page on screen, kept in step with the address. */
export function usePage(): Page {
  return useSyncExternalStore(
    subscribe,
    () => pageOf(window.location),
    () => 'valley',
  );
}

/** The section a page was opened at (`#systems/voice` → `voice`). */
export function useSection(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => sectionOf(window.location),
    () => undefined,
  );
}

/** A plain left click, the only one a page link takes over; the rest open new tabs as usual. */
export const isPlainClick = (e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

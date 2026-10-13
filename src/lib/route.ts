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

/** The dive a valley address opens (`#voice/call`), if it names one. */
export function diveOf(loc: Pick<Location, 'hash' | 'pathname'>): { scene: string; step: string } | undefined {
  const m = pageOf(loc) === 'valley' ? loc.hash.match(/^#([\w-]+)\/([\w-]+)$/) : null;
  return m ? { scene: m[1]!, step: m[2]! } : undefined;
}

/*
 * History, in three kinds of entry, all in this one document:
 * - the valley (`/`): no state;
 * - a page (`#cv`, `#systems/x`, `/cv`): `{fromValley: true}`, and the entry below it is always the valley;
 * - a dive (`#scene/step`): `{dive: DOC}` when this load pushed it from the dive's button, so its
 *   own Back can step out of it; none when it came from an address.
 * Everything that writes history goes through here.
 */
type Entry = { fromValley?: true; dive?: string } | null;

const CHANGE = 'pagechange';
const emit = () => window.dispatchEvent(new Event(CHANGE));

/** This page load. A dive entry pushed before a reload belongs to another load and is replaced, not stepped out of. */
const DOC = Math.random().toString(36).slice(2);
/** Our own `history.back()` is on its way: nothing else moves until it lands, so two presses step back once. */
let backing = false;
/** A history write was refused (a sandboxed preview): from then on only the hash moves. */
let locked = false;

/** This document's address with a new hash; for the valley, `/cv` and `/systems` become `/`. */
function here(hash: string, valley = false): URL {
  const url = new URL(window.location.href);
  if (valley) url.pathname = url.pathname.replace(PAGE_PATH, '/');
  url.hash = hash;
  return url;
}

/** Moves the address. Where history is locked, it moves just the hash: `#valley` stands in for none, since an empty hash would jump to the top or reload. */
function go(mode: 'push' | 'replace', state: Entry, url: URL): void {
  try {
    if (mode === 'push') window.history.pushState(state, '', url);
    else window.history.replaceState(state, '', url);
  } catch {
    locked = true;
    const hash = url.hash || '#valley';
    try {
      if (mode === 'push') window.location.hash = hash;
      else window.location.replace(`${window.location.href.split('#')[0]}${hash}`);
    } catch {
      // Nothing left to try; the page carries on where it is.
    }
  }
}

function back(): void {
  backing = true;
  window.history.back();
}

/** Where the visitor was in the valley when a page covered it, so Back returns them there. */
let valleyY = 0;
let shown: Page = typeof window === 'undefined' ? 'valley' : pageOf(window.location);
let built = shown === 'valley';

/** Keeps the valley's place when a page covers it; a valley never built yet starts at its top, not at the page's scroll. */
function arrive(next: Page): void {
  if (shown === 'valley' && next !== 'valley') valleyY = window.scrollY;
  if (next === 'valley' && !built) {
    built = true;
    window.scrollTo(0, 0);
  }
  shown = next;
}

if (typeof window !== 'undefined') {
  // The page keeps its own scroll; the browser must not move it while history is traversed,
  // or the valley's position is lost before it can be remembered.
  try {
    window.history.scrollRestoration = 'manual';
  } catch {
    // A locked-down frame keeps the browser's own scroll restoration; Back still works.
  }

  // A page opened straight from a link has nothing under it, so Back would leave the site or do
  // nothing. On the visitor's first click or key press it gets the valley beneath it: Chrome
  // skips history a page adds before anyone interacts with it.
  if (shown !== 'valley' && window.history.state?.fromValley !== true) {
    const seed = () => {
      window.removeEventListener('click', seed, true);
      window.removeEventListener('keydown', seed, true);
      if (pageOf(window.location) === 'valley' || window.history.state?.fromValley === true) return;
      const page = window.location.href;
      try {
        window.history.replaceState(null, '', here('', true));
        window.history.pushState({ fromValley: true }, '', page);
      } catch {
        // Locked: the page's own Back replaces the address instead.
      }
    };
    window.addEventListener('click', seed, true);
    window.addEventListener('keydown', seed, true);
  }

  // Registered before React subscribes, so the valley's scroll is read before it is hidden.
  const track = () => arrive(pageOf(window.location));
  window.addEventListener('popstate', () => {
    backing = false;
    track();
  });
  window.addEventListener('hashchange', track);
  window.addEventListener('pageshow', () => {
    backing = false;
  });
}

/** The valley scroll position to return to. */
export const valleyScroll = () => valleyY;

/** Opens a page. From the valley it is a new history entry (so Back returns); between pages it replaces. */
export function openPage(page: Exclude<Page, 'valley'>, section?: string): void {
  if (backing) return;
  const fromValley = shown === 'valley';
  arrive(page);
  const url = here(`#${page}${section ? `/${section}` : ''}`, true);
  if (fromValley) go('push', { fromValley: true }, url);
  else go('replace', window.history.state as Entry, url);
  emit();
}

/** How it works keeps the system on screen in its address, so it can be shared. */
export function showSection(id: string): void {
  if (!backing) go('replace', window.history.state as Entry, here(`#systems/${id}`, true));
}

/**
 * Back to the valley. A visitor who came from it goes back through history, to where they
 * were; otherwise the page's address becomes the valley's, so Back never brings the page back.
 * With a hash (a dive, `#councils/town`) it opens there instead, as a new entry.
 */
export function toValley(hash?: string): void {
  if (backing) return;
  if (!hash && window.history.state?.fromValley === true) {
    back();
    return;
  }
  arrive('valley');
  go(hash ? 'push' : 'replace', null, here(hash ?? '', true));
  emit();
}

/** A dive's step in the address: a new entry when the dive opens from its button, then replaced step by step. */
export function showDive(scene: string, step: string): void {
  if (backing) return;
  const url = here(`#${scene}/${step}`, true);
  if (diveOf(window.location) || locked) go('replace', window.history.state as Entry, url);
  else go('push', { dive: DOC }, url);
}

/** A closed dive leaves no address behind: it steps out of its own entry, or the address becomes the valley's. */
export function leaveDiveAddress(): void {
  if (backing || !diveOf(window.location)) return;
  if (window.history.state?.dive === DOC) back();
  else go('replace', null, here('', true));
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

import { create } from 'zustand';
import { pageOf } from '@/lib/route.ts';
import { progress, useDay, useDive } from '@/motion/store.ts';
import { mixAt } from './mix.ts';
import { createSoundscape, type Soundscape } from './soundscape.ts';

const KEY = 'valley-sound';

/** The visitor's choice: on, unless they turned it off. Blocked storage just means "on" for this visit. */
function readChoice(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveChoice(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the choice lasts until the page is closed.
  }
}

const AudioCtx: typeof AudioContext | undefined =
  typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

/**
 * Sound on the page: whether the visitor wants it, and whether it is playing. It is on by
 * default, but a browser lets sound start only from a click, tap or key press, so it waits
 * for the first one.
 */
export const useSound = create<{ on: boolean; playing: boolean; supported: boolean }>(() => ({
  on: typeof window === 'undefined' ? false : readChoice(),
  playing: false,
  supported: Boolean(AudioCtx),
}));

let ctx: AudioContext | null = null;
let scape: Soundscape | null = null;

/** Where the visitor is and what is on screen, which is all the mix needs. */
function moment() {
  return {
    s: progress.s,
    dark: useDay.getState().dark,
    diving: useDive.getState().scene !== null,
    away: pageOf(window.location) !== 'valley',
  };
}

function mix(ease?: number, silent = false) {
  if (!ctx || !scape) return;
  const now = moment();
  const { master, levels, night } = mixAt(now);
  scape.setMix({ master: silent ? 0 : master, levels, dark: now.dark, night }, ctx.currentTime, ease);
}

const settle = () => useSound.setState({ playing: ctx?.state === 'running' });

/** Starts or resumes the sound. Browsers require this to run inside a click, tap or key press. */
function start() {
  if (!AudioCtx) return;
  if (!ctx) {
    try {
      ctx = new AudioCtx({ latencyHint: 'playback' });
    } catch {
      return;
    }
    scape = createSoundscape(ctx);
    ctx.addEventListener('statechange', settle);
    // The mix follows the journey; the voices are scheduled a little ahead of time.
    window.setInterval(() => useSound.getState().on && mix(), 120);
    window.setInterval(() => ctx && scape && ctx.state === 'running' && scape.schedule(ctx.currentTime, ctx.currentTime + 0.8), 250);
  }
  // A slow fade in from silence: the valley is already there when the sound arrives.
  void ctx.resume().then(() => {
    settle();
    mix(1.2);
  });
}

/** Fades out, then suspends the audio entirely, so a silent page costs nothing. */
function stop() {
  if (!ctx) return;
  mix(0.2, true);
  window.setTimeout(() => {
    if (!useSound.getState().on) void ctx?.suspend().then(settle);
  }, 900);
}

/** The sound button: the first press starts the sound if it is waiting; after that it turns it off and on. */
export function toggleSound() {
  const { on, playing } = useSound.getState();
  if (on && !playing) {
    start();
    return;
  }
  saveChoice(!on);
  useSound.setState({ on: !on });
  if (on) stop();
  else start();
}

/** Waits for the visitor's first click, tap or key press, and follows the tab being hidden. */
export function initSound() {
  if (!AudioCtx) return;
  const unlock = (e: Event) => {
    // The sound button handles its own press.
    if (e.target instanceof Element && e.target.closest('[data-sound]')) return;
    const { on, playing } = useSound.getState();
    if (on && !playing) start();
  };
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().then(settle);
    else if (useSound.getState().on) void ctx.resume().then(settle);
  });
}

/** For tests: the visitor's choice and the audio's real state. */
export const soundState = () => ({ on: useSound.getState().on, playing: useSound.getState().playing, audio: ctx?.state ?? 'none' });

import { SCENES } from '@/world/journey.ts';

/** Every sound in the valley. Each is drawn in code by the soundscape; this file only says how loud. */
export const LAYERS = ['wind', 'river', 'waterfall', 'windmill', 'birds', 'crickets', 'lake', 'owl', 'bell', 'pad', 'music'] as const;
export type Layer = (typeof LAYERS)[number];
export type Levels = Readonly<Record<Layer, number>>;

const silent: Levels = { wind: 0, river: 0, waterfall: 0, windmill: 0, birds: 0, crickets: 0, lake: 0, owl: 0, bell: 0, pad: 0, music: 0 };
const at = (levels: Partial<Levels>): Levels => ({ ...silent, ...levels });

/**
 * What each scene sounds like, 0..1 per layer. The river runs along the valley floor, the
 * windmill turns on the farm, the gorge falls by the proving grounds, the bell hangs in the
 * village and the lake laps at the stage; birds sing by day and crickets take over at dusk.
 * Music waits for the summit: a few piano notes at sunrise, rising over the last of the climb.
 */
export const SCENE_SOUNDS: Readonly<Record<string, Levels>> = {
  top: at({ wind: 0.55, river: 0.2, waterfall: 0.35, birds: 0.45, pad: 0.6 }),
  councils: at({ wind: 0.3, river: 0.55, waterfall: 0.1, birds: 0.6, pad: 0.55 }),
  scenarios: at({ wind: 0.35, river: 0.45, waterfall: 0.05, windmill: 0.9, birds: 0.55, pad: 0.5 }),
  learners: at({ wind: 0.3, river: 0.35, waterfall: 0.85, windmill: 0.1, birds: 0.35, pad: 0.5 }),
  npcs: at({ wind: 0.25, river: 0.4, waterfall: 0.1, birds: 0.15, crickets: 0.5, owl: 0.3, bell: 0.7, pad: 0.55 }),
  mind: at({ wind: 0.2, river: 0.25, crickets: 0.8, lake: 0.2, owl: 0.5, bell: 0.1, pad: 0.7 }),
  voice: at({ wind: 0.2, river: 0.15, crickets: 0.65, lake: 0.85, owl: 0.45, pad: 0.6 }),
  ascent: at({ wind: 0.8, river: 0.05, waterfall: 0.15, crickets: 0.15, owl: 0.15, pad: 0.55 }),
  summit: at({ wind: 0.7, birds: 0.2, pad: 0.75, music: 1 }),
};

/** The loudest the whole valley ever plays: ambience, not a soundtrack. */
export const MASTER = 0.32;
/** An open dive is about its words: the valley steps back. */
export const DIVE_DUCK = 0.6;
/** Behind the CV or How it works, the valley is still there, quietly. */
export const PAGE_DUCK = 0.4;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface Moment {
  /** Where the journey is: 0 = the first scene centred, 1 = the next, … */
  s: number;
  /** Whether the sky is dark: birds only sing in daylight, crickets and the owl only at night. */
  dark: boolean;
  /** A deep dive is open. */
  diving: boolean;
  /** A reading page covers the valley. */
  away: boolean;
}

/** How loud everything should be at this moment of the journey. */
export function mixAt({ s, dark, diving, away }: Moment): { master: number; levels: Levels } {
  const last = SCENES.length - 1;
  const p = Math.min(last, Math.max(0, Number.isFinite(s) ? s : 0));
  const i = Math.min(last - 1, Math.floor(p));
  const t = smooth(p - i);
  const a = SCENE_SOUNDS[SCENES[i]!.id] ?? silent;
  const b = SCENE_SOUNDS[SCENES[i + 1]!.id] ?? silent;
  const levels = Object.fromEntries(LAYERS.map((k) => [k, clamp01(a[k] + (b[k] - a[k]) * t)])) as Record<Layer, number>;
  if (dark) levels.birds = 0;
  else {
    levels.crickets = 0;
    levels.owl = 0;
  }
  const master = MASTER * (diving ? DIVE_DUCK : 1) * (away ? PAGE_DUCK : 1);
  return { master, levels };
}

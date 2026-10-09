/**
 * The journey: one scene per section of the page, laid out along the river. Scrolling
 * moves the camera from scene to scene; it holds still while a scene is in the middle of
 * the screen and glides in between. Pure, so the glide can be tested.
 */
import { smootherstep } from '@/motion/color.ts';
import { HOLD, lookAt, WORLD_LOOKS, type WorldLook, type WorldLookName } from './palette.ts';

export interface Scene {
  /** The id of the page section that drives this scene. */
  id: string;
  look: WorldLookName;
  /** Camera position in foreground units. */
  x: number;
  y: number;
  /**
   * How far the camera slides right on a narrow screen, so the scene's set piece sits in
   * the middle instead of off the right edge (its offset from the scene ÷ its layer's p).
   */
  pan: number;
}

const GAP = 2600;

/** The far end of the world, in foreground units: every layer is laid out to here. */
export const LAST_X = 22000;

/** How high the camera has climbed at the last two scenes: camp level, then the summit. */
export const CLIMB = { ascent: 700, summit: 1400 } as const;

/**
 * Day, then night: the curriculum engine works in daylight (the council, the farm, the
 * proving grounds), then night falls on the characters (who they are, how their minds are
 * built, how they speak) and the climb ends at sunrise. The page renders its sections in
 * this order too, so the two cannot drift apart.
 */
export const SCENES: readonly Scene[] = [
  { id: 'top', look: 'dawn', x: 0, y: 0, pan: 745 },
  { id: 'councils', look: 'day', x: GAP, y: 0, pan: 600 },
  { id: 'scenarios', look: 'afternoon', x: GAP * 2, y: 0, pan: 440 },
  { id: 'learners', look: 'golden', x: GAP * 3, y: 0, pan: 636 },
  { id: 'npcs', look: 'dusk', x: GAP * 4, y: 0, pan: 0 },
  { id: 'mind', look: 'night', x: GAP * 5, y: 0, pan: 484 },
  { id: 'voice', look: 'midnight', x: GAP * 6, y: 0, pan: 655 },
  { id: 'ascent', look: 'lateNight', x: GAP * 7, y: CLIMB.ascent, pan: 555 },
  { id: 'summit', look: 'sunrise', x: GAP * 8, y: CLIMB.summit, pan: 0 },
];

/**
 * How high the camera is when it passes over world x: the scenes' heights joined by
 * straight lines, which is the path the glide takes. Ground that follows it stays under the
 * camera all the way up the mountain.
 */
export function trailY(x: number, scenes: readonly Scene[] = SCENES): number {
  const first = scenes[0]!;
  const last = scenes.at(-1)!;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  const i = scenes.findIndex((s) => s.x > x) - 1;
  const a = scenes[i]!;
  const b = scenes[i + 1]!;
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** How far either side of a scene the ground holds that scene's height. */
export const PLATEAU = 900;

/**
 * How high the ground stands at world x: level for a screen's width around each scene, so
 * the words always sit on the same dark ground, and a steep climb in between where the
 * scenes differ in height. The camera glides along `trailY`; this is the mountain under it.
 */
export function groundRise(x: number, scenes: readonly Scene[] = SCENES): number {
  const first = scenes[0]!;
  const last = scenes.at(-1)!;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  const i = scenes.findIndex((s) => s.x > x) - 1;
  const a = scenes[i]!;
  const b = scenes[i + 1]!;
  if (a.y === b.y) return a.y;
  const t = Math.min(1, Math.max(0, (x - a.x - PLATEAU) / (b.x - a.x - 2 * PLATEAU)));
  return a.y + (b.y - a.y) * t * t * (3 - 2 * t);
}

/** Where a scene sits in the journey, by id. */
export const sceneIndex = (id: string) => SCENES.findIndex((s) => s.id === id);

export const sceneX = (id: string) => SCENES.find((s) => s.id === id)?.x ?? 0;

export interface Shot {
  x: number;
  y: number;
  /** The narrow-screen slide at this point of the journey (see `Scene.pan`). */
  pan: number;
  look: WorldLook;
  /** Index of the nearest scene. */
  scene: number;
  /** The exact scene position, between scene indices while gliding. */
  s: number;
}

/** Camera and light at scene position `s` (0 = first scene centred, 1 = the next, …). */
export function shotAt(s: number, scenes: readonly Scene[] = SCENES): Shot {
  const n = scenes.length;
  const pos = Math.min(n - 1, Math.max(0, s));
  const i = Math.max(0, Math.min(n - 2, Math.floor(pos)));
  const a = scenes[i]!;
  const b = scenes[Math.min(n - 1, i + 1)]!;
  const k = n === 1 ? 0 : smootherstep((pos - i - HOLD) / (1 - 2 * HOLD));
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    pan: a.pan + (b.pan - a.pan) * k,
    look: lookAt(
      scenes.map((sc) => WORLD_LOOKS[sc.look]),
      pos,
    ),
    scene: Math.round(pos),
    s: pos,
  };
}

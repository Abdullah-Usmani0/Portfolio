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
}

const GAP = 2600;

export const SCENES: readonly Scene[] = [
  { id: 'top', look: 'dawn', x: 0, y: 0 },
  { id: 'npcs', look: 'morning', x: GAP, y: 0 },
  { id: 'councils', look: 'day', x: GAP * 2, y: 0 },
  { id: 'scenarios', look: 'afternoon', x: GAP * 3, y: 0 },
  { id: 'learners', look: 'golden', x: GAP * 4, y: 0 },
  { id: 'voice', look: 'dusk', x: GAP * 5, y: 0 },
  { id: 'mind', look: 'night', x: GAP * 6, y: 0 },
  { id: 'ascent', look: 'lateNight', x: GAP * 7, y: 0 },
  { id: 'summit', look: 'sunrise', x: GAP * 8, y: 0 },
];

export const sceneX = (id: string) => SCENES.find((s) => s.id === id)?.x ?? 0;

export interface Shot {
  x: number;
  y: number;
  look: WorldLook;
  /** Index of the nearest scene. */
  scene: number;
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
    look: lookAt(
      scenes.map((sc) => WORLD_LOOKS[sc.look]),
      pos,
    ),
    scene: Math.round(pos),
  };
}

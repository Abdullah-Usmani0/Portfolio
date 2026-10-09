/**
 * How strong the sky's effects are at a point of the journey: the sun's shafts and the snow
 * on the night climb. Pure, so each can be tested without a GPU.
 */
import { sceneIndex } from '../journey.ts';
import type { WorldLook } from '../palette.ts';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Light shafts show while the sun is low: strongest as it clears the horizon, gone by
 * mid-morning, and fading soon after it has set. Never by moonlight.
 */
export function rayStrength(look: Pick<WorldLook, 'sunY' | 'stars'>): number {
  const risen = clamp01((look.sunY + 0.16) / 0.16);
  const low = clamp01((0.42 - look.sunY) / 0.3);
  return risen * low * (1 - look.stars);
}

const ASCENT = sceneIndex('ascent');

/**
 * Snow falls from the deck of cloud above the night climb: it starts as the path leaves the
 * lake for the mountain, and stops once the camera is up through the cloud, before the summit.
 */
export function snowfall(s: number): number {
  return smooth(ASCENT - 0.65, ASCENT - 0.15, s) * (1 - smooth(ASCENT + 0.35, ASCENT + 0.75, s));
}

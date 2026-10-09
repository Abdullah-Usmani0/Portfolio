/**
 * How the hour lights the rendered mountains. Each mountain layer is rendered three times
 * (blender/k2_render.py): by a low sun from the left, by one from the right, and by the open
 * sky alone; the site mixes the three for the hour. Pure, so it is unit-tested.
 */
import { hexToRgb, mixHex } from '@/motion/color.ts';
import type { WorldLook } from '../palette.ts';

export type Rgb = [number, number, number];

export interface Relight {
  /** Linear colour of the sunlight (or moonlight), strength included. */
  sun: Rgb;
  /** Linear colour of the light from the open sky, strength included. */
  sky: Rgb;
  /** Shares of the left-sun and right-sun renders in the sunlight (they sum to 1). */
  left: number;
  right: number;
  /** Linear colour that distance fades to. */
  haze: Rgb;
  /** Kilometres of air that hide two thirds of what is behind them. */
  hazeKm: number;
  /**
   * Degrees above eye level below which the sun no longer reaches: far below every
   * mountain while it is up, climbing to the summit as it sets, so the last light is on
   * the peaks.
   */
  glowDeg: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** A palette colour as linear light. */
export function linear(hex: string): Rgb {
  return hexToRgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as Rgb;
}

const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

export function relight(look: Pick<WorldLook, 'sun' | 'snow' | 'skyTop' | 'skyHorizon' | 'haze' | 'sunX' | 'sunY' | 'stars' | 'mist'>): Relight {
  // A low sun is weaker, and warmer (the palette's lit-snow colour carries the alpenglow).
  const height = 0.6 + 0.4 * smooth(-0.06, 0.45, look.sunY);
  const moon = 1 - 0.85 * look.stars;
  const sunK = 1.75 * height * moon;
  const skyK = 0.55 * (1 - 0.75 * look.stars);
  const left = clamp01(0.5 - 0.8 * look.sunX);
  return {
    sun: scale(linear(mixHex(look.sun, look.snow, 0.45)), sunK),
    // The shade is lit by the open sky overhead, cool against the warm sun.
    sky: scale(linear(mixHex(look.skyTop, look.skyHorizon, 0.12)), skyK),
    left,
    right: 1 - left,
    haze: linear(look.haze),
    hazeKm: 42 / (0.6 + 0.8 * look.mist),
    glowDeg: -30 + 49 * smooth(0.06, -0.1, look.sunY),
  };
}

let cachedLook: unknown = null;
let cached: Relight | null = null;
/** `relight` for the frame's look, worked out once however many layers ask. */
export function relightFor(look: Parameters<typeof relight>[0]): Relight {
  if (look !== cachedLook || !cached) {
    cached = relight(look);
    cachedLook = look;
  }
  return cached;
}

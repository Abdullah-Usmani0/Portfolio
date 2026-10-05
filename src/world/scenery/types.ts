import type * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import type { WorldLook } from '../palette.ts';

export interface Frame {
  look: WorldLook;
  /** Seconds since the world started. */
  time: number;
  dt: number;
  camX: number;
  camY: number;
  /** Scene position: 0 = first scene centred, 1 = the next, … */
  s: number;
  /** The view's size in world units. */
  viewW: number;
  viewH: number;
  /** The open dive, if any: which scene, which step, and how far the camera has flown in (0–1). */
  dive: { scene: string; step: string; t: number } | null;
}

/**
 * A slice of the world at one depth. It moves `p` times as fast as the camera across the
 * screen (0 = pinned to the sky, 1 = the foreground), which is all the parallax there is.
 */
export interface Layer {
  group: THREE.Group;
  p: number;
  py: number;
  /** Stays put when the camera slides to frame a set piece on a narrow screen (the foreground, which carries the text). */
  fixed?: boolean;
  /**
   * How much further it falls, per unit the camera climbs above the valley floor: ranges
   * drop below the horizon as you gain height, faster the nearer they are.
   */
  sink?: number;
  update?: (f: Frame) => void;
  dispose?: () => void;
}

/**
 * Aerial perspective: a layer's colour at `depth` (0 = nearest, 1 = the horizon) leans
 * from the shade towards the haze; nearer layers take more of the leaf tint.
 */
export function tone(look: WorldLook, depth: number, leaf = 0): string {
  const base = mixHex(look.shade, look.haze, Math.pow(Math.min(1, Math.max(0, depth)), 0.78));
  return leaf > 0 ? mixHex(base, look.leaf, leaf * (1 - depth)) : base;
}

/** Seeded random in [0, 1). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

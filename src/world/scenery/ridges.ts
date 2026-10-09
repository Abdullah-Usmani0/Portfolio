import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { LAST_X } from '../journey.ts';
import { renderedStrip, type StripName } from './renderedStrip.ts';
import { seeded, tone, type Layer } from './types.ts';

export interface ForestOptions {
  seed: number;
  x0: number;
  x1: number;
  baseY: number;
  amp: number;
  /** Ridge wavelength in world units. */
  wave: number;
  treeH: number;
  treeW: number;
  /** Average gap between trees, as a multiple of their width (0 = shoulder to shoulder). */
  gap: number;
  step: number;
  /** Optional extra shape added to the ridge, e.g. a hill under the words. */
  shape?: (x: number) => number;
  /** Where no tree may stand, e.g. behind the words. */
  clear?: (x: number) => boolean;
}

/** One pine of a forest line: where it stands, the ground under it, and its size. */
export interface Tree {
  x: number;
  base: number;
  h: number;
  w: number;
}

/**
 * A ridge line with a pine forest standing on it, as one silhouette. Sway weights rise up
 * each tree. Also the bare ground under the trees and the trees themselves, for the renders.
 */
export function forestLine(o: ForestOptions) {
  const rnd = seeded(o.seed);
  const ridge = fbm(o.seed, 4);
  const n = Math.ceil((o.x1 - o.x0) / o.step) + 1;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const ground = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = o.x0 + i * o.step;
    xs[i] = x;
    ground[i] = o.baseY + o.amp * ridge(x / o.wave) + (o.shape?.(x) ?? 0);
    ys[i] = ground[i]!;
  }
  // Pines: a tiered triangle, each tier stepping in, placed at jittered spacing.
  const trees: Tree[] = [];
  let x = o.x0 + rnd() * o.treeW;
  while (x < o.x1) {
    if (o.clear?.(x)) {
      x += o.treeW;
      continue;
    }
    const h = o.treeH * (0.55 + rnd() * 0.75);
    const w = o.treeW * (0.75 + rnd() * 0.5);
    const i0 = Math.max(0, Math.floor((x - w / 2 - o.x0) / o.step));
    const i1 = Math.min(n - 1, Math.ceil((x + w / 2 - o.x0) / o.step));
    const base = ground[Math.round((x - o.x0) / o.step)] ?? o.baseY;
    trees.push({ x, base, h, w });
    for (let i = i0; i <= i1; i++) {
      const u = Math.abs(xs[i]! - x) / (w / 2);
      if (u > 1) continue;
      const tiers = 3;
      const step = (u * tiers) % 1;
      const y = base + h * (1 - u) - h * 0.1 * step;
      if (y > ys[i]!) ys[i] = y;
    }
    x += w * (0.55 + o.gap * (0.4 + rnd() * 1.2));
  }
  const sway = new Float32Array(n);
  for (let i = 0; i < n; i++) sway[i] = Math.min(1, Math.max(0, (ys[i]! - ground[i]!) / o.treeH));
  return { xs, ys, sway, ground, trees };
}

/** The two forested ridges across the valley, far then near (they sit between the mists in engine.ts). */
export const RIDGES = [
  { seed: 31, x0: -3500, x1: LAST_X * 0.15 + 3500, baseY: -206, amp: 36, wave: 900, treeH: 26, treeW: 14, gap: 0.35, step: 2, p: 0.15, depth: 0.44, leaf: 0.35, sway: 0.6 },
  { seed: 47, x0: -3500, x1: LAST_X * 0.28 + 3500, baseY: -240, amp: 30, wave: 700, treeH: 40, treeW: 20, gap: 0.3, step: 2, p: 0.28, depth: 0.33, leaf: 0.45, sway: 1 },
] as const;

/**
 * A forested ridge, painted, with its render (see renderedStrip.ts) drawn over it once
 * loaded when `rendered` names one. `half` loads the half-size render (phones).
 */
export function forestLayer(
  o: ForestOptions & { p: number; depth: number; leaf: number; sway: number },
  rendered?: { name: StripName; half: boolean },
): Layer {
  const { xs, ys, sway } = forestLine(o);
  let top = -Infinity;
  for (const y of ys) top = Math.max(top, y);
  const group = new THREE.Group();
  const strip = rendered
    ? renderedStrip(rendered.name, group, {
        half: rendered.half,
        // As far off as the painted ridge, the same share of haze.
        look: { haze: 0.75 * o.depth, sway: o.sway, shadeY0: 0, shadeY1: 1, shadeFloor: 1, deg: -1 },
        z: 0.1,
      })
    : null;
  const material = flatMaterial({ y0: o.baseY - o.amp - 80, y1: top, sway: o.sway, clip: strip?.clip });
  const mesh = new THREE.Mesh(silhouette(xs, ys, -1600, sway), material);
  group.add(mesh);
  return {
    group,
    p: o.p,
    py: o.p,
    update: (f) => {
      const { look } = f;
      const base = tone(look, o.depth, o.leaf);
      material.uniforms.uBottom.value.set(mixHex(base, look.shade, 0.18));
      material.uniforms.uTop.value.set(mixHex(base, look.haze, 0.1));
      strip?.update(f);
    },
    dispose: () => strip?.dispose(),
  };
}

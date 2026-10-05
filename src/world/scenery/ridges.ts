import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
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

/** A ridge line with a pine forest standing on it, as one silhouette. Sway weights rise up each tree. */
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
  return { xs, ys, sway };
}

export function forestLayer(
  o: ForestOptions & { p: number; depth: number; leaf: number; sway: number },
): Layer {
  const { xs, ys, sway } = forestLine(o);
  let top = -Infinity;
  for (const y of ys) top = Math.max(top, y);
  const material = flatMaterial({ y0: o.baseY - o.amp - 80, y1: top, sway: o.sway });
  const mesh = new THREE.Mesh(silhouette(xs, ys, -1600, sway), material);
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    p: o.p,
    py: o.p,
    update: ({ look }) => {
      const base = tone(look, o.depth, o.leaf);
      material.uniforms.uBottom.value.set(mixHex(base, look.shade, 0.18));
      material.uniforms.uTop.value.set(mixHex(base, look.haze, 0.1));
    },
  };
}

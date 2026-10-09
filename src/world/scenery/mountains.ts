import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import k2 from '../data/k2.json';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { tone, type Layer } from './types.ts';

/** Horizontal and vertical world units per degree of view: a touch taller than life. */
export const DEG_X = 21;
export const DEG_Y = 26;
/** Where eye level (0°) sits in world units. */
export const HORIZON_Y = -148;

// K2 itself barely moves, so it stays on the horizon for the whole journey; the valley
// walls in front of it move more and give way to ranges drawn to match them.
const PARALLAX = [0.012, 0.026, 0.04, 0.055, 0.07];
/**
 * How fast each band falls away as the camera climbs above the valley: by camp level the
 * valley walls are under the clouds, and from the summit every range is below you.
 */
const SINK = [0.85, 0.66, 0.66, 0.85, 0.3];
/** How far past the measured panorama each band is continued, in world units. */
const CONTINUE = 3200;
const DEPTH = [1, 0.86, 0.74, 0.63, 0.53];
const SNOW = [0.92, 0.55, 0.3, 0.14, 0.06];

/** K2's summit on its own (farthest) layer, in that layer's units. */
export const K2_SUMMIT = (() => {
  const band = k2.layers[0]!;
  let top = 0;
  band.deg.forEach((d, i) => {
    if (d > band.deg[top]!) top = i;
  });
  return { x: (band.x[top]! - 0.5) * k2.arc_deg * DEG_X, y: HORIZON_Y + band.deg[top]! * DEG_Y };
})();

/** The real K2 range as five painted layers, far first (from blender/k2_panorama.py). */
export function mountains(): Layer[] {
  return k2.layers.map((band, i) => {
    const xs = band.x.map((x) => (x - 0.5) * k2.arc_deg * DEG_X);
    const ys = band.deg.map((d) => HORIZON_Y + d * DEG_Y);
    // Past the measured arc, continue the band with ridges of the same height and roughness,
    // blended in from the real edge, so a panning camera never finds an end.
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const spread = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
    const ridge = fbm(70 + i * 13, 5);
    const extend = (from: number, to: number, edgeY: number) => {
      const out: [number, number][] = [];
      const dir = Math.sign(to - from);
      for (let d = 16; d <= Math.abs(to - from); d += 16) {
        const x = from + dir * d;
        const blend = Math.min(1, d / 520);
        const target = mean + spread * 1.4 * ridge(x / 380);
        out.push([x, edgeY + (target - edgeY) * blend]);
      }
      return out;
    };
    const left = extend(xs[0]!, xs[0]! - CONTINUE, ys[0]!).reverse();
    const right = extend(xs.at(-1)!, xs.at(-1)! + CONTINUE, ys.at(-1)!);
    xs.unshift(...left.map((p) => p[0]));
    ys.unshift(...left.map((p) => p[1]));
    xs.push(...right.map((p) => p[0]));
    ys.push(...right.map((p) => p[1]));
    const top = Math.max(...ys);
    const material = flatMaterial({ y0: top - 220, y1: top + 10 });
    const mesh = new THREE.Mesh(silhouette(xs, ys, -1600), material);
    const group = new THREE.Group();
    group.add(mesh);
    return {
      group,
      p: PARALLAX[i] ?? 0.1,
      py: PARALLAX[i] ?? 0.1,
      sink: SINK[i] ?? 0.4,
      update: ({ look }) => {
        const base = tone(look, DEPTH[i] ?? 0.5);
        material.uniforms.uBottom.value.set(base);
        material.uniforms.uTop.value.set(mixHex(base, look.snow, SNOW[i] ?? 0));
      },
    };
  });
}

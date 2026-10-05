import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { SCENES } from '../journey.ts';
import { flatMaterial, silhouette } from '../gl/flat.ts';
import { forestLine } from './ridges.ts';
import { tone, type Layer } from './types.ts';

/**
 * The darkest, nearest band: a grassy bank with tall pines. Under the words of every scene
 * it rises into a low hill, so the text always sits on dark ground.
 */
export function foreground(): Layer {
  const hill = (x: number) =>
    SCENES.reduce((h, s, i) => h + (i === 0 ? 360 : 300) * Math.exp(-(((x - (s.x - 560)) / 600) ** 2)), 0);
  // No tall pine may stand behind a scene's words or in front of its set piece; they
  // frame the edges and fill the stretches between scenes instead.
  const clear = (x: number) => SCENES.some((s) => x > s.x - 980 && x < s.x + 660);
  const xs: number[] = [];
  const ys: number[] = [];
  const sw: number[] = [];
  const last = SCENES.at(-1)!.x + 3200;
  const line = forestLine({ seed: 3, x0: -3200, x1: last, baseY: -392, amp: 26, wave: 900, treeH: 210, treeW: 92, gap: 5.5, step: 3, shape: hill, clear });
  // Grass blades along the edge, so the bank reads as meadow, not rock.
  for (let i = 0; i < line.xs.length; i++) {
    const x = line.xs[i]!;
    const blade = (Math.sin(x * 1.7) * 0.5 + 0.5) * (Math.sin(x * 0.31) * 0.5 + 0.5) * 9;
    xs.push(x);
    ys.push(line.ys[i]! + (line.sway[i]! < 0.02 ? blade : 0));
    sw.push(Math.max(line.sway[i]!, line.sway[i]! < 0.02 ? blade / 18 : 0));
  }
  const material = flatMaterial({ y0: -520, y1: -160, sway: 2.2 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(silhouette(xs, ys, -1600, sw), material));
  return {
    group,
    p: 1,
    py: 1,
    update: ({ look }) => {
      const base = tone(look, 0.05, 0.3);
      material.uniforms.uTop.value.set(mixHex(base, look.haze, 0.08));
      material.uniforms.uBottom.value.set(mixHex(base, look.shade, 0.6));
    },
  };
}

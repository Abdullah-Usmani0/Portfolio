import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { sceneIndex } from '../journey.ts';
import { seeded, tone, type Frame, type Layer } from './types.ts';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The cloud sea gathers below as the camera climbs out of the valley at night. */
const VOICE = sceneIndex('voice');
const arrival = (s: number) => smoothstep(VOICE + 0.15, VOICE + 0.85, s);

/** A billowing top edge: rounded heads of cloud of many sizes, over a long slow swell. */
function billows(seed: number, x0: number, x1: number, top: number, size: number) {
  const rnd = seeded(seed);
  const swell = fbm(seed + 3, 3);
  const heads: { x: number; r: number }[] = [];
  for (let x = x0 - size; x < x1 + size; ) {
    const r = size * (0.45 + rnd() * 0.9);
    heads.push({ x: x + r * 0.5, r });
    x += r * (0.7 + rnd() * 0.6);
  }
  return (x: number) => {
    let h = -Infinity;
    for (const b of heads) {
      const d = Math.abs(x - b.x);
      if (d < b.r) h = Math.max(h, Math.sqrt(b.r * b.r - d * d) - b.r * 0.62);
    }
    return top + Math.max(h, -size * 0.6) + 34 * swell(x / 760);
  };
}

/** A far range of peaks standing out of the clouds: K2's neighbours, from above. */
function peaks(seed: number, list: readonly { x: number; h: number; w: number }[], base: number) {
  const rough = fbm(seed, 4);
  return (x: number) => {
    let y = base - 200;
    for (const p of list) {
      const u = Math.abs(x - p.x) / p.w;
      if (u < 1) y = Math.max(y, base + p.h * (1 - u) ** 1.35 + 9 * rough(x / 30) * (1 - u));
    }
    return y;
  };
}

interface SeaOptions {
  p: number;
  /** Holds its height on screen as the camera climbs, sinking only this share of the climb. */
  settle: number;
  x0: number;
  x1: number;
  top: number;
  /** Billow size. */
  size: number;
  /** 0 far (lit tops, hazy) … 1 near (darker, in its own shade). */
  near: number;
  seed: number;
  /** Scene positions over which it fades in, on top of the arrival from the valley. */
  fadeIn?: [number, number];
  peaks?: readonly { x: number; h: number; w: number }[];
}

/** One deck of the cloud sea: lit tops, shaded body, and optionally peaks standing through it. */
export function cloudSea(o: SeaOptions): Layer {
  const group = new THREE.Group();
  const edge = billows(o.seed, o.x0, o.x1, o.top, o.size);
  const xs: number[] = [];
  const ys: number[] = [];
  const lift: number[] = [];
  for (let x = o.x0; x <= o.x1; x += 4) {
    // The deck thins out towards its ends, so it never shows a cut edge.
    const end = smoothstep(o.x0, o.x0 + 500, x) * (1 - smoothstep(o.x1 - 500, o.x1, x));
    xs.push(x);
    ys.push(edge(x) - (1 - end) * 420);
    lift.push(o.top);
  }
  const material = flatMaterial({ y0: -180, y1: 30, transparent: true, lift: true });
  const deck = new THREE.Mesh(silhouette(xs, ys, o.top - 2600, undefined, lift), material);
  deck.position.z = 0.2;
  group.add(deck);

  let peakMaterial: ReturnType<typeof flatMaterial> | null = null;
  if (o.peaks) {
    const ridge = peaks(o.seed + 11, o.peaks, o.top - 40);
    const px: number[] = [];
    const py: number[] = [];
    for (let x = o.x0; x <= o.x1; x += 3) {
      px.push(x);
      py.push(ridge(x));
    }
    peakMaterial = flatMaterial({ y0: o.top - 30, y1: o.top + 150, transparent: true });
    group.add(new THREE.Mesh(silhouette(px, py, o.top - 600), peakMaterial));
  }

  return {
    group,
    p: o.p,
    py: o.p,
    sink: o.settle - o.p,
    update: (f: Frame) => {
      const { look } = f;
      const fade = arrival(f.s) * (o.fadeIn ? smoothstep(o.fadeIn[0], o.fadeIn[1], f.s) : 1);
      group.visible = fade > 0.002;
      if (!group.visible) return;
      // Rising into place as it arrives, and drifting a little on the wind.
      deck.position.y = -(1 - arrival(f.s)) * 240;
      deck.position.x = Math.sin(f.time * 0.03 + o.seed) * 40;
      const lit = mixHex(mixHex(look.snow, look.sun, 0.3), look.skyHorizon, 0.25);
      const shadow = mixHex(look.haze, look.shade, 0.45 + 0.3 * o.near);
      material.uniforms.uTop.value.set(mixHex(lit, shadow, o.near * 0.35));
      material.uniforms.uBottom.value.set(shadow);
      material.uniforms.uOpacity.value = fade;
      if (peakMaterial) {
        const far = tone(look, 0.9);
        peakMaterial.uniforms.uBottom.value.set(mixHex(far, look.skyHorizon, 0.35));
        peakMaterial.uniforms.uTop.value.set(mixHex(look.snow, look.skyHorizon, 0.3));
        peakMaterial.uniforms.uOpacity.value = fade;
        peakMaterial.visible = fade > 0.002;
      }
    },
  };
}

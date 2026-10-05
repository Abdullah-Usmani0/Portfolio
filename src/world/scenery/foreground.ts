import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { groundRise, PLATEAU, SCENES } from '../journey.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { forestLine } from './ridges.ts';
import { PEAK, rockAt, snowAt, SUMMIT_KNOTS, SUMMIT_X, summitBlend, summitRidgeY, TREELINE } from './climbLayout.ts';
import { summitProps } from './summit.ts';
import { tone, type Layer } from './types.ts';

/**
 * The darkest, nearest band: a grassy bank with tall pines. Under the words of every scene
 * it rises into a low hill, so the text always sits on dark ground. At the end of the
 * journey it climbs with the camera: past the treeline into rock, then a snow-crested ridge,
 * then the summit, where the flag is.
 */
export function foreground(): Layer {
  const hill = (x: number) =>
    SCENES.reduce((h, s, i) => h + (i === 0 ? 360 : 300) * Math.exp(-(((x - (s.x - 560)) / 600) ** 2)), 0);
  // No tall pine may stand behind a scene's words or in front of its set piece; they
  // frame the edges and fill the stretches between scenes instead. None grow above the treeline.
  const clear = (x: number) => SCENES.some((s) => x > s.x - 980 && x < s.x + 660) || groundRise(x) > TREELINE;
  // Bare rock is broken: a jagged edge, and towers of rock standing up where the ridge climbs
  // between two scenes, so the climb reads as a ridge, not a hill.
  const jag = fbm(5, 4);
  const chip = fbm(29, 2);
  const rises = SCENES.slice(1).flatMap((b, i) => {
    const a = SCENES[i]!;
    return a.y === b.y ? [] : [{ x0: a.x + PLATEAU, x1: b.x - PLATEAU }];
  });
  const TOWERS = [
    [0.16, 130, 34],
    [0.38, 82, 24],
    [0.6, 156, 42],
    [0.84, 96, 30],
  ] as const;
  const towers = (x: number) => {
    let h = 0;
    for (const r of rises) {
      if (x < r.x0 - 60 || x > r.x1 + 60) continue;
      for (const [u, height, half] of TOWERS) {
        const d = Math.abs(x - (r.x0 + (r.x1 - r.x0) * u)) / half;
        if (d < 1) h = Math.max(h, height * (1 - d) ** 1.35);
      }
    }
    return h;
  };
  const rock = (x: number) => {
    const r = rockAt(x);
    if (r <= 0) return 0;
    // Smooth under the flag, so it stands on the summit, not beside it.
    const calm = 1 - Math.exp(-(((x - SUMMIT_X - PEAK.dx) / 46) ** 2));
    return r * calm * (11 * jag(x / 52) + 7 * Math.abs(chip(x / 14))) + towers(x);
  };
  const last = SCENES.at(-1)!.x + 3200;
  // Up high the ridge is cut into flat facets, the way rock breaks, instead of rolling like a
  // meadow: straight runs between knots a few dozen units apart (the summit's own shape
  // points among them, so the summit keeps its outline).
  const knots: number[] = [];
  {
    let seed = 7;
    const next = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const start = SCENES.find((sc) => sc.y === 0 && rockAt(sc.x + PLATEAU) > 0)?.x ?? SCENES.at(-3)!.x;
    for (let x = start; x < last; x += 90 + next() * 140) knots.push(x);
    for (const k of SUMMIT_KNOTS) knots.push(SUMMIT_X + k);
    knots.sort((a, b) => a - b);
  }
  // Each knot sits a little proud of or below the smooth line, so the facets break unevenly.
  const proud = (x: number) => 14 * Math.sin(x * 0.0123) * Math.sin(x * 0.0071 + 1.3);
  const facet = (f: (x: number) => number, x: number) => {
    const r = rockAt(x);
    if (r <= 0 || x <= knots[0]! || x >= knots.at(-1)!) return f(x);
    let lo = 0;
    let hi = knots.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (knots[mid]! <= x) lo = mid;
      else hi = mid;
    }
    const a = knots[lo]!;
    const b = knots[hi]!;
    // The summit's own shape points stay exactly where they are.
    const ya = f(a) + (SUMMIT_KNOTS.includes(a - SUMMIT_X) ? 0 : proud(a));
    const yb = f(b) + (SUMMIT_KNOTS.includes(b - SUMMIT_X) ? 0 : proud(b));
    const straight = ya + ((yb - ya) * (x - a)) / (b - a);
    return f(x) + (straight - f(x)) * r;
  };
  const smooth = (x: number) => hill(x) + groundRise(x);
  const line = forestLine({
    seed: 3,
    x0: -3200,
    x1: last,
    baseY: -392,
    amp: 26,
    wave: 900,
    treeH: 210,
    treeW: 92,
    gap: 5.5,
    step: 3,
    shape: (x) => facet(smooth, x) + rock(x),
    clear,
  });
  const xs: number[] = [];
  const ys: number[] = [];
  const sw: number[] = [];
  const lift: number[] = [];
  for (let i = 0; i < line.xs.length; i++) {
    const x = line.xs[i]!;
    // Near the summit the ridge is drawn rather than grown: the shoulder under the words,
    // the col, the pinnacle and its cornice.
    const w = summitBlend(x - SUMMIT_X);
    const y = line.ys[i]! * (1 - w) + (facet(summitRidgeY, x) + rock(x) * 0.6) * w;
    // Grass blades along the edge, so the low bank reads as meadow, not rock.
    const meadow = 1 - rockAt(x);
    const blade = (Math.sin(x * 1.7) * 0.5 + 0.5) * (Math.sin(x * 0.31) * 0.5 + 0.5) * 9 * meadow;
    xs.push(x);
    ys.push(y + (line.sway[i]! < 0.02 ? blade : 0));
    sw.push(Math.max(line.sway[i]!, line.sway[i]! < 0.02 ? blade / 18 : 0));
    lift.push(groundRise(x));
  }
  const material = flatMaterial({ y0: -520, y1: -160, sway: 2.2, lift: true });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(silhouette(xs, ys, -1600, sw, lift), material));

  // A crest of snow along the ridge once it is high enough to hold it: thin under the words,
  // deepest on the summit.
  const crest = fbm(43, 3);
  const sx: number[] = [];
  const top: number[] = [];
  const bottom: number[] = [];
  for (let i = 0; i < xs.length; i += 2) {
    const x = xs[i]!;
    const s = snowAt(x);
    if (s <= 0) continue;
    const words = SCENES.some((sc) => x > sc.x - 900 && x < sc.x - 180) ? 0.55 : 1;
    const cap = 14 * Math.exp(-(((x - SUMMIT_X - PEAK.dx) / 90) ** 2));
    const depth = s * (words * (6 + 7 * (crest(x / 60) * 0.5 + 0.5)) + cap);
    sx.push(x);
    top.push(ys[i]! + 0.6);
    bottom.push(ys[i]! - depth);
  }
  const snow = flatMaterial({ y0: -16, y1: 0, lift: true });
  if (sx.length > 1) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(sx.length * 6);
    const lf = new Float32Array(sx.length * 2);
    const index: number[] = [];
    for (let i = 0; i < sx.length; i++) {
      pos.set([sx[i]!, top[i]!, 0, sx[i]!, bottom[i]!, 0], i * 6);
      lf[i * 2] = lf[i * 2 + 1] = top[i]!;
      if (i < sx.length - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(sx.length * 2), 1));
    g.setAttribute('aLift', new THREE.BufferAttribute(lf, 1));
    g.setIndex(index);
    const mesh = new THREE.Mesh(g, snow);
    mesh.position.z = 0.2;
    group.add(mesh);
  }

  const updateSummit = summitProps(group, { x: SUMMIT_X + PEAK.dx, y: summitRidgeY(SUMMIT_X + PEAK.dx) });

  return {
    group,
    p: 1,
    py: 1,
    fixed: true,
    update: (f) => {
      const { look } = f;
      const base = tone(look, 0.05, 0.3);
      material.uniforms.uTop.value.set(mixHex(base, look.haze, 0.08));
      material.uniforms.uBottom.value.set(mixHex(base, look.shade, 0.6));
      // Snow on the nearest ridge is in its own shadow, lit only along its very top.
      const lit = mixHex(look.snow, look.shade, 0.32);
      snow.uniforms.uTop.value.set(mixHex(lit, look.sun, 0.12));
      snow.uniforms.uBottom.value.set(mixHex(look.snow, look.shade, 0.62));
      updateSummit(f);
    },
  };
}

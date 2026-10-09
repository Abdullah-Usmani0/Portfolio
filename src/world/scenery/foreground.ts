import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { groundRise, SCENES } from '../journey.ts';
import { flatMaterial, silhouette } from '../gl/flat.ts';
import { bankLine, nearWords } from './bankLine.ts';
import { PEAK, rockAt, snowAt, SUMMIT_X, summitRidgeY } from './climbLayout.ts';
import { grassLayer, placeGrass } from './grass.ts';
import { renderedStrip } from './renderedStrip.ts';
import { summitProps } from './summit.ts';
import { tone, type Layer } from './types.ts';

/**
 * The darkest, nearest band: a grassy bank with tall pines, which climbs to the summit at
 * the journey's end (see `bankLine`). Painted, with its render (see renderedStrip.ts) over it
 * once loaded; `half` loads the half-size one (phones).
 */
export function foreground(half = false, still: () => boolean = () => false): Layer {
  const { xs, ys, sway: sw, lift, ground, crest } = bankLine();
  const group = new THREE.Group();
  // The ground's edge at x, under its pines and blades.
  const edge = (x: number) => {
    const u = Math.min(xs.length - 1.001, Math.max(0, (x - xs[0]!) / (xs[1]! - xs[0]!)));
    const k = Math.floor(u);
    return ground[k]! + (ground[k + 1]! - ground[k]!) * (u - k);
  };
  // Over the painted bank and its snow, under the summit's props. Down its face it falls into
  // shade, as the painted bank does, so the words over it stay easy to read, and deeper still
  // it gives way to the painted ground.
  const strip = renderedStrip('bank', group, {
    half,
    look: { haze: 0, sway: 2.2, shadeY0: -560, shadeY1: -200, shadeFloor: 0.35, deg: -6, fade: [430, 520] },
    z: 0.22,
    lift: groundRise,
    edge,
  });
  /** The painted geometry's clip line (see renderedStrip's `clipLine`). */
  const clipped = (g: THREE.BufferGeometry) => {
    if (!strip) return g;
    const pos = g.getAttribute('position');
    const line = new Float32Array(pos.count);
    for (let k = 0; k < pos.count; k++) line[k] = strip.clipLine(pos.getX(k));
    g.setAttribute('aClip', new THREE.BufferAttribute(line, 1));
    return g;
  };
  const material = flatMaterial({ y0: -520, y1: -160, sway: 2.2, lift: true, clip: strip?.clip });
  group.add(new THREE.Mesh(clipped(silhouette(xs, ys, -1600, sw, lift)), material));

  // A crest of snow along the ridge once it is high enough to hold it.
  const { xs: sx, top, bottom } = crest;
  const snow = flatMaterial({ y0: -16, y1: 0, lift: true, clip: strip?.clip });
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
    const mesh = new THREE.Mesh(clipped(g), snow);
    mesh.position.z = 0.2;
    group.add(mesh);
  }

  const updateSummit = summitProps(group, { x: SUMMIT_X + PEAK.dx, y: summitRidgeY(SUMMIT_X + PEAK.dx) });

  // Tall grass along the bank's edge, in tufts down its face between the scenes, thinning out
  // as the ground turns to rock; fewer blades on a phone. Shaded down the face as the
  // rendered bank is (its look below), and lit as high as the ground has climbed.
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const blades = placeGrass({
    x0: xs[0]!,
    x1: xs.at(-1)!,
    edge,
    meadow: (x) => Math.max(0, 1 - 1.6 * rockAt(x)) * (1 - snowAt(x)),
    tufts: (x) => !nearWords(x),
    // Short where a scene's words stand on the ridge, so the grass never crowds them: the
    // left of the screen on a wide one, its whole width on a phone.
    height: (x) => {
      const [a, b] = half ? [-420, 420] : [-1000, -150];
      let h = 1;
      for (const sc of SCENES) h = Math.min(h, 1 - 0.5 * smooth(a - 120, a, x - sc.x) * (1 - smooth(b, b + 120, x - sc.x)));
      return h;
    },
    shade: (x, y) => 0.35 + 0.65 * smooth(-560, -200, y - groundRise(x)),
    deg: (x) => -6 + (groundRise(x) / 1400) * 40,
    density: half ? 0.45 : 0.85,
    seed: 17,
  });
  const grass = grassLayer(group, blades, { z: 0.24, still });

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
      strip?.update(f);
      grass.update(f);
    },
    dispose: () => {
      strip?.dispose();
      grass.dispose();
    },
  };
}

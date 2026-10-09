import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { groundRise } from '../journey.ts';
import { flatMaterial, silhouette } from '../gl/flat.ts';
import { bankLine } from './bankLine.ts';
import { PEAK, SUMMIT_X, summitRidgeY } from './climbLayout.ts';
import { renderedStrip } from './renderedStrip.ts';
import { summitProps } from './summit.ts';
import { tone, type Layer } from './types.ts';

/**
 * The darkest, nearest band: a grassy bank with tall pines, which climbs to the summit at
 * the journey's end (see `bankLine`). Painted, with its render (see renderedStrip.ts) over it
 * once loaded; `half` loads the half-size one (phones).
 */
export function foreground(half = false): Layer {
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
    },
    dispose: () => strip?.dispose(),
  };
}

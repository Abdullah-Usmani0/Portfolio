import * as THREE from 'three';
import { shared } from '../gl/flat.ts';
import { relightFor } from './relight.ts';
import { seeded, type Frame } from './types.ts';

/**
 * Tall grass that flows in the wind: real blades, drawn on the GPU, rooted along a ground line
 * and in tufts down the slope below it. Each blade is a tapered curve that the wind bends
 * further the higher up it is; gusts roll across the meadow (the same gusts that stir the
 * rendered grass, see gl/strip.ts), and every blade flutters on its own. Lit by the hour like
 * the rendered layers: by the sun from its side, by the open sky, and, when the sun is low,
 * through the blade, so the tips glow.
 */

/** Where the blades stand, and how each looks, as plain numbers (see `placeGrass`). */
export interface Blades {
  /** Root x and y. */
  root: Float32Array;
  /** Height, width at the root, lean (radians, + to the right), phase (0–1). */
  shape: Float32Array;
  /** Linear colour, in the units of the rendered layers' sky light. */
  tint: Float32Array;
  /** How much of the light reaches it (1 at the edge, less down a shaded slope), and how high it stands (degrees, for the low sun). */
  light: Float32Array;
  count: number;
}

export interface Meadow {
  x0: number;
  x1: number;
  /** The ground's edge at x: blades along it, tufts below it. */
  edge: (x: number) => number;
  /** 0–1: how much of the ground at x is meadow (none on bare rock or snow). */
  meadow: (x: number) => number;
  /** May tufts stand down the slope at x (not behind a scene's words)? */
  tufts: (x: number) => boolean;
  /** How tall the grass may grow at x (1 most places; less behind a scene's words). */
  height?: (x: number) => number;
  /** 0–1: how much light reaches a point (x, y), for blades down a shaded slope. */
  shade: (x: number, y: number) => number;
  /** Degrees above eye level the ground at x stands at (see StripLook.deg). */
  deg: (x: number) => number;
  /** Blades per world unit along the edge. */
  density: number;
  /** Scales every blade: 1 for the near bank. */
  size?: number;
  seed: number;
}

/** Fresh green, olive and straw, in the rendered grass's own units. */
const TINTS = [
  [0.05, 0.07, 0.022],
  [0.064, 0.068, 0.026],
  [0.11, 0.092, 0.042],
] as const;

/** Where every blade stands along a meadow, and its shape and colour. Pure: same seed, same meadow. */
export function placeGrass(m: Meadow): Blades {
  const rnd = seeded(m.seed);
  const k = m.size ?? 1;
  const root: number[] = [];
  const shape: number[] = [];
  const tint: number[] = [];
  const light: number[] = [];
  // Patches: tall and dry here, short and green there, changing over a few hundred units.
  const patch = (x: number) => 0.5 + 0.5 * Math.sin(x * 0.0061 + 1.1) * Math.sin(x * 0.0023 + 0.4);
  const dry = (x: number) => 0.5 + 0.5 * Math.sin(x * 0.0037 + 2.3);
  /** One blade; a negative width marks a seed stalk (thin, with a head of seed at its top). */
  const add = (x: number, y: number, h: number, width: number, lean: number, d: number) => {
    const a = TINTS[d < 0.35 ? 0 : d < 0.75 ? 1 : 2]!;
    const j = 0.8 + 0.4 * rnd();
    root.push(x, y);
    shape.push(h * k, width * k, lean, rnd());
    tint.push(a[0] * j, a[1] * j, a[2] * j);
    light.push(m.shade(x, y), m.deg(x));
  };
  /** A clump: blades from one root, fanned out, the middle ones tallest. */
  const clump = (x: number, y: number, h: number, n: number) => {
    const d = dry(x) + (rnd() - 0.5) * 0.4;
    for (let b = 0; b < n; b++) {
      const u = n === 1 ? 0 : (b / (n - 1)) * 2 - 1;
      const tall = h * (1 - 0.35 * u * u) * (0.75 + 0.5 * rnd());
      add(x + u * 3 * k + (rnd() - 0.5) * 2 * k, y - rnd() * 2 * k, tall, 2.2 + 2 * rnd() * (0.6 + 0.4 * Math.min(1, tall / 50)), u * 0.42 + (rnd() - 0.5) * 0.2, d + (rnd() - 0.5) * 0.3);
    }
    // Now and then a seed stalk stands out of the clump, taller and dry.
    if (rnd() < 0.18 * patch(x) + 0.03) add(x + (rnd() - 0.5) * 4 * k, y, h * (1.35 + 0.4 * rnd()), -1.3, (rnd() - 0.5) * 0.3, 0.9);
  };
  const step = 4.2 / m.density;
  for (let x = m.x0; x < m.x1; x += step * (0.35 + 1.3 * rnd())) {
    const g = m.meadow(x);
    if (g <= 0.05 || rnd() > g) continue;
    const top = m.edge(x);
    // Along the edge: mostly knee-high, waist-high in places, with gaps between the clumps.
    const p = patch(x);
    const cap = m.height?.(x) ?? 1;
    clump(x, top - rnd() * 9 * k, (14 + 62 * p * Math.sqrt(rnd())) * cap, 2 + Math.floor(rnd() * (3 + 5 * p)));
    // Down the slope, now and then a tuft.
    if (m.tufts(x) && rnd() < 0.22) {
      const depth = 16 + 150 * rnd() ** 1.6;
      clump(x + (rnd() - 0.5) * 10 * k, top - depth * k, 10 + 30 * rnd() * p, 3 + Math.floor(rnd() * 6));
    }
  }
  return {
    root: new Float32Array(root),
    shape: new Float32Array(shape),
    tint: new Float32Array(tint),
    light: new Float32Array(light),
    count: root.length / 2,
  };
}

/** Points along a blade, root to tip; each but the tip is a pair, one either edge. */
const LEVELS = [0, 0.22, 0.44, 0.64, 0.82] as const;

function bladeGeometry(): { vert: Float32Array; index: number[] } {
  const vert: number[] = [];
  for (const t of LEVELS) vert.push(t, -1, t, 1);
  vert.push(1, 0);
  const index: number[] = [];
  for (let k = 0; k < LEVELS.length - 1; k++) {
    const a = k * 2;
    index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const last = (LEVELS.length - 1) * 2;
  index.push(last, last + 1, last + 2);
  return { vert: new Float32Array(vert), index };
}

/** Blades are grouped by x into chunks this wide, and a chunk is only drawn near the view. */
const CHUNK = 900;

/**
 * The blades in `blades`, drawn into `group` at depth `z`. `still` holds the wind (reduced
 * motion). Returns the per-frame update and the cleanup.
 */
export function grassLayer(group: THREE.Group, blades: Blades, o: { z: number; still: () => boolean }) {
  const uniforms = {
    uTime: shared.uTime,
    uWind: { value: 1 },
    uSun: { value: new THREE.Vector3() },
    uSky: { value: new THREE.Vector3() },
    uSide: { value: new THREE.Vector2(0.5, 0.5) },
    uGlow: { value: -30 },
    uBack: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec2 aVert;
      attribute vec2 aRoot;
      attribute vec4 aShape;
      attribute vec3 aTint;
      attribute vec2 aLight;
      uniform float uTime;
      uniform float uWind;
      varying float vT;
      varying float vSide;
      varying vec3 vTint;
      varying vec2 vLight;
      void main() {
        float t = aVert.x;
        float h = aShape.x;
        // The gusts the rendered grass sways with, and the blade's own flutter.
        float gust = max(0.0, sin(uTime * 0.9 + aRoot.x * 0.004) * 0.6 + 0.4);
        float flutter = sin(uTime * 1.7 + aRoot.x * 0.05 + aShape.w * 6.2832) * (0.5 + 0.5 * gust);
        float bend = aShape.z - uWind * (0.16 + 0.42 * gust + 0.13 * flutter) * (0.6 + 0.4 * min(1.0, h / 50.0));
        // Along a curve whose angle grows from the root: x = ∫ sin, y = ∫ cos.
        float a = bend * t;
        vec2 along = h * vec2(0.5 * bend * t * t, t - bend * bend * t * t * t / 6.0);
        vec2 dir = vec2(sin(a), cos(a));
        vec2 across = vec2(dir.y, -dir.x);
        // A blade tapers to its tip; a seed stalk stays thin, then swells into a head of seed.
        float half_ = aShape.y > 0.0
          ? 0.5 * aShape.y * pow(1.0 - t, 0.75)
          : 0.5 * -aShape.y * (0.6 + 2.2 * smoothstep(0.72, 0.8, t) * (1.0 - smoothstep(0.88, 1.0, t)));
        vec2 p = aRoot + along + across * half_ * aVert.y;
        vT = t;
        vSide = aVert.y;
        vTint = aTint;
        vLight = aLight;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform vec3 uSky;
      uniform vec2 uSide;
      uniform float uGlow;
      uniform float uBack;
      varying float vT;
      varying float vSide;
      varying vec3 vTint;
      varying vec2 vLight;
      vec3 srgb(vec3 c) {
        c = max(c, 0.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        // Each edge of the blade faces one way: the left one takes a sun from the left.
        float left = mix(1.0, 0.3, 0.5 + 0.5 * vSide);
        float right = mix(0.3, 1.0, 0.5 + 0.5 * vSide);
        float lit = smoothstep(uGlow - 2.5, uGlow + 2.5, vLight.y);
        vec3 a = vTint * mix(0.45, 1.2, vT);
        vec3 c = uSun * (uSide.x * left + uSide.y * right) * lit * a * 0.8 + uSky * a * mix(0.55, 1.0, vT);
        // A low sun shines through the blade: its upper half glows.
        c += uSun * lit * uBack * vTint * 1.4 * vT * vT;
        c *= vLight.x;
        vec3 u = srgb(c);
        u = mix(u, u * u * (3.0 - 2.0 * u), 0.35);
        u += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(u, 1.0);
      }`,
  });

  const base = bladeGeometry();
  const vert = new THREE.BufferAttribute(base.vert, 2);
  const chunks: { mesh: THREE.Mesh; x0: number; x1: number }[] = [];
  // Blades sorted by x, then cut into chunks.
  const order = Array.from({ length: blades.count }, (_, i) => i).sort((a, b) => blades.root[a * 2]! - blades.root[b * 2]!);
  let start = 0;
  while (start < order.length) {
    const from = blades.root[order[start]! * 2]!;
    let end = start;
    while (end < order.length && blades.root[order[end]! * 2]! < from + CHUNK) end++;
    const n = end - start;
    const pick = (src: Float32Array, size: number) => {
      const out = new Float32Array(n * size);
      for (let k = 0; k < n; k++) out.set(src.subarray(order[start + k]! * size, order[start + k]! * size + size), k * size);
      return new THREE.InstancedBufferAttribute(out, size);
    };
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('aVert', vert);
    geo.setIndex(base.index);
    geo.setAttribute('aRoot', pick(blades.root, 2));
    geo.setAttribute('aShape', pick(blades.shape, 4));
    geo.setAttribute('aTint', pick(blades.tint, 3));
    geo.setAttribute('aLight', pick(blades.light, 2));
    geo.instanceCount = n;
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.z = o.z;
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    chunks.push({ mesh, x0: from - 60, x1: from + CHUNK + 60 });
    start = end;
  }

  return {
    update(f: Frame) {
      const s = group.scale.x || 1;
      const left = (f.camX - f.viewW / 2 - group.position.x) / s;
      const right = (f.camX + f.viewW / 2 - group.position.x) / s;
      for (const c of chunks) c.mesh.visible = c.x1 > left && c.x0 < right;
      const r = relightFor(f.look);
      uniforms.uSun.value.set(...r.sun);
      uniforms.uSky.value.set(...r.sky);
      uniforms.uSide.value.set(r.left, r.right);
      uniforms.uGlow.value = r.glowDeg;
      uniforms.uWind.value = o.still() ? 0 : 1;
      // Light through the blades while the sun is low and up; none by moonlight.
      const low = 1 - Math.min(1, Math.max(0, f.look.sunY / 0.45));
      uniforms.uBack.value = low * low * (1 - f.look.stars);
    },
    dispose() {
      for (const c of chunks) {
        group.remove(c.mesh);
        c.mesh.geometry.dispose();
      }
      material.dispose();
    },
  };
}

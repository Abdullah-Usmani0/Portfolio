import * as THREE from 'three';

/**
 * Flat, painted layers: every hill, ridge and mountain is a strip under a silhouette line,
 * filled with a vertical gradient. Vertices on the silhouette can carry a sway weight so
 * treetops move in the wind.
 */

export const shared = {
  uTime: { value: 0 },
};

/**
 * A filled silhouette: `xs`/`ys` trace the top edge left to right; the fill runs down to
 * `bottom`. `lift` raises the gradient with the ground (see `flatMaterial`'s `lift`).
 */
export function silhouette(xs: ArrayLike<number>, ys: ArrayLike<number>, bottom: number, sway?: ArrayLike<number>, lift?: ArrayLike<number>): THREE.BufferGeometry {
  const n = xs.length;
  const pos = new Float32Array(n * 2 * 3);
  const sw = new Float32Array(n * 2);
  const lf = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos.set([xs[i]!, ys[i]!, 0, xs[i]!, bottom, 0], i * 6);
    sw[i * 2] = sway ? sway[i]! : 0;
    lf[i * 2] = lf[i * 2 + 1] = lift ? lift[i]! : 0;
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
  g.setAttribute('aLift', new THREE.BufferAttribute(lf, 1));
  g.setIndex(index);
  return g;
}

/** A silhouette's points split at two x positions: before `a`, between, and after `b`. */
export function splitLine(xs: number[], ys: number[], a: number, b: number) {
  const at = (x: number) => {
    let k = 0;
    while (k < xs.length - 2 && xs[k + 1]! < x) k++;
    const t = Math.min(1, Math.max(0, (x - xs[k]!) / (xs[k + 1]! - xs[k]! || 1)));
    return ys[k]! + (ys[k + 1]! - ys[k]!) * t;
  };
  const part = (lo: number, hi: number) => {
    const px: number[] = [];
    const py: number[] = [];
    if (lo > xs[0]!) {
      px.push(lo);
      py.push(at(lo));
    }
    xs.forEach((x, k) => {
      if (x > lo && x < hi) {
        px.push(x);
        py.push(ys[k]!);
      }
    });
    if (hi < xs.at(-1)!) {
      px.push(hi);
      py.push(at(hi));
    }
    return { xs: px, ys: py };
  };
  return [part(-Infinity, a), part(a, b), part(b, Infinity)] as const;
}

export interface FlatUniforms {
  [key: string]: THREE.IUniform;
  uTop: { value: THREE.Color };
  uBottom: { value: THREE.Color };
  uY0: { value: number };
  uY1: { value: number };
  uSway: { value: number };
  uOpacity: { value: number };
  uTime: { value: number };
}

/**
 * Where a painted layer is covered by rendered tiles (see scenery/renderedStrip.ts): the
 * tiles stand side by side `width` apart from `x0`, and above `ys[k]` tile k covers it
 * (a huge value while that tile is not in), measured from each vertex's `aClip` (0 if the
 * geometry has none), so the covered part can follow a line rather than a level.
 */
export interface Clip {
  x0: number;
  width: number;
  /** CLIP_SLOTS long: slots past the last tile stay huge (uncovered). */
  ys: Float32Array;
}

/** Tiles a clip can hold. One size for every layer, so they all share one compiled shader. */
export const CLIP_SLOTS = 64;

/**
 * Vertical gradient from `uBottom` (at y ≤ uY0) to `uTop` (at y ≥ uY1), with optional sway.
 * With `lift`, y is measured from each vertex's `aLift` instead of from zero, so ground that
 * climbs keeps its gradient under its own edge. With `clip`, nothing is drawn where rendered
 * tiles cover the layer.
 */
export function flatMaterial(opts: { y0: number; y1: number; sway?: number; transparent?: boolean; lift?: boolean; clip?: Clip }): THREE.ShaderMaterial & {
  uniforms: FlatUniforms;
} {
  const uniforms: FlatUniforms = {
    uTop: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uY0: { value: opts.y0 },
    uY1: { value: opts.y1 },
    uSway: { value: opts.sway ?? 0 },
    uOpacity: { value: 1 },
    uTime: shared.uTime,
  };
  const defines: Record<string, string> = {};
  if (opts.lift) defines.LIFT = '';
  if (opts.clip) {
    defines.CLIP = String(CLIP_SLOTS);
    uniforms.uClipX0 = { value: opts.clip.x0 };
    uniforms.uClipW = { value: opts.clip.width };
    uniforms.uClipY = { value: opts.clip.ys };
  }
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: opts.transparent ?? false,
    depthWrite: !opts.transparent,
    defines,
    vertexShader: /* glsl */ `
      attribute float aSway;
      attribute float aLift;
      attribute float aClip;
      uniform float uTime;
      uniform float uSway;
      varying float vY;
      varying vec2 vPos;
      varying float vClip;
      void main() {
        vec3 p = position;
        float gust = sin(uTime * 0.9 + position.x * 0.004) * 0.6 + 0.4;
        p.x += aSway * uSway * gust * sin(uTime * 1.7 + position.x * 0.05);
        #ifdef LIFT
        vY = position.y - aLift;
        #else
        vY = position.y;
        #endif
        vPos = position.xy;
        vClip = aClip;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uY0;
      uniform float uY1;
      uniform float uOpacity;
      varying float vY;
      varying vec2 vPos;
      varying float vClip;
      #ifdef CLIP
      uniform float uClipX0;
      uniform float uClipW;
      uniform float uClipY[CLIP];
      #endif
      void main() {
        #ifdef CLIP
        int tile = int(floor((vPos.x - uClipX0) / uClipW));
        if (tile >= 0 && tile < CLIP && vPos.y > uClipY[tile] + vClip) discard;
        #endif
        float k = smoothstep(uY0, uY1, vY);
        gl_FragColor = vec4(mix(uBottom, uTop, k), uOpacity);
      }`,
  }) as THREE.ShaderMaterial & { uniforms: FlatUniforms };
}

/** Seeded 1D value noise, smooth, in [-1, 1]. */
export function noise1(seed: number) {
  const hash = (i: number) => {
    const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
  };
}

/** Fractal noise: a few octaves of `noise1`, roughly in [-1, 1]. */
export function fbm(seed: number, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, o) => noise1(seed + o * 17));
  return (x: number) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (const n of layers) {
      sum += n(x * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
}

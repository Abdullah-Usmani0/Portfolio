/**
 * Point targets for the Mind Garden's firefly bust — pure, seeded, renderer-free.
 *
 * Three shapes share one point index, so the shader can morph between them:
 *   swarm  → fireflies loose over the meadow
 *   bust   → the same fireflies settled on a head-and-shoulders surface
 *   pond   → the head poured into a terraced pond: one terrace per context block
 *
 * Every shape is sampled i.i.d., so any prefix of the arrays is a fair subset — a quality
 * tier just draws fewer points. Bust and pond are paired by height rank, so the head pours
 * from the top terrace down instead of scrambling.
 */
import type { Rng } from '../rng.ts';

/** The context blocks, top terrace first, in the order an NPC's context is assembled. */
export const CONTEXT_LAYERS = [
  'identity',
  'framework',
  'task',
  'requirements',
  'resources',
  'memory',
  'feedback',
  'retrieval',
  'learner state',
  'voice',
] as const;

/** Context-block colours, top terrace first: greens for the cached prefix, then the live tail. */
export const LAYER_COLORS = ['#c6ff3d', '#a4ef4f', '#7fdc6f', '#5ccaa0', '#3de0ff', '#5fa8ff', '#8a8cff', '#c08cff', '#ff9db0', '#ffb547'] as const;

/** Blocks above this terrace index form the stable, cached prefix; the waterline sits here. */
export const CACHE_LINE = 4;

export interface BustTargets {
  count: number;
  bust: Float32Array;
  pond: Float32Array;
  swarm: Float32Array;
  /** Terrace index of each point in the pond (0 = top); +0.5 marks a point on the terrace's lip. */
  layer: Float32Array;
  /** Per point: stagger delay, size, twinkle phase, hue — all in [0, 1). */
  rand: Float32Array;
}

/** Area-weighted uniform samples on a triangle mesh. */
export function sampleSurface(positions: Float32Array, indices: Uint16Array | Uint32Array, n: number, rng: Rng): Float32Array {
  const tris = indices.length / 3;
  const cdf = new Float64Array(tris);
  let total = 0;
  const p = (i: number, k: number) => positions[i * 3 + k]!;
  for (let t = 0; t < tris; t++) {
    const a = indices[t * 3]!;
    const b = indices[t * 3 + 1]!;
    const c = indices[t * 3 + 2]!;
    const ux = p(b, 0) - p(a, 0);
    const uy = p(b, 1) - p(a, 1);
    const uz = p(b, 2) - p(a, 2);
    const vx = p(c, 0) - p(a, 0);
    const vy = p(c, 1) - p(a, 1);
    const vz = p(c, 2) - p(a, 2);
    total += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    cdf[t] = total;
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rng.next() * total;
    let lo = 0;
    let hi = tris - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid]! < r) lo = mid + 1;
      else hi = mid;
    }
    let s = rng.next();
    let t = rng.next();
    if (s + t > 1) {
      s = 1 - s;
      t = 1 - t;
    }
    const a = indices[lo * 3]!;
    const b = indices[lo * 3 + 1]!;
    const c = indices[lo * 3 + 2]!;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = p(a, k) + s * (p(b, k) - p(a, k)) + t * (p(c, k) - p(a, k));
  }
  return out;
}

/**
 * Ten terraces stepping down into a pool of light hovering over the meadow, in bust units
 * (the bust is 1 tall, ~1 wide). Terrace k is a ring between radii r(k+1) and r(k), at depth
 * k·step below the rim — so the head pours down into it like water.
 */
export function terracedPond(n: number, rng: Rng, layers = CONTEXT_LAYERS.length): { positions: Float32Array; layer: Float32Array } {
  const rOuter = 0.82;
  const rInner = 0.1;
  const step = 0.05;
  // A pool of light hovering just over the meadow (the bust's base is 12 m above the ground).
  const rim = -0.1;
  const radius = (k: number) => rOuter - ((rOuter - rInner) * k) / layers;
  const areas = Array.from({ length: layers }, (_, k) => Math.PI * (radius(k) ** 2 - radius(k + 1) ** 2));
  const total = areas.reduce((a, b) => a + b, 0);
  const positions = new Float32Array(n * 3);
  const layer = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r = rng.next() * total;
    let k = 0;
    while (k < layers - 1 && r > areas[k]!) r -= areas[k++]!;
    const r0 = radius(k + 1);
    const r1 = radius(k);
    const rr = Math.sqrt(r0 * r0 + rng.next() * (r1 * r1 - r0 * r0));
    const a = rng.next() * Math.PI * 2;
    // A bright lip at each terrace's outer edge reads as the wall holding the water; the
    // shader finds it in the fractional part of the layer.
    const isLip = rr > r1 - 0.02;
    const lip = isLip ? 0.02 : 0;
    positions[i * 3] = Math.cos(a) * rr * 1.25;
    positions[i * 3 + 1] = rim - k * step + lip + (rng.next() - 0.5) * 0.006;
    positions[i * 3 + 2] = Math.sin(a) * rr;
    layer[i] = k + (isLip ? 0.5 : 0);
  }
  return { positions, layer };
}

/** Fireflies loose over the meadow around the bust, low above the ground. */
export function meadowSwarm(n: number, rng: Rng, radius = 4.2, low = -0.82, high = -0.35): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt(rng.next());
    const a = rng.next() * Math.PI * 2;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = low + rng.next() * (high - low);
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}

/** Reorder `b` so that the point paired with a[i] has the same height rank in b as a[i] has in a. */
export function pairByHeight(a: Float32Array, b: Float32Array, layerB?: Float32Array): { b: Float32Array; layer?: Float32Array } {
  const n = a.length / 3;
  const byHeight = (arr: Float32Array) => Array.from({ length: n }, (_, i) => i).sort((i, j) => arr[j * 3 + 1]! - arr[i * 3 + 1]!);
  const rankA = new Int32Array(n);
  byHeight(a).forEach((idx, rank) => (rankA[idx] = rank));
  const orderB = byHeight(b);
  const outB = new Float32Array(n * 3);
  const outL = layerB ? new Float32Array(n) : undefined;
  for (let i = 0; i < n; i++) {
    const j = orderB[rankA[i]!]!;
    outB[i * 3] = b[j * 3]!;
    outB[i * 3 + 1] = b[j * 3 + 1]!;
    outB[i * 3 + 2] = b[j * 3 + 2]!;
    if (outL && layerB) outL[i] = layerB[j]!;
  }
  return outL ? { b: outB, layer: outL } : { b: outB };
}

export function buildBustTargets(mesh: { positions: Float32Array; indices: Uint16Array | Uint32Array }, n: number, rng: Rng): BustTargets {
  const bust = sampleSurface(mesh.positions, mesh.indices, n, rng);
  const pondRaw = terracedPond(n, rng);
  const paired = pairByHeight(bust, pondRaw.positions, pondRaw.layer);
  const swarm = meadowSwarm(n, rng);
  const rand = new Float32Array(n * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = rng.next();
  return { count: n, bust, pond: paired.b, swarm, layer: paired.layer!, rand };
}

/** Parse public/models/bust_m0.bin ('ZVB1', counts, f32 xyz, u16 indices). */
export function parseBustMesh(buf: ArrayBuffer): { positions: Float32Array; indices: Uint16Array } {
  const view = new DataView(buf);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'ZVB1') throw new Error(`bust mesh: bad magic ${magic}`);
  const nv = view.getUint32(4, true);
  const nt = view.getUint32(8, true);
  const positions = new Float32Array(buf.slice(12, 12 + nv * 12));
  const indices = new Uint16Array(buf.slice(12 + nv * 12, 12 + nv * 12 + nt * 6));
  if (indices.length !== nt * 3) throw new Error('bust mesh: truncated');
  return { positions, indices };
}

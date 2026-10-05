import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.ts';
import { CACHE_LINE, CONTEXT_LAYERS, LAYER_COLORS, buildBustTargets, meadowSwarm, pairByHeight, parseBustMesh, sampleSurface, terracedPond } from './bust.ts';

// A unit square in the XY plane (two triangles) and a tiny "tower" for pairing checks.
const square = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]) };

describe('sampleSurface', () => {
  it('puts every sample on the surface and covers it evenly', () => {
    const pts = sampleSurface(square.positions, square.indices, 4000, createRng(1));
    let left = 0;
    for (let i = 0; i < 4000; i++) {
      const x = pts[i * 3]!;
      const y = pts[i * 3 + 1]!;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
      expect(pts[i * 3 + 2]).toBe(0);
      if (x < 0.5) left++;
    }
    expect(left / 4000).toBeGreaterThan(0.46);
    expect(left / 4000).toBeLessThan(0.54);
  });

  it('weights triangles by area', () => {
    // A big triangle (area 50) and a tiny one (area 0.5): ~1% of samples land on the tiny one.
    const positions = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 20, 0, 0, 21, 0, 0, 20, 1, 0]);
    const pts = sampleSurface(positions, new Uint16Array([0, 1, 2, 3, 4, 5]), 20000, createRng(2));
    let tiny = 0;
    for (let i = 0; i < 20000; i++) if (pts[i * 3]! >= 20) tiny++;
    expect(tiny / 20000).toBeGreaterThan(0.005);
    expect(tiny / 20000).toBeLessThan(0.016);
  });
});

describe('terracedPond', () => {
  it('steps down one terrace per context block, top block outermost', () => {
    const { positions, layer } = terracedPond(6000, createRng(3));
    const seen = new Set<number>();
    const meanY = new Array<number>(CONTEXT_LAYERS.length).fill(0);
    const meanR = new Array<number>(CONTEXT_LAYERS.length).fill(0);
    const counts = new Array<number>(CONTEXT_LAYERS.length).fill(0);
    for (let i = 0; i < 6000; i++) {
      const k = Math.floor(layer[i]!);
      seen.add(k);
      counts[k]!++;
      meanY[k]! += positions[i * 3 + 1]!;
      meanR[k]! += Math.hypot(positions[i * 3]! / 1.25, positions[i * 3 + 2]!);
    }
    expect(seen.size).toBe(CONTEXT_LAYERS.length);
    for (let k = 1; k < CONTEXT_LAYERS.length; k++) {
      expect(meanY[k]! / counts[k]!).toBeLessThan(meanY[k - 1]! / counts[k - 1]!);
      expect(meanR[k]! / counts[k]!).toBeLessThan(meanR[k - 1]! / counts[k - 1]!);
    }
  });
});

describe('pairByHeight', () => {
  it('sends the highest bust point to the highest pond point', () => {
    const a = new Float32Array([0, 1, 0, 0, 3, 0, 0, 2, 0]);
    const b = new Float32Array([5, 10, 0, 6, 30, 0, 7, 20, 0]);
    const { b: out } = pairByHeight(a, b);
    expect(Array.from(out)).toEqual([5, 10, 0, 6, 30, 0, 7, 20, 0]);
    const shuffled = pairByHeight(new Float32Array([0, 3, 0, 0, 1, 0, 0, 2, 0]), b).b;
    expect([shuffled[1], shuffled[4], shuffled[7]]).toEqual([30, 10, 20]);
  });
});

describe('buildBustTargets', () => {
  it('is deterministic per seed and keeps every array the same length', () => {
    const t1 = buildBustTargets(square, 500, createRng('bust'));
    const t2 = buildBustTargets(square, 500, createRng('bust'));
    expect(t1.bust).toEqual(t2.bust);
    expect(t1.pond).toEqual(t2.pond);
    for (const arr of [t1.bust, t1.pond, t1.swarm]) expect(arr.length).toBe(1500);
    expect(t1.layer.length).toBe(500);
    expect(t1.rand.length).toBe(2000);
  });

  it('keeps the swarm low over the meadow', () => {
    const s = meadowSwarm(1000, createRng(4));
    for (let i = 0; i < 1000; i++) {
      expect(s[i * 3 + 1]).toBeLessThan(-0.3);
      expect(Math.hypot(s[i * 3]!, s[i * 3 + 2]!)).toBeLessThanOrEqual(4.2 + 1e-6);
    }
  });
});

describe('parseBustMesh', () => {
  it('reads the ZVB1 format and rejects anything else', () => {
    const buf = new ArrayBuffer(12 + 3 * 12 + 6);
    const v = new DataView(buf);
    'ZVB1'.split('').forEach((c, i) => v.setUint8(i, c.charCodeAt(0)));
    v.setUint32(4, 3, true);
    v.setUint32(8, 1, true);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((x, i) => v.setFloat32(12 + i * 4, x, true));
    [0, 1, 2].forEach((x, i) => v.setUint16(48 + i * 2, x, true));
    const m = parseBustMesh(buf);
    expect(m.positions.length).toBe(9);
    expect(Array.from(m.indices)).toEqual([0, 1, 2]);
    v.setUint8(0, 'X'.charCodeAt(0));
    expect(() => parseBustMesh(buf)).toThrow(/magic/);
  });
});

describe('context layers', () => {
  it('has a colour for every block and the cache line inside the list', () => {
    expect(LAYER_COLORS.length).toBe(CONTEXT_LAYERS.length);
    expect(CONTEXT_LAYERS[0]).toBe('identity');
    expect(CONTEXT_LAYERS[CONTEXT_LAYERS.length - 1]).toBe('voice');
    expect(CACHE_LINE).toBeGreaterThan(0);
    expect(CACHE_LINE).toBeLessThan(CONTEXT_LAYERS.length);
  });
});

import { describe, expect, it } from 'vitest';
import { resolveShot, shiftToViewOffset, smootherstep, validateKeys, verticalFovDeg, type Key } from './director.ts';

const shot = (x: number, lens = 28) => ({
  position: [x, 10, 0] as const,
  target: [x, 0, -100] as const,
  lensMm: lens,
  shiftX: 0,
  shiftY: 0,
});

const KEYS: Key[] = [
  { at: 0, hold: 0.05, shot: shot(0), tod: 0 },
  { at: 0.5, hold: 0.05, shot: shot(100, 50), tod: 0.5, arc: 20 },
  { at: 1, hold: 0.05, shot: shot(200), tod: 1 },
];

describe('director', () => {
  it('holds each shot on its plateau so the camera settles before text', () => {
    expect(resolveShot(KEYS, 0.03).position[0]).toBe(0);
    expect(resolveShot(KEYS, 0.53).position[0]).toBe(100);
    expect(resolveShot(KEYS, 0.47).moving).toBe(0);
    expect(resolveShot(KEYS, 1).position[0]).toBe(200);
  });

  it('is continuous across every plateau boundary', () => {
    for (const edge of [0.05, 0.45, 0.55, 0.95]) {
      const a = resolveShot(KEYS, edge - 1e-6);
      const b = resolveShot(KEYS, edge + 1e-6);
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(a.position[i]! - b.position[i]!)).toBeLessThan(1e-3);
        expect(Math.abs(a.target[i]! - b.target[i]!)).toBeLessThan(1e-3);
      }
      expect(Math.abs(a.lensMm - b.lensMm)).toBeLessThan(1e-3);
    }
  });

  it('cranes up mid-move and lands back on the key height', () => {
    const mid = resolveShot(KEYS, 0.25);
    expect(mid.position[1]).toBeCloseTo(10 + 20 * Math.sin(Math.PI * smootherstep(0.5)), 5);
    expect(mid.moving).toBeCloseTo(1, 5);
    expect(resolveShot(KEYS, 0.45).position[1]).toBeCloseTo(10, 5);
  });

  it('moves time of day linearly even while the camera holds', () => {
    expect(resolveShot(KEYS, 0).tod).toBe(0);
    expect(resolveShot(KEYS, 0.04).tod).toBeCloseTo(0.04, 6);
    expect(resolveShot(KEYS, 0.75).tod).toBeCloseTo(0.75, 6);
    expect(resolveShot(KEYS, 2).tod).toBe(1);
    expect(resolveShot(KEYS, -1).tod).toBe(0);
  });

  it('names the nearest key as the current act', () => {
    expect(resolveShot(KEYS, 0.2).key).toBe(0);
    expect(resolveShot(KEYS, 0.3).key).toBe(1);
    expect(resolveShot(KEYS, 0.9).key).toBe(2);
  });

  it('rejects keys that are out of order or whose plateaus overlap', () => {
    expect(() => validateKeys(KEYS)).not.toThrow();
    expect(() => validateKeys([KEYS[1]!, KEYS[0]!])).toThrow(/not after/);
    expect(() => validateKeys([{ ...KEYS[0]!, hold: 0.3 }, { ...KEYS[1]!, hold: 0.3 }])).toThrow(/overlap/);
    expect(() => validateKeys([])).toThrow(/no keys/);
  });
});

describe('lens maths', () => {
  it('matches Blender: a 28 mm lens at 16:9 sees ~39.8° vertically', () => {
    expect(verticalFovDeg(28, 16 / 9)).toBeCloseTo(39.76, 1);
  });

  it('fits the sensor to the larger side, so portrait frames open up', () => {
    expect(verticalFovDeg(28, 9 / 16)).toBeCloseTo(65.47, 1);
  });

  it('turns lens shift into a top-left pixel offset', () => {
    expect(shiftToViewOffset(0.17, 0.02, 1600, 900)).toEqual({ x: 272, y: -32 });
    expect(shiftToViewOffset(0, -0.07, 390, 844).y).toBeCloseTo(59.08, 2);
  });
});

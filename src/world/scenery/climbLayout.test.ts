import { describe, expect, it } from 'vitest';
import { groundRise, SCENES } from '../journey.ts';
import { CAMPS, CLIMBERS, climberAt, FACE, FACE_RIDGE, FACE_SUMMIT, faceLocal, faceRidgeY, PEAK, ROUTE, snowAt, summitBlend, summitProfile } from './climbLayout.ts';

describe('the summit ridge', () => {
  it('peaks at the flag, above the shoulder that carries the words', () => {
    for (let dx = -900; dx <= 900; dx += 5) expect(summitProfile(dx)).toBeLessThanOrEqual(PEAK.y + 1e-6);
    expect(summitProfile(-600)).toBeGreaterThan(0);
    expect(summitProfile(PEAK.dx)).toBeCloseTo(PEAK.y, 6);
  });

  it('falls away into the clouds on the right', () => {
    expect(summitProfile(470)).toBeLessThan(-500);
    let prev = Infinity;
    for (let dx = 110; dx <= 900; dx += 10) {
      expect(summitProfile(dx)).toBeLessThanOrEqual(prev + 1e-6);
      prev = summitProfile(dx);
    }
  });

  it('takes over from the bank smoothly, well left of the words', () => {
    expect(summitBlend(-1200)).toBe(0);
    expect(summitBlend(-800)).toBe(1);
    for (let dx = -1200; dx < -800; dx += 4) expect(Math.abs(summitBlend(dx + 4) - summitBlend(dx))).toBeLessThan(0.05);
  });
});

describe('snow', () => {
  it('only lies above the treeline, which is above every valley scene', () => {
    for (const s of SCENES.filter((sc) => sc.y === 0)) expect(snowAt(s.x)).toBe(0);
    expect(snowAt(SCENES.find((s) => s.id === 'summit')!.x)).toBe(1);
    expect(groundRise(SCENES.find((s) => s.id === 'voice')!.x)).toBe(0);
  });
});

describe("K2's face", () => {
  it('rises from base camp to the summit, the highest point of its skyline', () => {
    for (const [, y] of FACE_RIDGE) expect(y).toBeLessThanOrEqual(FACE_SUMMIT.y);
    let prev = -Infinity;
    for (const c of CAMPS) {
      expect(c.y).toBeGreaterThan(prev);
      prev = c.y;
    }
    expect(FACE_SUMMIT.y).toBeGreaterThan(prev);
  });

  it('gives every camp a flat ledge on the skyline', () => {
    for (const c of CAMPS) {
      expect(faceRidgeY(c.x - c.half + 2)).toBeCloseTo(c.y, 0);
      expect(faceRidgeY(c.x)).toBeCloseTo(c.y, 0);
    }
  });

  it('keeps the route on the face, from base camp to the summit', () => {
    expect(ROUTE[0]![0]).toBe(CAMPS[0]!.x);
    expect(ROUTE.at(-1)![0]).toBe(FACE_SUMMIT.x);
    for (const [x, y] of ROUTE) expect(y).toBeLessThanOrEqual(faceRidgeY(x) + 1);
  });

  it('keeps climbers on the route, lamps lit only on the way up', () => {
    for (let t = 0; t < CLIMBERS.period; t += 1.7) {
      for (let k = 0; k < CLIMBERS.count; k++) {
        const c = climberAt(t, k);
        expect(c.on).toBeGreaterThanOrEqual(0);
        expect(c.on).toBeLessThanOrEqual(1);
        expect(c.y).toBeLessThanOrEqual(faceRidgeY(c.x) + 1);
        expect(c.x).toBeGreaterThanOrEqual(CAMPS[0]!.x - 6);
        expect(c.x).toBeLessThanOrEqual(FACE_SUMMIT.x + 1);
      }
    }
  });

  it('lands where it was drawn when the camera holds on the ascent (wide screen)', () => {
    // The engine: a layer sits at camX(1 - p), camY(1 - py) - sink·climb; on screen, minus the camera.
    const ascent = SCENES.find((s) => s.id === 'ascent')!;
    const [lx, ly] = faceLocal(120, -40);
    const sx = ascent.x - ascent.x * FACE.p + lx - ascent.x;
    const sy = ascent.y * (1 - FACE.p) - FACE.sink * ascent.y + ly - ascent.y;
    expect(sx).toBeCloseTo(120, 6);
    expect(sy).toBeCloseTo(-40, 6);
  });
});

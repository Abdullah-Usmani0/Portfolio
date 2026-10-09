import { describe, expect, it } from 'vitest';
import { leanTarget } from './tilt.ts';

describe('leanTarget', () => {
  it('follows the cursor', () => {
    expect(leanTarget({ x: 0.7, y: -0.4, active: true }, 12, 0)).toEqual({ x: 0.7, y: -0.4 });
  });

  it('drifts gently by itself with no cursor', () => {
    for (let t = 0; t < 120; t += 0.7) {
      const l = leanTarget({ x: 0, y: 0, active: false }, t, 0);
      expect(Math.abs(l.x)).toBeLessThanOrEqual(0.45);
      expect(Math.abs(l.y)).toBeLessThanOrEqual(0.3);
    }
  });

  it('dips while the page scrolls, never past a limit', () => {
    const still = leanTarget({ x: 0, y: 0, active: true }, 0, 0);
    expect(leanTarget({ x: 0, y: 0, active: true }, 0, 0.5).y).toBeGreaterThan(still.y);
    expect(leanTarget({ x: 0, y: 0, active: true }, 0, -0.5).y).toBeLessThan(still.y);
    expect(leanTarget({ x: 0, y: 0, active: true }, 0, 40).y).toBeCloseTo(0.6);
  });
});

import { describe, expect, it } from 'vitest';
import { hazeAt } from './haze.ts';

describe('height haze', () => {
  it('matches the flat Blender haze at the valley floor', () => {
    const flat = 0.42 * (1 - Math.exp(-800 / 1700));
    expect(hazeAt(0.42, 1700, 800, 0, 0)).toBeCloseTo(flat, 6);
  });

  it('lets the summit stand clear of the haze its own base sits in', () => {
    const base = hazeAt(0.42, 1700, 5600, 47, 150);
    const summit = hazeAt(0.42, 1700, 5650, 47, 1634);
    expect(summit).toBeLessThan(base * 0.8);
    expect(summit).toBeGreaterThan(0.1);
  });

  it('is symmetric in the two heights and never exceeds hazeMax', () => {
    expect(hazeAt(0.4, 1500, 3000, 900, 40)).toBeCloseTo(hazeAt(0.4, 1500, 3000, 40, 900), 9);
    expect(hazeAt(0.4, 1500, 1e9, 0, 0)).toBeLessThanOrEqual(0.4);
  });

  it('is continuous where the heights meet', () => {
    expect(Math.abs(hazeAt(0.4, 1500, 2000, 100, 100.99) - hazeAt(0.4, 1500, 2000, 100, 101.01))).toBeLessThan(1e-3);
  });
});

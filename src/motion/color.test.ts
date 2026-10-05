import { describe, expect, it } from 'vitest';
import { contrast, luminance, mixHex, smootherstep } from './color.ts';

describe('mixHex', () => {
  it('returns the ends exactly', () => {
    expect(mixHex('#102030', '#f0e0d0', 0)).toBe('#102030');
    expect(mixHex('#102030', '#f0e0d0', 1)).toBe('#f0e0d0');
  });

  it('round-trips a colour through OKLab', () => {
    expect(mixHex('#9a627e', '#9a627e', 0.5)).toBe('#9a627e');
  });

  it('mixes perceptually, between the two lightnesses', () => {
    const mid = luminance(mixHex('#000000', '#ffffff', 0.5));
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(0.3);
  });
});

describe('contrast', () => {
  it('matches WCAG for black on white', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('smootherstep', () => {
  it('clamps and eases', () => {
    expect(smootherstep(-1)).toBe(0);
    expect(smootherstep(2)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smootherstep(0.999999)).toBeLessThanOrEqual(1);
  });
});

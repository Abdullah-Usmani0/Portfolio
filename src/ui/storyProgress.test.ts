import { describe, expect, it } from 'vitest';
import { storyProgress } from './storyProgress.ts';

describe('storyProgress', () => {
  const centers = [450, 1500, 2700, 3900, 4950];

  it('lands each section centre exactly on its key', () => {
    centers.forEach((c, i) => expect(storyProgress(centers, c)).toBeCloseTo(i / 4, 9));
  });

  it('is linear between neighbouring centres, whatever their spacing', () => {
    expect(storyProgress(centers, (450 + 1500) / 2)).toBeCloseTo(0.125, 9);
    expect(storyProgress(centers, 1500 + 0.25 * 1200)).toBeCloseTo(0.25 + 0.0625, 9);
  });

  it('clamps before the first and after the last section', () => {
    expect(storyProgress(centers, 0)).toBe(0);
    expect(storyProgress(centers, 99999)).toBe(1);
  });

  it('degrades to 0 with fewer than two sections', () => {
    expect(storyProgress([], 100)).toBe(0);
    expect(storyProgress([300], 900)).toBe(0);
  });
});

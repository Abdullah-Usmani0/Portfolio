import { describe, expect, it } from 'vitest';
import { splitLine } from '../gl/flat.ts';

describe('splitLine', () => {
  const xs = [0, 10, 20, 30, 40];
  const ys = [0, 10, 0, 10, 0];

  it('cuts a silhouette into before, between and after, meeting exactly at the cuts', () => {
    const [before, mid, after] = splitLine(xs, ys, 15, 30);
    expect(before.xs).toEqual([0, 10, 15]);
    expect(before.ys).toEqual([0, 10, 5]);
    expect(mid.xs).toEqual([15, 20, 30]);
    expect(mid.ys).toEqual([5, 0, 10]);
    expect(after.xs).toEqual([30, 40]);
    expect(after.ys).toEqual([10, 0]);
  });

  it('leaves a side empty when the cut is past the end', () => {
    const [before, mid, after] = splitLine(xs, ys, -5, 99);
    expect(before.xs.length).toBeLessThan(2);
    expect(after.xs.length).toBeLessThan(2);
    expect(mid.xs).toEqual(xs);
  });
});

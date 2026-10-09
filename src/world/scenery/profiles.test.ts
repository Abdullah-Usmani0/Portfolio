import { describe, expect, it } from 'vitest';
import { sceneryProfiles } from './profiles.ts';

const data = sceneryProfiles();
const finite = (a: number[]) => a.every((v) => Number.isFinite(v));

describe('sceneryProfiles', () => {
  it('gives every line its points in matching numbers, all finite', () => {
    const b = data.bank;
    for (const a of [b.ys, b.ground, b.lift, b.rock, b.snow]) {
      expect(a.length).toBe(b.xs.length);
      expect(finite(a)).toBe(true);
    }
    for (const r of data.ridges) for (const a of [r.ys, r.ground]) expect(a.length).toBe(r.xs.length);
    const v = data.valley;
    for (const a of [v.ground, v.riverTop, v.riverBottom]) expect(a.length).toBe(v.xs.length);
    expect(v.cliff.ground.length).toBe(v.cliff.xs.length);
  });

  it('runs every line left to right', () => {
    for (const xs of [data.bank.xs, data.valley.xs, data.valley.cliff.xs, ...data.ridges.map((r) => r.xs)]) {
      for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    }
  });

  it('round-trips through JSON unchanged', () => {
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

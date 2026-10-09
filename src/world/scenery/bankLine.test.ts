import { describe, expect, it } from 'vitest';
import { groundRise, SCENES } from '../journey.ts';
import { bankLine } from './bankLine.ts';
import { snowAt, TREELINE } from './climbLayout.ts';

const bank = bankLine();

describe('bankLine', () => {
  it('keeps the tall pines out of every scene’s words and set piece, and below the treeline', () => {
    expect(bank.trees.length).toBeGreaterThan(5);
    for (const t of bank.trees) {
      for (const s of SCENES) expect(t.x > s.x - 980 && t.x < s.x + 660).toBe(false);
      expect(groundRise(t.x)).toBeLessThanOrEqual(TREELINE);
    }
  });

  it('never draws its silhouette below its own ground', () => {
    expect(bank.ys.length).toBe(bank.ground.length);
    bank.ys.forEach((y, i) => expect(y).toBeGreaterThanOrEqual(bank.ground[i]! - 1e-9));
  });

  it('lays its snow crest only where the ridge is high enough to hold snow', () => {
    expect(bank.crest.xs.length).toBeGreaterThan(0);
    bank.crest.xs.forEach((x, i) => {
      expect(snowAt(x)).toBeGreaterThan(0);
      expect(bank.crest.bottom[i]!).toBeLessThan(bank.crest.top[i]!);
    });
  });
});

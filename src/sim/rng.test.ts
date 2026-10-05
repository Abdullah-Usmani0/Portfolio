import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from './rng.ts';

describe('createRng', () => {
  it('replays identically for the same seed', () => {
    const a = createRng('zero-valley');
    const b = createRng('zero-valley');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it('stays inside its ranges', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('shuffles without losing or inventing elements', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = createRng(7).shuffle(items);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('refuses to pick from nothing', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });

  it('hashes strings stably', () => {
    expect(hashSeed('k2')).toBe(hashSeed('k2'));
    expect(hashSeed('k2')).not.toBe(hashSeed('everest'));
  });
});

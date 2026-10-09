import { describe, expect, it } from 'vitest';
import { placeGrass, type Meadow } from './grass.ts';

const meadow = (over: Partial<Meadow> = {}): Meadow => ({
  x0: 0,
  x1: 2000,
  edge: () => -100,
  meadow: () => 1,
  tufts: () => true,
  shade: () => 1,
  deg: () => -6,
  density: 0.85,
  seed: 17,
  ...over,
});

describe('placeGrass', () => {
  it('is the same meadow every time for the same seed', () => {
    const a = placeGrass(meadow());
    const b = placeGrass(meadow());
    expect(a.count).toBeGreaterThan(500);
    expect(Array.from(a.root)).toEqual(Array.from(b.root));
    expect(Array.from(a.shape)).toEqual(Array.from(b.shape));
  });

  it('grows nothing where the ground is not meadow', () => {
    const g = placeGrass(meadow({ meadow: (x) => (x < 1000 ? 1 : 0) }));
    for (let i = 0; i < g.count; i++) expect(g.root[i * 2]!).toBeLessThan(1012);
  });

  it('roots every blade on or below the edge, never above it', () => {
    const g = placeGrass(meadow());
    for (let i = 0; i < g.count; i++) expect(g.root[i * 2 + 1]!).toBeLessThanOrEqual(-100);
  });

  it('keeps tufts off a slope that asks for none', () => {
    const g = placeGrass(meadow({ tufts: () => false }));
    // Without tufts every blade stands within a few units of the edge.
    for (let i = 0; i < g.count; i++) expect(g.root[i * 2 + 1]!).toBeGreaterThan(-114);
  });

  it('grows it shorter where it is asked to', () => {
    const tallest = (g: ReturnType<typeof placeGrass>) => Math.max(...Array.from({ length: g.count }, (_, i) => g.shape[i * 4]!));
    const full = placeGrass(meadow());
    const half = placeGrass(meadow({ height: () => 0.5 }));
    expect(tallest(half)).toBeLessThan(tallest(full) * 0.75);
  });
});

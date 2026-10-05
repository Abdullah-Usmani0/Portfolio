import { describe, expect, it } from 'vitest';
import { CRATE, OUTCOMES, crateAt, farmLayout } from './farmLayout.ts';
import { groundY } from './valley.ts';

const L = farmLayout();

describe('the farm', () => {
  it('runs its chute from the barn down to the dock, never through the hill', () => {
    const [start] = L.chute;
    const end = L.chute.at(-1)!;
    expect(start![0]).toBeCloseTo(L.barn.x + L.barn.w + 2, 5);
    expect(end[0]).toBeGreaterThanOrEqual(L.dock.x0);
    expect(end[0]).toBeLessThanOrEqual(L.dock.x1);
    for (const [x, y] of L.chute.slice(1, -1)) {
      const surface = x <= L.x1 ? L.hillTop(x) : groundY(x);
      expect(y).toBeGreaterThan(surface);
    }
    // Downhill all the way: a crate never has to climb.
    for (let i = 1; i < L.chute.length; i++) expect(L.chute[i]![1]).toBeLessThanOrEqual(L.chute[i - 1]![1] + 1);
  });

  it('sits the barn and silo on level ground', () => {
    const ys = [L.silo.x, L.barn.x, L.barn.x + L.barn.w].map((x) => L.hillTop(x));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1.5);
  });
});

describe('a crate', () => {
  it('leaves the barn, is inspected on the dock, and is passed, sent back or set aside', () => {
    const seen = new Set<string>();
    for (let k = 0; k < CRATE.crates; k++) {
      for (let cycle = 0; cycle < OUTCOMES.length; cycle++) {
        const t0 = cycle * CRATE.period - (k * CRATE.period) / CRATE.crates;
        if (t0 < 0) continue;
        const at = (u: number) => crateAt(L, t0 + u, k);
        expect(at(0.3).x).toBeCloseTo(L.alongChute(0)[0], 5);
        expect(at(CRATE.stamp - 0.1).x).toBeCloseTo(L.inspectAt, 5);
        const mark = at(CRATE.inspect - 0.1).mark;
        expect(mark).not.toBeNull();
        seen.add(mark!);
        if (mark === 'pass') expect(at(CRATE.period - 0.5).x).toBeGreaterThan(L.dock.x1);
        if (mark === 'reask') expect(at(CRATE.inspect + 2).x).toBeLessThan(L.dock.x0);
        if (mark === 'reject') expect(at(CRATE.inspect + 2).x).toBeLessThan(L.inspectAt);
      }
    }
    expect([...seen].sort()).toEqual(['pass', 'reask', 'reject']);
  });

  it('is passed more often than not', () => {
    expect(OUTCOMES.filter((o) => o === 'pass').length / OUTCOMES.length).toBeGreaterThan(0.5);
  });
});

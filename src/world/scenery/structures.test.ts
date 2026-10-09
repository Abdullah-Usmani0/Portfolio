import { describe, expect, it } from 'vitest';
import { BUILDINGS, councilsLayout, windowGrid } from './councilsLayout.ts';
import { gorgeLayout, provingLayout } from './provingLayout.ts';
import { FARM_CROPS, structures } from './structures.ts';

describe('structures', () => {
  const all = structures();

  it('names every structure once, and builds each with a known kind', () => {
    const ids = all.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = ['house', 'observatory', 'tower', 'workshop', 'lighthouse', 'academy', 'studio', 'fields', 'barn', 'silo', 'mill', 'sails', 'dock', 'gorge-wall', 'gorge-shoulders', 'bridge', 'owl', 'desk', 'lamp', 'flag', 'stage', 'truss', 'truss-tower'];
    for (const s of all) expect(kinds).toContain(s.kind);
  });

  it('numbers each council building as its dive does', () => {
    const councils = all.filter((s) => s.scene === 'councils');
    expect(councils.map((s) => s.building).sort()).toEqual(BUILDINGS.map((_, k) => k));
  });

  it('gives the farm one crop per painted row, and a hill above the valley floor', () => {
    const fields = all.find((s) => s.kind === 'fields')!.p;
    expect((fields.rows as number[]).length).toBe(FARM_CROPS.length);
    const top = fields.top as number[];
    const ground = fields.ground as number[];
    // Somewhere the hill is tall enough for every row.
    const lowest = (fields.rows as number[]).at(-1)! + 10;
    expect(top.some((t, i) => t - lowest > ground[i]!)).toBe(true);
  });
});

describe('councilsLayout', () => {
  it('fits each grid of windows inside the wall it is laid on', () => {
    const panes = windowGrid(0, 100, 0, 60, 4, 2, 1);
    expect(panes).toHaveLength(8);
    for (const [x, y, w, h] of panes) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y + h).toBeLessThanOrEqual(60);
    }
  });

  it('keeps the observatory and academy windows on their walls', () => {
    const L = councilsLayout();
    for (const b of [L.research, L.training]) {
      for (const [x, y, w, h] of b.windows) {
        expect(x).toBeGreaterThan(b.x);
        expect(x + w).toBeLessThan(b.x + b.w);
        expect(y).toBeGreaterThan(b.y);
        expect(y + h).toBeLessThan(b.y + b.h);
      }
    }
  });
});

describe('gorgeLayout', () => {
  it('lets the trail run over each shoulder, which falls away to the water at the gorge', () => {
    const L = provingLayout();
    const G = gorgeLayout(L);
    for (const sh of G.shoulders) {
      const outer = sh.side < 0 ? sh.from + 10 : sh.to - 10;
      const inner = sh.side < 0 ? sh.to : sh.from;
      // Near the trail on its outer part, and down at the water by the cascade.
      expect(Math.abs(sh.top(outer) - (L.trail(outer) - 3))).toBeLessThan(4);
      expect(sh.top(inner)).toBeLessThan(L.deckY - 20);
    }
  });
});

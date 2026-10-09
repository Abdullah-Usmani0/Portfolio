import { describe, expect, it } from 'vitest';
import index from '../data/foregroundRender.json';
import { CLIP_SLOTS } from '../gl/flat.ts';

/** Every rendered tile's texture file, listed (not loaded). */
const FILES = Object.keys(import.meta.glob('../textures/foreground/*.webp', { query: '?url', import: 'default' }));

type Tile = { i: number; x0: number; x1: number; y0: number; y1: number };
const layers = Object.entries((index as { layers: Record<string, { tiles: Tile[] }> }).layers);

describe('the rendered foreground', () => {
  it('lays each layer out in tiles of one width, edge to edge, in order', () => {
    for (const [, layer] of layers) {
      const width = layer.tiles[0]!.x1 - layer.tiles[0]!.x0;
      layer.tiles.forEach((t, k) => {
        expect(t.i).toBe(k);
        expect(t.x1 - t.x0).toBe(width);
        if (k > 0) expect(t.x0).toBe(layer.tiles[k - 1]!.x1);
        expect(t.y1).toBeGreaterThan(t.y0);
        // Heights in whole steps of 8, so every stored size keeps whole rows.
        expect((t.y1 - t.y0) % 8).toBe(0);
      });
    }
  });

  it('fits every layer in one clip, so the painted layers share one shader', () => {
    for (const [, layer] of layers) {
      const width = layer.tiles[0]!.x1 - layer.tiles[0]!.x0;
      expect(Math.round((layer.tiles.at(-1)!.x1 - layer.tiles[0]!.x0) / width)).toBeLessThanOrEqual(CLIP_SLOTS);
    }
  });

  it('has every tile’s light and mask, full size and half', () => {
    for (const [name, layer] of layers) {
      for (const t of layer.tiles) {
        const id = `${name}-${String(t.i).padStart(2, '0')}`;
        for (const kind of ['light', 'mask', 'light-half', 'mask-half']) expect(FILES).toContain(`../textures/foreground/${id}-${kind}.webp`);
      }
    }
  });
});

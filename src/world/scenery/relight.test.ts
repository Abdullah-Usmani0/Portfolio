import { describe, expect, it } from 'vitest';
import { SCENES, sceneIndex } from '../journey.ts';
import { WORLD_LOOKS } from '../palette.ts';
import { linear, relight } from './relight.ts';

const at = (id: string) => relight(WORLD_LOOKS[SCENES[sceneIndex(id)]!.look]);
const brightness = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('relight', () => {
  it('is finite for every hour, and the two suns share the light', () => {
    for (const look of Object.values(WORLD_LOOKS)) {
      const r = relight(look);
      for (const v of [...r.sun, ...r.sky, ...r.haze, r.left, r.right, r.hazeKm, r.glowDeg]) expect(Number.isFinite(v)).toBe(true);
      expect(r.left + r.right).toBeCloseTo(1, 9);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeGreaterThanOrEqual(0);
    }
  });

  it('lights from the side the sun is on', () => {
    expect(at('top').left).toBeGreaterThan(0.7); // dawn, sun to the left
    expect(at('learners').right).toBeGreaterThan(0.9); // golden hour, sun to the right
    const noon = at('councils');
    expect(Math.abs(noon.left - noon.right)).toBeLessThan(0.6);
  });

  it('is far brighter by day than by moonlight', () => {
    expect(brightness(at('councils').sun)).toBeGreaterThan(brightness(at('mind').sun) * 4);
    expect(brightness(at('councils').sky)).toBeGreaterThan(brightness(at('voice').sky) * 2);
  });

  it('lights every mountain while the sun is up, and only the peaks as it sets', () => {
    expect(at('councils').glowDeg).toBeLessThan(-20);
    expect(at('top').glowDeg).toBeLessThan(-15);
    expect(at('npcs').glowDeg).toBeGreaterThan(10); // dusk: the summit alone
    expect(at('npcs').glowDeg).toBeLessThan(19);
  });

  it('turns palette colours into linear light', () => {
    expect(linear('#ffffff')).toEqual([1, 1, 1]);
    expect(linear('#000000')).toEqual([0, 0, 0]);
    expect(linear('#808080')[0]).toBeCloseTo(0.2159, 3);
  });
});

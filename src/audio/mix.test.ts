import { describe, expect, it } from 'vitest';
import { SCENES } from '@/world/journey.ts';
import { DIVE_DUCK, LAYERS, MASTER, mixAt, PAGE_DUCK, SCENE_SOUNDS, type Layer } from './mix.ts';

const index = (id: string) => SCENES.findIndex((s) => s.id === id);
const calm = { dark: false, diving: false, away: false };
/** Where along the journey a layer is loudest (by day, so nothing is gated). */
const peak = (layer: Layer, dark = false) => {
  let best = { s: 0, v: -1 };
  for (let s = 0; s <= SCENES.length - 1; s += 0.05) {
    const v = mixAt({ ...calm, dark, s }).levels[layer];
    if (v > best.v) best = { s, v };
  }
  return Math.round(best.s);
};

describe('the valley’s sound', () => {
  it('describes every scene the journey visits', () => {
    for (const scene of SCENES) expect(SCENE_SOUNDS[scene.id], scene.id).toBeDefined();
  });

  it('keeps every level between silence and full, and the whole valley quiet', () => {
    for (let s = -1; s <= SCENES.length + 1; s += 0.1) {
      for (const dark of [false, true]) {
        const { master, levels } = mixAt({ s, dark, diving: false, away: false });
        expect(master).toBeLessThanOrEqual(MASTER);
        for (const k of LAYERS) {
          expect(levels[k]).toBeGreaterThanOrEqual(0);
          expect(levels[k]).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(mixAt({ ...calm, s: Number.NaN }).levels.wind).toBe(SCENE_SOUNDS.top!.wind);
  });

  it('turns the windmill at the farm, the falls at the gorge and the bell in the village', () => {
    expect(peak('windmill')).toBe(index('scenarios'));
    expect(peak('waterfall')).toBe(index('learners'));
    expect(peak('bell')).toBe(index('npcs'));
    expect(peak('lake')).toBe(index('voice'));
  });

  it('lets birds sing only by day, and crickets and the owl only at night', () => {
    for (let s = 0; s <= SCENES.length - 1; s += 0.25) {
      const day = mixAt({ ...calm, s, dark: false }).levels;
      const night = mixAt({ ...calm, s, dark: true }).levels;
      expect(day.crickets).toBe(0);
      expect(day.owl).toBe(0);
      expect(night.birds).toBe(0);
    }
    expect(mixAt({ ...calm, s: index('councils') }).levels.birds).toBeGreaterThan(0.4);
    expect(mixAt({ ...calm, s: index('mind'), dark: true }).levels.crickets).toBeGreaterThan(0.6);
  });

  it('cross-fades between scenes without a jump', () => {
    let prev = mixAt({ ...calm, s: 0 }).levels;
    for (let s = 0.01; s <= SCENES.length - 1; s += 0.01) {
      const next = mixAt({ ...calm, s }).levels;
      for (const k of LAYERS) expect(Math.abs(next[k] - prev[k]), `${k} at ${s.toFixed(2)}`).toBeLessThan(0.05);
      prev = next;
    }
  });

  it('steps back for a dive, and further behind a reading page', () => {
    const s = index('scenarios');
    expect(mixAt({ ...calm, s }).master).toBe(MASTER);
    expect(mixAt({ ...calm, s, diving: true }).master).toBeCloseTo(MASTER * DIVE_DUCK);
    expect(mixAt({ ...calm, s, away: true }).master).toBeCloseTo(MASTER * PAGE_DUCK);
  });
});

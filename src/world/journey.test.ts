import { describe, expect, it } from 'vitest';
import { luminance } from '@/motion/color.ts';
import { groundRise, PLATEAU, SCENES, shotAt, trailY } from './journey.ts';
import { WORLD_LOOKS } from './palette.ts';

describe('shotAt', () => {
  it('holds each scene exactly while it is centred', () => {
    SCENES.forEach((scene, i) => {
      const shot = shotAt(i);
      expect(shot.x).toBe(scene.x);
      expect(shot.look.skyTop).toBe(WORLD_LOOKS[scene.look].skyTop);
      expect(shotAt(i + 0.1).x).toBe(scene.x);
    });
  });

  it('glides between scenes without jumps', () => {
    let prev = shotAt(0);
    for (let s = 0.01; s <= SCENES.length - 1; s += 0.01) {
      const shot = shotAt(s);
      expect(Math.abs(shot.x - prev.x)).toBeLessThan(80);
      expect(Math.abs(luminance(shot.look.skyTop) - luminance(prev.look.skyTop))).toBeLessThan(0.05);
      prev = shot;
    }
  });

  it('moves forward only', () => {
    let prev = -Infinity;
    for (let s = 0; s <= SCENES.length - 1; s += 0.02) {
      const x = shotAt(s).x;
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
  });

  it('holds each narrow-screen pan at its scene and glides it between', () => {
    SCENES.forEach((scene, i) => expect(shotAt(i).pan).toBe(scene.pan));
    let prev = shotAt(0).pan;
    for (let s = 0.01; s <= SCENES.length - 1; s += 0.01) {
      const pan = shotAt(s).pan;
      expect(Math.abs(pan - prev)).toBeLessThan(40);
      prev = pan;
    }
  });

  it('runs through one day: each clock is later than the last, crossing midnight once', () => {
    const minutes = SCENES.map((s) => {
      const [h, m] = WORLD_LOOKS[s.look].clock.split(':').map(Number);
      return h! * 60 + m!;
    });
    const wraps = minutes.filter((m, i) => i > 0 && m <= minutes[i - 1]!).length;
    expect(wraps).toBe(1);
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
  });

  it('clamps outside the journey', () => {
    expect(shotAt(-2).x).toBe(SCENES[0]!.x);
    expect(shotAt(99).x).toBe(SCENES.at(-1)!.x);
  });

  it('climbs along the trail: wherever the camera is, it is at the height of the trail', () => {
    for (let s = 0; s <= SCENES.length - 1; s += 0.013) {
      const shot = shotAt(s);
      expect(shot.y).toBeCloseTo(trailY(shot.x), 6);
    }
    expect(trailY(SCENES[0]!.x - 500)).toBe(SCENES[0]!.y);
    expect(trailY(SCENES.at(-1)!.x + 500)).toBe(SCENES.at(-1)!.y);
  });

  it('only climbs, and only at the end: the valley scenes stay on the valley floor', () => {
    let prev = -Infinity;
    for (const scene of SCENES) {
      expect(scene.y).toBeGreaterThanOrEqual(prev);
      prev = scene.y;
    }
    expect(SCENES.filter((s) => s.y > 0).map((s) => s.id)).toEqual(['ascent', 'summit']);
  });

  it('holds the ground level under each scene, and climbs only between them', () => {
    for (const scene of SCENES) {
      for (let dx = -PLATEAU; dx <= PLATEAU; dx += 50) expect(groundRise(scene.x + dx)).toBeCloseTo(scene.y, 6);
    }
    let prev = groundRise(SCENES[0]!.x);
    for (let x = SCENES[0]!.x; x <= SCENES.at(-1)!.x; x += 25) {
      const y = groundRise(x);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(y - prev).toBeLessThan(40);
      prev = y;
    }
  });
});

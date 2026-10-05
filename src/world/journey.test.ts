import { describe, expect, it } from 'vitest';
import { luminance } from '@/motion/color.ts';
import { SCENES, shotAt } from './journey.ts';
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

  it('clamps outside the journey', () => {
    expect(shotAt(-2).x).toBe(SCENES[0]!.x);
    expect(shotAt(99).x).toBe(SCENES.at(-1)!.x);
  });
});

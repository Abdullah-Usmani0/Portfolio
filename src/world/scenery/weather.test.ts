import { describe, expect, it } from 'vitest';
import { SCENES, sceneIndex } from '../journey.ts';
import { WORLD_LOOKS } from '../palette.ts';
import { rayStrength, snowfall } from './weather.ts';

const look = (id: string) => WORLD_LOOKS[SCENES[sceneIndex(id)]!.look];

describe('rayStrength', () => {
  it('streams the sun at the ends of the day and never by moonlight', () => {
    for (const id of ['top', 'learners', 'summit']) expect(rayStrength(look(id))).toBeGreaterThan(0.7);
    for (const id of ['councils', 'scenarios', 'mind', 'voice', 'ascent']) expect(rayStrength(look(id))).toBe(0);
    expect(rayStrength(look('npcs'))).toBeGreaterThan(0);
    expect(rayStrength(look('npcs'))).toBeLessThan(0.5);
  });

  it('stays within 0–1 for any sun', () => {
    for (let y = -0.3; y <= 1; y += 0.01) {
      const r = rayStrength({ sunY: y, stars: 0 });
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });
});

describe('snowfall', () => {
  it('snows on the night climb and nowhere else', () => {
    const ascent = sceneIndex('ascent');
    expect(snowfall(ascent)).toBe(1);
    expect(snowfall(sceneIndex('voice'))).toBe(0);
    expect(snowfall(sceneIndex('summit'))).toBe(0);
    expect(snowfall(0)).toBe(0);
  });

  it('starts and stops gradually', () => {
    const ascent = sceneIndex('ascent');
    const way = snowfall(ascent - 0.4);
    expect(way).toBeGreaterThan(0);
    expect(way).toBeLessThan(1);
  });
});

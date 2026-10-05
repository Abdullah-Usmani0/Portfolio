import { describe, expect, it } from 'vitest';
import { LOOK_STOPS, LOOKS, bracket, fillColor, lightAt, lookWeights, nearestLook, sunDirection, type LookName } from './timeOfDay.ts';

const names = Object.keys(LOOK_STOPS) as LookName[];

describe('timeOfDay', () => {
  it('lands exactly on each named look at its stop', () => {
    for (const name of names) {
      const l = lightAt(LOOK_STOPS[name]);
      expect(l.sunIntensity).toBeCloseTo(LOOKS[name].sunIntensity, 6);
      expect(l.hazeMax).toBeCloseTo(LOOKS[name].hazeMax, 6);
      expect(l.windows).toBeCloseTo(LOOKS[name].windows, 6);
    }
  });

  it('is continuous: no jump anywhere along the dial', () => {
    const steps = 2000;
    let prev = lightAt(0);
    for (let i = 1; i <= steps; i++) {
      const cur = lightAt(i / steps);
      expect(Math.abs(cur.sunIntensity - prev.sunIntensity)).toBeLessThan(0.05);
      expect(Math.abs(cur.windows - prev.windows)).toBeLessThan(0.08);
      expect(Math.abs(cur.skyTop[2] - prev.skyTop[2])).toBeLessThan(0.02);
      prev = cur;
    }
  });

  it('clamps outside [0, 1]', () => {
    expect(lightAt(-3).sunElev).toBeCloseTo(LOOKS.dawn.sunElev);
    expect(lightAt(7).sunElev).toBeCloseTo(LOOKS.night.sunElev);
  });

  it('brackets by stop order', () => {
    expect(bracket(0.1)).toMatchObject({ from: 'dawn', to: 'day' });
    expect(bracket(0.6)).toMatchObject({ from: 'golden', to: 'dusk' });
    expect(bracket(0.9)).toMatchObject({ from: 'dusk', to: 'night' });
  });

  it('turns the village lights on as the day ends', () => {
    expect(lightAt(LOOK_STOPS.day).windows).toBe(0);
    expect(lightAt(LOOK_STOPS.night).windows).toBeGreaterThan(lightAt(LOOK_STOPS.dusk).windows);
    expect(lightAt(LOOK_STOPS.night).fireflies).toBeGreaterThan(0);
  });

  it('gives a unit sun direction that is above the horizon', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const [x, y, z] = sunDirection(lightAt(t));
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      expect(y).toBeGreaterThan(0);
    }
  });

  it('names the nearest look', () => {
    expect(nearestLook(0.02)).toBe('dawn');
    expect(nearestLook(0.8)).toBe('dusk');
  });
});

describe('fillColor', () => {
  it('leans towards the zenith colour', () => {
    const f = fillColor({ skyTop: [0, 0, 1], skyHorizon: [1, 0, 0] });
    expect(f[2]).toBeCloseTo(0.7, 9);
    expect(f[0]).toBeCloseTo(0.3, 9);
  });
});

describe('lookWeights', () => {
  it('is one-hot on each stop and always sums to one', () => {
    expect(lookWeights(LOOK_STOPS.dawn)).toEqual([1, 0, 0, 0, 0]);
    expect(lookWeights(LOOK_STOPS.golden)[2]).toBeCloseTo(1, 9);
    expect(lookWeights(LOOK_STOPS.night)[4]).toBeCloseTo(1, 9);
    for (let t = 0; t <= 1; t += 0.013) {
      const w = lookWeights(t);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      expect(w.filter((x) => x > 0).length).toBeLessThanOrEqual(2);
    }
  });
});

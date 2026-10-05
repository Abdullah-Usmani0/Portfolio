import { describe, expect, it } from 'vitest';
import { diveStage, fitZoom } from './diveFraming.ts';

describe('diveStage', () => {
  it('moves the target left of the card on a wide screen', () => {
    const stage = diveStage(1440, 1600, 1000);
    expect(stage.aimX).toBeLessThan(0);
    expect(stage.freeW).toBeLessThan(1600);
  });

  it('leaves room above the target for a diagram on a wide screen', () => {
    const low = diveStage(1440, 1600, 1000, true);
    expect(low.aimY).toBeLessThan(0);
    expect(low.freeH).toBeLessThan(diveStage(1440, 1600, 1000).freeH);
  });

  it('moves the target above the sheet on a phone', () => {
    const stage = diveStage(390, 745, 1612);
    expect(stage.aimX).toBe(0);
    expect(stage.aimY).toBeGreaterThan(0);
    expect(stage.freeH).toBeLessThan(1612 * 0.5);
  });
});

describe('fitZoom', () => {
  const stage = diveStage(1440, 1600, 1000);

  it('zooms less for bigger anchors', () => {
    expect(fitZoom(120, 120, stage)).toBeGreaterThan(fitZoom(600, 250, stage));
  });

  it('never zooms out and stops at the ceiling', () => {
    expect(fitZoom(5000, 5000, stage)).toBe(1);
    expect(fitZoom(4, 4, stage)).toBe(5);
  });

  it('makes the anchor fill the free view by the given share', () => {
    const z = fitZoom(400, 100, stage, 0.8, 99);
    expect(Math.max((400 * z) / stage.freeW, (100 * z) / stage.freeH)).toBeCloseTo(0.8, 10);
  });
});

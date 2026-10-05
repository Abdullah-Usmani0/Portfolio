import { describe, expect, it } from 'vitest';
import { dollyOrigin, dollyPoint, dollyScale, dollyShift } from './dolly.ts';

const P_TARGET = 0.55;

describe('dollyScale', () => {
  it('changes nothing before the dive starts', () => {
    for (const p of [0, 0.012, 0.3, P_TARGET, 1]) expect(dollyScale(p, P_TARGET, 1)).toBe(1);
  });

  it('grows the target layer by exactly the zoom', () => {
    for (const zoom of [1.5, 2.4, 4]) expect(dollyScale(P_TARGET, P_TARGET, zoom)).toBeCloseTo(zoom, 10);
  });

  it('grows nearer layers more and farther ones less, and leaves the sky alone', () => {
    const zoom = 3;
    const far = dollyScale(0.07, P_TARGET, zoom)!;
    const near = dollyScale(0.62, P_TARGET, zoom)!;
    expect(dollyScale(0, P_TARGET, zoom)).toBe(1);
    expect(far).toBeGreaterThan(1);
    expect(far).toBeLessThan(zoom);
    expect(near).toBeGreaterThan(zoom);
  });

  it('hides a layer once the camera has moved past it', () => {
    expect(dollyScale(1, P_TARGET, 4)).toBeNull();
    expect(dollyScale(1, P_TARGET, 1.3)).not.toBeNull();
  });
});

describe('the camera move', () => {
  const focus = 300;
  const aim = -80;
  const zoom = 3.2;
  const at = (t: number) => {
    const z = zoom ** t;
    return { z, shift: dollyShift(focus, aim, t, z) };
  };

  it('leaves everything where it was at t = 0', () => {
    const { z, shift } = at(0);
    expect(shift).toBe(0);
    expect(dollyPoint(75, 0.3, P_TARGET, shift, dollyScale(0.3, P_TARGET, z)!)).toBe(75);
    expect(dollyOrigin(120, 40, 1, P_TARGET, shift, 1)).toBe(120);
  });

  it('moves the target in a straight line from where it was to the aim', () => {
    for (const t of [0.25, 0.5, 1]) {
      const { z, shift } = at(t);
      expect(dollyPoint(focus, P_TARGET, P_TARGET, shift, z)).toBeCloseTo(focus * (1 - t) + aim * t, 10);
    }
  });

  it('slides near layers further than far ones, and the sky not at all, even without zooming', () => {
    const shift = dollyShift(focus, aim, 1, 1);
    const moved = (p: number) => Math.abs(dollyPoint(0, p, P_TARGET, shift, 1));
    expect(moved(0)).toBe(0);
    expect(moved(0.07)).toBeLessThan(moved(P_TARGET));
    expect(moved(1)).toBeGreaterThan(moved(P_TARGET));
  });

  it('agrees with itself: a moved layer draws its points where dollyPoint says', () => {
    const { z, shift } = at(0.6);
    const p = 0.28;
    const s = dollyScale(p, P_TARGET, z)!;
    const g = 900;
    const cam = 1400;
    const local = 610;
    const after = local * s + dollyOrigin(g, cam, p, P_TARGET, shift, s) - cam;
    expect(after).toBeCloseTo(dollyPoint(local + g - cam, p, P_TARGET, shift, s), 10);
  });
});

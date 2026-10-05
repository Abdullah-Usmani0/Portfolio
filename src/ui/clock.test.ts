import { describe, expect, it } from 'vitest';
import { clockFor } from './clock.ts';

describe('clockFor', () => {
  it('reads each look as its hour', () => {
    expect(clockFor(0)).toBe('05:40');
    expect(clockFor(0.3)).toBe('12:00');
    expect(clockFor(0.55)).toBe('17:30');
    expect(clockFor(0.78)).toBe('19:10');
    expect(clockFor(1)).toBe('22:30');
  });

  it('only moves forward through the day', () => {
    let last = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const [h, m] = clockFor(t).split(':').map(Number);
      const minutes = h! * 60 + m!;
      expect(minutes).toBeGreaterThanOrEqual(last);
      last = minutes;
    }
  });

  it('clamps outside the dial', () => {
    expect(clockFor(-2)).toBe('05:40');
    expect(clockFor(7)).toBe('22:30');
  });
});

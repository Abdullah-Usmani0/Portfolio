import { describe, expect, it } from 'vitest';
import { contrast, DARK_LUMINANCE, INK, lightAt, LOOKS, luminance, mixHex, type Look } from './pageLight.ts';

const order: Look[] = [
  LOOKS.dawn,
  LOOKS.morning,
  LOOKS.day,
  LOOKS.afternoon,
  LOOKS.golden,
  LOOKS.dusk,
  LOOKS.night,
  LOOKS.lateNight,
  LOOKS.lateNight,
  LOOKS.sunrise,
];

describe('mixHex', () => {
  it('returns the ends exactly', () => {
    expect(mixHex('#102030', '#f0e0d0', 0)).toBe('#102030');
    expect(mixHex('#102030', '#f0e0d0', 1)).toBe('#f0e0d0');
  });

  it('round-trips a colour through OKLab', () => {
    expect(mixHex('#9a627e', '#9a627e', 0.5)).toBe('#9a627e');
  });
});

describe('every look reads', () => {
  for (const [name, look] of Object.entries(LOOKS)) {
    it(`${name}: body text ≥ 7:1 and secondary text ≥ 4.5:1`, () => {
      const ink = luminance(look.bg) < DARK_LUMINANCE ? INK.dark : INK.light;
      expect(contrast(ink.ink, look.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(ink.muted, look.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('lightAt', () => {
  it('holds each section’s own look while it is centred', () => {
    order.forEach((look, i) => {
      expect(lightAt(order, i).bg).toBe(look.bg);
      expect(lightAt(order, i).look).toBe(look);
    });
  });

  it('holds still near a section, then eases', () => {
    expect(lightAt(order, 0.1).bg).toBe(LOOKS.dawn.bg);
    expect(lightAt(order, 0.5).bg).not.toBe(LOOKS.dawn.bg);
    expect(lightAt(order, 0.9).bg).toBe(LOOKS.morning.bg);
  });

  it('never jumps: neighbouring scroll positions give near colours', () => {
    let prev = lightAt(order, 0);
    for (let s = 0.005; s <= order.length - 1; s += 0.005) {
      const cur = lightAt(order, s);
      expect(Math.abs(luminance(cur.bg) - luminance(prev.bg))).toBeLessThan(0.08);
      prev = cur;
    }
  });

  it('keeps text readable all the way through the day', () => {
    for (let s = 0; s <= order.length - 1; s += 0.01) {
      const l = lightAt(order, s);
      expect(contrast(l.ink, l.bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it('turns dark at dusk and light again at sunrise', () => {
    expect(lightAt(order, 4).dark).toBe(false);
    expect(lightAt(order, 5).dark).toBe(true);
    expect(lightAt(order, 8).dark).toBe(true);
    expect(lightAt(order, 9).dark).toBe(false);
  });

  it('clamps outside the page', () => {
    expect(lightAt(order, -3).bg).toBe(LOOKS.dawn.bg);
    expect(lightAt(order, 99).bg).toBe(LOOKS.sunrise.bg);
  });
});

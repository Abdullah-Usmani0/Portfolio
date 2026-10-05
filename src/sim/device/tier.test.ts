import { describe, expect, it } from 'vitest';
import { BUDGETS, pickTier, stepDown, type DeviceHints } from './tier.ts';

const desktop: DeviceHints = {
  webgl2: true, reducedMotion: false, saveData: false, coarsePointer: false, cores: 8, memoryGb: 8, viewportWidth: 1440,
};

describe('pickTier', () => {
  it('honours a valid URL override', () => {
    expect(pickTier({ ...desktop, override: 'low' })).toBe('low');
    expect(pickTier({ ...desktop, override: 'bogus' })).toBe('mid');
  });

  it('goes static without WebGL2 or with Save-Data', () => {
    expect(pickTier({ ...desktop, webgl2: false })).toBe('static');
    expect(pickTier({ ...desktop, saveData: true })).toBe('static');
  });

  it('treats software rendering as low', () => {
    expect(pickTier({ ...desktop, renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))' })).toBe('low');
  });

  it('rewards a strong desktop GPU', () => {
    expect(pickTier({ ...desktop, renderer: 'NVIDIA GeForce RTX 4070' })).toBe('high');
    expect(pickTier({ ...desktop, renderer: 'Apple M3 Pro', cores: 12 })).toBe('high');
  });

  it('is careful on phones', () => {
    expect(pickTier({ ...desktop, coarsePointer: true, viewportWidth: 390, cores: 6, memoryGb: 4 })).toBe('low');
    expect(pickTier({ ...desktop, coarsePointer: true, viewportWidth: 430, cores: 8, memoryGb: 8 })).toBe('mid');
  });
});

describe('stepDown', () => {
  it('degrades one step and never into static', () => {
    expect(stepDown('high')).toBe('mid');
    expect(stepDown('mid')).toBe('low');
    expect(stepDown('low')).toBe('low');
    expect(stepDown('static')).toBe('static');
  });

  it('budgets shrink monotonically', () => {
    expect(BUDGETS.high.grass).toBeGreaterThan(BUDGETS.mid.grass);
    expect(BUDGETS.mid.grass).toBeGreaterThan(BUDGETS.low.grass);
    expect(BUDGETS.high.bustPoints).toBeGreaterThan(BUDGETS.low.bustPoints);
  });
});

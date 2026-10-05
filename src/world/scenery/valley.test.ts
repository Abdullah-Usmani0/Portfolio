import { describe, expect, it } from 'vitest';
import { sceneX } from '../journey.ts';
import { LAKE_X, VALLEY_P } from './valley.ts';

describe('the valley follows the journey', () => {
  it('puts the lake under the voice scene, wherever that scene sits', () => {
    expect(Math.abs(LAKE_X - sceneX('voice') * VALLEY_P)).toBeLessThan(400);
  });
});

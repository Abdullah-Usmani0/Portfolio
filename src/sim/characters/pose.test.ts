import { describe, expect, it } from 'vitest';
import { NEUTRAL_PERSONA, blendPose, noise1, pose, walkSpeed, type Action } from './pose.ts';

const ACTIONS: Action[] = ['idle', 'walk', 'wave', 'talk', 'work', 'stumble', 'celebrate'];

describe('pose', () => {
  it('is deterministic', () => {
    for (const a of ACTIONS) expect(pose(a, 1.234, NEUTRAL_PERSONA, 3)).toEqual(pose(a, 1.234, NEUTRAL_PERSONA, 3));
  });

  it('keeps every joint inside anatomical limits', () => {
    for (const a of ACTIONS) {
      for (let t = 0; t < 20; t += 0.037) {
        const p = pose(a, t, { energy: 1, confidence: 0, stress: 1 }, 7);
        for (const v of [p.armL, p.armR, p.legL, p.legR, p.lean, p.sway, p.headYaw, p.headPitch, p.headRoll]) {
          expect(Math.abs(v)).toBeLessThan(1.6);
        }
        expect(p.armLRaise).toBeLessThan(3.0);
        expect(p.armRRaise).toBeLessThan(3.0);
        expect(p.squash).toBeGreaterThan(0.85);
        expect(p.squash).toBeLessThan(1.15);
        expect(p.lift).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('walks with opposing limbs', () => {
    const p = pose('walk', 0.3, NEUTRAL_PERSONA);
    expect(Math.sign(p.legL)).toBe(-Math.sign(p.legR));
    expect(Math.sign(p.armL)).toBe(-Math.sign(p.legL));
  });

  it('raises the right arm to wave', () => {
    expect(pose('wave', 0.5).armRRaise).toBeGreaterThan(2);
    expect(pose('idle', 0.5).armRRaise).toBeLessThan(0.5);
  });

  it('lets persona shape the motion', () => {
    const calm = { energy: 0, confidence: 1, stress: 0 };
    const nervous = { energy: 1, confidence: 0, stress: 1 };
    expect(walkSpeed(nervous)).toBeGreaterThan(walkSpeed(calm));
    // confident villagers stand upright (lean ≤ nervous lean)
    expect(pose('idle', 2, calm).lean).toBeLessThan(pose('idle', 2, nervous).lean);
    let maxLiftCalm = 0;
    let maxLiftBouncy = 0;
    for (let t = 0; t < 4; t += 0.01) {
      maxLiftCalm = Math.max(maxLiftCalm, pose('walk', t, calm).lift);
      maxLiftBouncy = Math.max(maxLiftBouncy, pose('walk', t, nervous).lift);
    }
    expect(maxLiftBouncy).toBeGreaterThan(maxLiftCalm);
  });

  it('noise stays in range', () => {
    for (let x = -50; x < 50; x += 0.13) {
      const n = noise1(x, 4);
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});

describe('blendPose', () => {
  it('returns each end exactly and interpolates between them', () => {
    const a = pose('idle', 2, NEUTRAL_PERSONA, 1);
    const b = pose('wave', 2, NEUTRAL_PERSONA, 1);
    expect(blendPose(a, b, 0)).toEqual(a);
    expect(blendPose(a, b, 1)).toEqual(b);
    const mid = blendPose(a, b, 0.5);
    expect(mid.armRRaise).toBeCloseTo((a.armRRaise + b.armRRaise) / 2, 9);
  });

  it('clamps the weight so an overshooting spring never extrapolates a joint', () => {
    const a = pose('idle', 0, NEUTRAL_PERSONA);
    const b = pose('celebrate', 0.2, NEUTRAL_PERSONA);
    expect(blendPose(a, b, 1.4)).toEqual(b);
    expect(blendPose(a, b, -3)).toEqual(a);
  });
});


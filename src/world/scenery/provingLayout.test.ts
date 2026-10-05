import { describe, expect, it } from 'vitest';
import { ASKER, blameShown, bridgeAt, cohortPose, graderStamp, HANDIN, LOOPS, managerBubble, PERSONAS, provingLayout, type ProvingStep } from './provingLayout.ts';

const L = provingLayout();
const n = PERSONAS.length;

describe('the proving grounds', () => {
  it('lays the trail out in the order a learner meets a scenario', () => {
    const last = L.lineup.at(-1)!;
    expect(last).toBeLessThan(L.manager.x);
    expect(L.manager.x).toBeLessThan(L.grader.x);
    expect(L.grader.x).toBeLessThan(L.owl.x);
    expect(L.owl.x).toBeLessThan(L.left);
    expect(L.gap).toBeGreaterThan(L.left);
    expect(L.gap).toBeLessThan(L.bx);
  });

  it('without a dive: the first learner stops at the gap, then all cross once it is mended', () => {
    const arrive = (L.gap - L.start) / L.speed;
    const before = cohortPose(L, 'loop', arrive + 1, 0);
    expect(before.x).toBeCloseTo(L.gap, 6);
    expect(bridgeAt(L, 'loop', arrive + 1).planks).toBe('missing');
    expect(bridgeAt(L, 'loop', arrive + 1).signal).toBe('flag');
    const later = cohortPose(L, 'loop', 20, 0);
    expect(later.x).toBeGreaterThan(L.right);
    expect(bridgeAt(L, 'loop', 20).planks).toBe('fixed');
  });

  it('on the re-run nobody stops: every learner only moves forward', () => {
    for (let i = 0; i < n; i++) {
      let prev = -Infinity;
      for (let t = 0; t < LOOPS.rerun; t += 0.1) {
        const p = cohortPose(L, 'rerun', t, i);
        expect(p.x).toBeGreaterThan(prev);
        prev = p.x;
      }
    }
    expect(bridgeAt(L, 'rerun', 5).planks).toBe('fixed');
    // The whole cohort is over the bridge, and the owl has ticked it, before the loop restarts.
    const last = cohortPose(L, 'rerun', LOOPS.rerun - 3.1, n - 1);
    expect(last.x).toBeGreaterThan(L.right);
    expect(bridgeAt(L, 'rerun', LOOPS.rerun - 2).signal).toBe('ok');
    // On the way, the stage reads one way now and the work passes.
    const atGrader = (L.grader.x - 20 - L.start) / L.rerunSpeed;
    expect(cohortPose(L, 'rerun', atGrader, 0).bubble).toBe('pass');
  });

  it('on the cold read, one learner finds the stage reads two ways; the rest understand it', () => {
    for (let i = 0; i < n; i++) expect(cohortPose(L, 'cold', 6, i).bubble).toBe(i === ASKER ? 'twoway' : 'clear');
  });

  it('sends only that learner to ask the manager, and brings them back', () => {
    for (let i = 0; i < n; i++) {
      if (i === ASKER) continue;
      for (let t = 0; t < LOOPS.ask; t += 0.5) expect(cohortPose(L, 'ask', t, i).x).toBe(L.lineup[i]);
    }
    expect(cohortPose(L, 'ask', 4, ASKER).x).toBeCloseTo(L.manager.x - 30, 6);
    expect(cohortPose(L, 'ask', 4, ASKER).bubble).toBe('ask');
    expect(managerBubble('ask', 7)).toBe('reply');
    expect(cohortPose(L, 'ask', LOOPS.ask - 0.05, ASKER).x).toBeCloseTo(L.lineup[ASKER]!, 0);
  });

  it('takes every learner to the grader once, each stamped with its own verdict', () => {
    const seen = new Set<number>();
    for (let t = 0; t < LOOPS.handin; t += 0.05) {
      for (let i = 0; i < n; i++) if (Math.abs(cohortPose(L, 'handin', t, i).x - (L.grader.x - 26)) < 0.5) seen.add(i);
    }
    expect(seen.size).toBe(n);
    // The stamp shows each verdict in turn, in the learners' order.
    const stamps: string[] = [];
    let showing = false;
    for (let t = 0; t < LOOPS.handin; t += 0.05) {
      const s = graderStamp('handin', t);
      if (s && !showing) stamps.push(s);
      showing = s !== null;
    }
    expect(stamps).toEqual([...HANDIN.outcomes]);
    expect(HANDIN.first + (n - 1) * HANDIN.every + 2 * HANDIN.walk + HANDIN.wait).toBeLessThan(LOOPS.handin);
  });

  it('previews the fix as a ghost before it is applied, and the owl flags until then', () => {
    expect(bridgeAt(L, 'fix', 1).planks).toBe('ghost');
    expect(bridgeAt(L, 'fix', 1).signal).toBe('flag');
    expect(bridgeAt(L, 'fix', 5).planks).toBe('fixed');
    expect(bridgeAt(L, 'fix', 5).signal).toBe('ok');
    expect(bridgeAt(L, 'stumble', 3).planks).toBe('missing');
    expect(blameShown('stumble', 0)).toBe(0);
    expect(blameShown('stumble', 6)).toBe(3);
  });

  it('keeps every pose on the trail and inside its loop', () => {
    const steps: ProvingStep[] = ['loop', 'personas', 'cold', 'ask', 'handin', 'stumble', 'fix', 'rerun'];
    for (const step of steps) {
      for (let t = 0; t < LOOPS[step]; t += 0.25) {
        for (let i = 0; i < n; i++) {
          const p = cohortPose(L, step, t, i);
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
          expect(p.y).toBeGreaterThanOrEqual(L.trail(p.x) - 1e-6);
          expect(p.crouch).toBeGreaterThan(0.5);
        }
      }
    }
  });
});

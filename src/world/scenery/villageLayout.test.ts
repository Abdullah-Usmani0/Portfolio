import { describe, expect, it } from 'vitest';
import { bellRinging, flashAt, LOOPS, managerAt, managerOnRound, ROUND, roundLength, STYLES, SURFACES, talkerSays, villageLayout } from './villageLayout.ts';

const L = villageLayout();

describe('the village', () => {
  it('stands its houses left to right, without overlapping, around an open square', () => {
    for (let k = 1; k < L.houses.length; k++) expect(L.houses[k]!.x0).toBeGreaterThan(L.houses[k - 1]!.x0 + L.houses[k - 1]!.w);
    for (const h of L.houses) expect(h.x0 + h.w <= L.square.x0 || h.x0 >= L.square.x1).toBe(true);
    expect(L.talkers).toHaveLength(STYLES.length);
    for (const x of L.talkers) {
      expect(x).toBeGreaterThan(L.square.x0);
      expect(x).toBeLessThan(L.square.x1);
    }
  });

  it('gives every surface a house, in the order a learner meets them', () => {
    expect(L.doors).toHaveLength(SURFACES.length);
    for (let k = 1; k < L.doors.length; k++) expect(L.doors[k]).toBeGreaterThan(L.doors[k - 1]!);
  });

  it('walks the manager to every door and back, without a jump', () => {
    const seen: string[] = [];
    let prev = managerOnRound(L, 0);
    for (let t = 0; t < roundLength(L); t += 0.05) {
      const p = managerOnRound(L, t);
      if (p.at && p.at !== seen.at(-1)) seen.push(p.at);
      expect(Math.abs(p.x - prev.x)).toBeLessThan(ROUND.speed * 0.05 + 1e-6);
      expect(p.x).toBeGreaterThanOrEqual(L.doors[0]! - 1e-6);
      expect(p.x).toBeLessThanOrEqual(L.doors.at(-1)! + 1e-6);
      prev = p;
    }
    expect(seen).toEqual(['chat', 'plan', 'review', 'kickoff', 'post', 'kickoff', 'review', 'plan']);
    // The round closes on itself.
    expect(managerOnRound(L, roundLength(L) - 1e-6).x).toBeCloseTo(managerOnRound(L, 0).x, 3);
  });

  it('sends the manager to the house each step is about', () => {
    expect(managerAt(L, 'disposition', 2).at).toBe('chat');
    expect(managerAt(L, 'onemanager', 2).at).toBe('kickoff');
    expect(managerAt(L, 'checkins', 2).at).toBe('post');
    expect(managerAt(L, 'faces', 2).x).toBeLessThan(L.house('studio').door);
  });

  it('lets the four voices speak one after another, and all four before the loop restarts', () => {
    expect(STYLES.map((_, i) => talkerSays('styles', 0.5, i))).toEqual([false, false, false, false]);
    expect(STYLES.map((_, i) => talkerSays('styles', 1, i))).toEqual([true, false, false, false]);
    expect(STYLES.map((_, i) => talkerSays('styles', LOOPS.styles - 1, i))).toEqual([true, true, true, true]);
    expect(talkerSays('everywhere', 5, 0)).toBe(false);
  });

  it('rings the check-in bell once a loop, and flashes the studio only in its step', () => {
    let rings = 0;
    let was = false;
    for (let t = 0; t < LOOPS.checkins; t += 0.05) {
      const now = bellRinging('checkins', t);
      if (now && !was) rings++;
      was = now;
    }
    expect(rings).toBe(1);
    expect(flashAt('faces', 1.2)).toBeCloseTo(1, 6);
    expect(flashAt('styles', 1.2)).toBe(0);
  });
});

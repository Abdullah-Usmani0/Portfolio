import { describe, expect, it } from 'vitest';
import { createQuality } from './quality.ts';

/** Feeds `seconds` of frames `dt` apart from `from`, returning every change and where it ended. */
function run(q: ReturnType<typeof createQuality>, dt: number, seconds: number, from = 0) {
  const changes: number[] = [];
  let t = from;
  while (t < from + seconds) {
    t += dt;
    const next = q.step(dt, t);
    if (next !== null) changes.push(next);
  }
  return { changes, t };
}

describe('createQuality', () => {
  it('holds full sharpness while frames keep up', () => {
    const q = createQuality(2);
    expect(run(q, 1 / 60, 30).changes).toEqual([]);
    expect(q.dpr).toBe(2);
  });

  it('steps down a quarter at a time on slow frames, never below 1', () => {
    const q = createQuality(2);
    const { changes } = run(q, 1 / 25, 60);
    expect(changes).toEqual([1.75, 1.5, 1.25, 1]);
    expect(q.dpr).toBe(1);
  });

  it('waits out the start: slow frames while loading change nothing', () => {
    const q = createQuality(2);
    expect(run(q, 1 / 25, 2.5).changes).toEqual([]);
  });

  it('ignores stalls: one long frame is a load, not the pace', () => {
    const q = createQuality(2);
    let t = 0;
    for (let k = 0; k < 600; k++) {
      t += k % 60 === 0 ? 0.3 : 1 / 60;
      expect(q.step(k % 60 === 0 ? 0.3 : 1 / 60, t)).toBeNull();
    }
  });

  it('climbs back once frames are quick again, up to where it started', () => {
    const q = createQuality(1.5);
    const slow = run(q, 1 / 25, 20);
    expect(q.dpr).toBe(1);
    const fast = run(q, 1 / 60, 60, slow.t);
    expect(fast.changes).toEqual([1.25, 1.5]);
    expect(q.dpr).toBe(1.5);
  });
});

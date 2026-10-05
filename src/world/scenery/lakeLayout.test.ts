import { describe, expect, it } from 'vitest';
import { boatAt, FRAMES, framesAt, lakeLayout, lampAt, LOOPS, packetsAt, PIPELINE, RACE, SENTENCES, spokenBy, VERDICT } from './lakeLayout.ts';

const L = lakeLayout();

describe('the lake stage', () => {
  it('hangs one lamp per pipeline stage, left to right over the stage', () => {
    expect(L.lamps).toHaveLength(PIPELINE.length);
    for (let k = 1; k < L.lamps.length; k++) expect(L.lamps[k]!.x).toBeGreaterThan(L.lamps[k - 1]!.x);
    expect(L.lamps[2]!.x).toBeCloseTo(L.ax, 6);
    expect(L.trussY).toBeGreaterThan(L.screenY);
  });

  it('races the streamed call home at 2.1 s and the two calls at 5.4 s', () => {
    expect(boatAt(true, RACE.fast)).toBe(1);
    expect(boatAt(true, RACE.fast - 0.2)).toBeLessThan(1);
    expect(boatAt(false, RACE.fast)).toBeLessThan(0.7);
    expect(boatAt(false, RACE.slow)).toBe(1);
    expect(RACE.slow).toBeLessThan(RACE.loop);
  });

  it('never lets the verdict travel towards the speaker, and speaks only after it is recorded', () => {
    const speak = L.lamps[3]!.x;
    for (let t = 0; t < LOOPS.verdict; t += 0.02) {
      for (const p of packetsAt(L, 'verdict', t)) if (p.kind === 'verdict') expect(p.x).toBeLessThanOrEqual(L.lamps[2]!.x + 1e-6);
      for (const p of packetsAt(L, 'verdict', t)) if (p.kind === 'sentence') expect(t).toBeGreaterThan(VERDICT.at + 1);
    }
    expect(spokenBy('verdict', LOOPS.verdict - 0.1)).toBe(VERDICT.sentences.length);
    expect(speak).toBeGreaterThan(L.lamps[2]!.x);
  });

  it('starts speaking while the model is still writing, one lantern per sentence', () => {
    const first = SENTENCES[0] + 1.1;
    expect(spokenBy('sentences', first - 0.01)).toBe(0);
    expect(spokenBy('sentences', first)).toBe(1);
    expect(packetsAt(L, 'sentences', first).some((p) => p.kind === 'token')).toBe(true);
    let prev = 0;
    for (let t = 0; t < LOOPS.sentences; t += 0.1) {
      const n = spokenBy('sentences', t);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    expect(prev).toBe(SENTENCES.length);
    expect(lampAt('sentences', first + 0.05, 4)).toBeGreaterThan(0.5);
  });

  it('sends a changed screen frame to the model and drops a repeat at the gate', () => {
    for (let t = 0; t < LOOPS.screen; t += 0.02) {
      for (const f of framesAt(L, t)) {
        if (f.dup) expect(f.x).toBeLessThanOrEqual(L.gate.x + 1e-6);
        expect(f.alpha).toBeGreaterThanOrEqual(0);
      }
    }
    // Every frame is still polled once a second, and the last is done before the loop restarts.
    expect(FRAMES.first + (FRAMES.count - 1) * FRAMES.every + 1.6).toBeLessThan(LOOPS.screen);
    const fresh = FRAMES.dup.filter((d) => !d).length;
    expect(fresh).toBeGreaterThan(0);
    expect(fresh).toBeLessThan(FRAMES.count);
  });
});

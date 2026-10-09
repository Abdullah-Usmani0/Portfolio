/**
 * How sharp the valley is drawn, from how fast frames come: on a machine that cannot keep up,
 * the canvas drops a quarter of a pixel ratio at a time (down to 1), and climbs back once
 * frames have been quick for a while. Pure, so it is tested without a GPU.
 */

/** Slower than this (seconds a frame, smoothed) and the canvas gets coarser. */
const SLOW = 1 / 45;
/** Quicker than this for UP seconds and it gets sharper again. */
const QUICK = 1 / 58;
const UP = 6;
/** Seconds after a change before the next is considered, and after the start before any is. */
const HOLD = 2;
const WARMUP = 3;
/** Frames longer than this are stalls (a load, a tab switch), not the pace: they are ignored. */
const STALL = 0.045;
const STEP = 0.25;

export interface Quality {
  /** The pixel ratio to draw at now. */
  readonly dpr: number;
  /** Feed one frame; returns the new pixel ratio when it changes, else null. */
  step: (dt: number, time: number) => number | null;
}

export function createQuality(max: number, min = 1): Quality {
  const top = Math.max(min, max);
  let dpr = top;
  let ema = 1 / 60;
  let changedAt = -Infinity;
  let start: number | null = null;
  let quickSince: number | null = null;
  return {
    get dpr() {
      return dpr;
    },
    step(dt, time) {
      start ??= time;
      if (dt <= 0 || dt >= STALL) return null;
      ema += (dt - ema) * 0.05;
      if (time - start < WARMUP || time - changedAt < HOLD) return null;
      if (ema > SLOW && dpr > min) {
        dpr = Math.max(min, dpr - STEP);
        changedAt = time;
        quickSince = null;
        return dpr;
      }
      if (ema < QUICK) {
        quickSince ??= time;
        if (dpr < top && time - quickSince >= UP) {
          dpr = Math.min(top, dpr + STEP);
          changedAt = time;
          quickSince = null;
          return dpr;
        }
      } else quickSince = null;
      return null;
    },
  };
}

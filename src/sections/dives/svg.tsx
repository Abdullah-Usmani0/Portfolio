/** What every dive diagram shares: a clock that ticks with the world, and the panel's frame. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { CREAM } from './colors.ts';

/** Calls `fn` every frame with the seconds since the diagram appeared. */
export function useClock(fn: (t: number) => void) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const start = performance.now();
    const tick = () => ref.current((performance.now() - start) / 1000);
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 between a and b, eased. */
export const ease = (a: number, b: number, t: number) => {
  const u = clamp01((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** The first `n` characters of `s`, n growing from a to b. */
export const typed = (s: string, a: number, b: number, t: number) => s.slice(0, Math.round(s.length * clamp01((t - a) / (b - a))));
/** Everything fades out just before a loop starts again. */
export const fadeOut = (t: number, loop: number) => 1 - ease(loop - 0.6, loop - 0.1, t);

/** The dark glass panel a diagram sits on, with its title. */
export const Frame = ({ w, h, title }: { w: number; h: number; title: string }) => (
  <>
    <rect x="6" y="6" width={w - 12} height={h - 12} rx="22" fill="rgb(10 12 22 / 0.58)" stroke={CREAM} strokeOpacity={0.14} />
    <text x="26" y="38" className="diagram-label">
      {title}
    </text>
  </>
);

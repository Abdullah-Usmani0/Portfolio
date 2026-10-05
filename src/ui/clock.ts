import { LOOK_STOPS } from '../sim/world/timeOfDay.ts';

/** A storybook clock: the dial position as a time of day on the valley's one long day. */
export function clockFor(tod: number): string {
  const stops: [number, number][] = [
    [0, 5 + 40 / 60],
    [LOOK_STOPS.day, 12],
    [LOOK_STOPS.golden, 17.5],
    [LOOK_STOPS.dusk, 19 + 10 / 60],
    [1, 22.5],
  ];
  const t = Math.min(1, Math.max(0, tod));
  let h = 22.5;
  for (let i = 1; i < stops.length; i++) {
    const [a, ha] = stops[i - 1]!;
    const [b, hb] = stops[i]!;
    if (t <= b) {
      h = ha + ((t - a) / (b - a)) * (hb - ha);
      break;
    }
  }
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

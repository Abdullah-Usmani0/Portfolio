/**
 * Where everything on the farm is, and where a crate is at any moment: pure, so the farm,
 * its anchors and the tests all read the same numbers.
 *
 * The farm grows scenarios. Its rows are a focus map's categories; the cart brings cards to
 * the barn, where they are assembled into scenarios and packed into crates; each crate slides
 * down the chute to the dock, where an inspector passes it, sends it back, or sets it aside;
 * passed crates float downstream to the simulated learners.
 */
import { fbm } from '../gl/flat.ts';
import { groundY, onValley, riverBottom, riverTop } from './valley.ts';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const ROWS = 7;

export type Outcome = 'pass' | 'reask' | 'reject';
/** What the inspector decides, crate after crate: mostly passes, sometimes a re-ask, now and then a reject. */
export const OUTCOMES: readonly Outcome[] = ['pass', 'pass', 'reask', 'pass', 'pass', 'reject', 'pass', 'reask'];

/** One crate's journey, in seconds: out of the barn, down the chute, inspected, then on its way. */
export const CRATE = { period: 14, crates: 4, emerge: 0.5, slide: 4.5, deck: 5.3, inspect: 6.3, stamp: 5.8 } as const;
/** The cart's round: to the barn with cards, unload, back, load again. */
export const CART = { period: 22, there: 8, unload: 10, back: 18 } as const;

export function farmLayout() {
  const cx = onValley('scenarios', 130);
  const x0 = cx - 560;
  const x1 = cx + 380;
  const roll = fbm(91, 3);
  const natural = (x: number) => {
    const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
    return groundY(x) + Math.sin(Math.PI * t) ** 0.7 * (132 + 26 * roll(x / 260));
  };
  const silo = { x: cx - 26, w: 46, h: 160 };
  const barn = { x: cx + 32, w: 150, h: 74 };
  // A flat terrace for the barn and silo, eased into the hill either side.
  const ta = silo.x - 26;
  const tb = barn.x + barn.w + 24;
  const plateau = natural(barn.x + 24);
  const hillTop = (x: number) => {
    const h = natural(x);
    const w = smoothstep(ta - 46, ta, x) * (1 - smoothstep(tb, tb + 56, x));
    return h + (plateau - h) * w;
  };
  const baseY = plateau - 3;

  const mill = { x: cx - 360, base: hillTop(cx - 360) - 4, h: 140, half: 22, top: 12, sail: 94 };
  const scarecrow = { x: cx - 214, base: hillTop(cx - 214) - 40 };

  // The dock on the far bank, reaching out over the water.
  const dock = { x0: cx + 394, x1: cx + 524, top: riverTop(cx + 450) - 1 };
  const inspectAt = dock.x0 + 66;

  // The chute: out of the barn's side, down the hillside, along the bank and onto the dock.
  const chute: [number, number][] = [[barn.x + barn.w + 2, baseY + 20]];
  for (let x = barn.x + barn.w + 12; x <= x1; x += 8) chute.push([x, hillTop(x) + 10]);
  for (let x = x1 + 8; x < dock.x0 - 10; x += 8) chute.push([x, groundY(x) + 9]);
  chute.push([dock.x0 + 4, dock.top + 7]);
  const lengths = chute.slice(1).map((p, i) => Math.hypot(p[0] - chute[i]![0], p[1] - chute[i]![1]));
  const chuteLength = lengths.reduce((a, b) => a + b, 0);
  /** A point along the chute, s in [0, 1] from the barn to the dock. */
  const alongChute = (s: number): [number, number] => {
    let d = Math.min(1, Math.max(0, s)) * chuteLength;
    let k = 0;
    while (k < lengths.length - 1 && d > lengths[k]!) d -= lengths[k++]!;
    const a = chute[k]!;
    const b = chute[k + 1]!;
    const u = d / (lengths[k] || 1);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };

  /** Where a farmer works: on a row, pacing along it. */
  const farmers = [
    { x: cx - 470, row: 4, range: 46 },
    { x: cx - 410, row: 1, range: 30 },
    { x: cx - 300, row: 5, range: 52 },
    { x: cx - 140, row: 3, range: 40 },
    { x: cx - 70, row: 6, range: 34 },
    { x: cx + 290, row: 2, range: 30 },
  ];
  /** The middle of a row's band at x. */
  const rowY = (x: number, k: number) => hillTop(x) - (14 + k * 16);

  const cartPath = { a: cx - 230, b: barn.x + 30 };

  return {
    cx,
    x0,
    x1,
    hillTop,
    rowY,
    silo: { ...silo, y: baseY },
    barn: { ...barn, y: baseY },
    mill,
    scarecrow,
    dock,
    inspectAt,
    chute,
    alongChute,
    farmers,
    cartPath,
    /** Where the river carries passed crates, out of the farm towards the learners. */
    downstream: { x: dock.x1 + 260, y: (riverTop(dock.x1 + 260) + riverBottom(dock.x1 + 260)) / 2 },
    riverMid: (x: number) => (riverTop(x) + riverBottom(x)) / 2,
  };
}

export type FarmLayout = ReturnType<typeof farmLayout>;

export interface CrateState {
  x: number;
  y: number;
  visible: boolean;
  /** The stamp it carries once inspected. */
  mark: Outcome | null;
  tilt: number;
  /** 0–1: the stamp coming down, with a flash at the bottom. */
  stamp: number;
}

/** Where crate `k` is at time t, and what has happened to it. */
export function crateAt(L: FarmLayout, t: number, k: number): CrateState {
  const C = CRATE;
  const local = t + (k * C.period) / C.crates;
  const cycle = Math.floor(local / C.period);
  const u = local - cycle * C.period;
  const outcome = OUTCOMES[(cycle * C.crates + k) % OUTCOMES.length]!;
  const deckY = L.dock.top + 5;
  const off = { x: 0, y: 0, visible: false, mark: null, tilt: 0, stamp: 0 };
  if (u < C.emerge) {
    const [x, y] = L.alongChute(0);
    return { ...off, x, y, visible: u > 0.15 };
  }
  if (u < C.slide) {
    // Slow out of the door, quicker down the slope, easing as it reaches the bank.
    const s = (u - C.emerge) / (C.slide - C.emerge);
    const [x, y] = L.alongChute(s * s * (2.2 - 1.2 * s));
    return { ...off, x, y, visible: true, tilt: -0.3 * Math.sin(Math.PI * s) };
  }
  if (u < C.deck) {
    const s = smoothstep(C.slide, C.deck, u);
    const [x0] = L.alongChute(1);
    return { ...off, x: x0 + (L.inspectAt - x0) * s, y: deckY, visible: true };
  }
  const stamp = u < C.inspect ? Math.max(0, 1 - Math.abs(u - C.stamp) / 0.35) : 0;
  const mark = u >= C.stamp ? outcome : null;
  if (u < C.inspect) return { ...off, x: L.inspectAt, y: deckY, visible: true, mark, stamp };
  if (outcome === 'pass') {
    // Off the end of the dock and away on the current.
    const hop = smoothstep(C.inspect, C.inspect + 0.7, u);
    if (u < C.inspect + 0.7) {
      const x = L.inspectAt + (L.dock.x1 + 12 - L.inspectAt) * hop;
      const y = deckY + Math.sin(Math.PI * hop) * 10 + (L.riverMid(x) - deckY) * hop;
      return { ...off, x, y, visible: true, mark, tilt: 0.4 * hop };
    }
    const x = L.dock.x1 + 12 + (u - C.inspect - 0.7) * 24;
    return { ...off, x, y: L.riverMid(x) + Math.sin(t * 2 + k) * 1.4, visible: true, mark, tilt: Math.sin(t * 1.3 + k) * 0.06 };
  }
  if (outcome === 'reask') {
    // Back up the chute with the reason, to be made again.
    const s = smoothstep(C.inspect, C.inspect + 3.4, u);
    if (s < 1) {
      const [x, y] = L.alongChute(1 - s);
      return { ...off, x, y, visible: true, mark };
    }
    return off;
  }
  // Rejected: set aside at the end of the dock, then gone.
  const s = smoothstep(C.inspect, C.inspect + 0.6, u);
  if (u > C.period - 1.5) return off;
  return { ...off, x: L.inspectAt + (L.dock.x0 + 8 - L.inspectAt) * s, y: deckY, visible: true, mark };
}

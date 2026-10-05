/**
 * The climb, as numbers: where the trees give out, how the summit ridge is shaped, and
 * K2's face with the five camps on its ridge. Pure, so the scenery, its anchors and the
 * tests all read the same numbers.
 *
 * The face is drawn in the place it should appear on screen when the camera holds on the
 * ascent scene (a wide screen), then moved into its layer's own units; that keeps the
 * composition legible in code, where it was designed.
 */
import { CLIMB, groundRise, SCENES, sceneX } from '../journey.ts';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Above this height of ground no pines grow: the bank turns to rock, then snow. */
export const TREELINE = 150;

/** 0 in the valley, 1 once the ridge is high enough to hold snow. */
export const snowAt = (x: number) => smoothstep(TREELINE, TREELINE + 320, groundRise(x));
/** 0 in the valley, 1 once the bank has turned to bare rock. */
export const rockAt = (x: number) => smoothstep(TREELINE * 0.4, TREELINE + 120, groundRise(x));

/**
 * Through the points, smoothly and without overshoot (monotone cubic: a point higher or
 * lower than both its neighbours gets a flat tangent), clamped at both ends.
 */
function spline(points: readonly (readonly [number, number])[]) {
  const n = points.length;
  const d = points.slice(1).map((p, i) => (p[1] - points[i]![1]) / (p[0] - points[i]![0]));
  const m = points.map((_, i) => {
    if (i === 0) return d[0]!;
    if (i === n - 1) return d[n - 2]!;
    const a = d[i - 1]!;
    const b = d[i]!;
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  return (x: number) => {
    if (x <= points[0]![0]) return points[0]![1];
    if (x >= points[n - 1]![0]) return points[n - 1]![1];
    let i = 0;
    while (points[i + 1]![0] < x) i++;
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = x1 - x0;
    const t = (x - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1]!;
  };
}

/** The summit's top: where the flag stands, from the summit scene and the camera's height there. */
export const PEAK = { dx: 60, y: 124 } as const;

/**
 * The summit ridge, from the summit scene's x and the camera's height there: a dark shoulder
 * under the words, a col, the summit pinnacle a little right of centre, its cornice, and
 * a long fall into the clouds.
 */
const SUMMIT_POINTS: readonly (readonly [number, number])[] = [
  [-900, -210],
  [-760, -10],
  [-600, 38],
  [-440, 30],
  [-290, -24],
  [-200, -8],
  [-118, 24],
  [-40, 62],
  [18, 96],
  [PEAK.dx, PEAK.y],
  [84, 116],
  [116, 98],
  [146, 70],
  [172, -30],
  [212, -290],
  [262, -560],
  [900, -660],
];
export const summitProfile = spline(SUMMIT_POINTS);
/** The summit ridge's shape points, from the summit scene's x: facets must pass through them. */
export const SUMMIT_KNOTS = SUMMIT_POINTS.map((p) => p[0]);

/** How much the summit ridge replaces the ordinary bank, by distance from the summit scene. */
export const summitBlend = (dx: number) => smoothstep(-1150, -880, dx);

/** World x of the summit scene, and the ridge height under any x near it. */
export const SUMMIT_X = sceneX('summit');
export const summitRidgeY = (x: number) => CLIMB.summit + summitProfile(x - SUMMIT_X);

/* ─── K2's face, seen from camp level ─────────────────────────────────────────────── */

/**
 * The face's layer: nearer than the valley walls, and above the valley it falls as fast as
 * the ground under the camera, so by the summit it has sunk into the clouds below.
 */
export const FACE = { p: 0.45, sink: 0.55 } as const;

const ASCENT = SCENES.find((s) => s.id === 'ascent')!;
/** A point on screen at the ascent hold (wide screen), in the face layer's own units. */
export const faceLocal = (sx: number, sy: number): [number, number] => [sx + ASCENT.x * FACE.p, sy + ASCENT.y * (FACE.p + FACE.sink)];

export interface Camp {
  id: 'base' | 'camp1' | 'camp2' | 'camp3' | 'camp4';
  /** Centre of the ledge the tents stand on, and its half-width (screen units at the hold). */
  x: number;
  y: number;
  half: number;
  tents: number;
}

/** The five camps, base camp on the glacier to Camp IV on the Shoulder. */
export const CAMPS: readonly Camp[] = [
  { id: 'base', x: -70, y: -206, half: 74, tents: 4 },
  { id: 'camp1', x: 92, y: -86, half: 30, tents: 2 },
  { id: 'camp2', x: 214, y: 14, half: 30, tents: 2 },
  { id: 'camp3', x: 330, y: 108, half: 28, tents: 2 },
  { id: 'camp4', x: 452, y: 196, half: 44, tents: 3 },
];
export const FACE_SUMMIT = { x: 566, y: 336 } as const;

/**
 * The arête that falls from the summit towards you, splitting the pyramid into a face lit
 * by the moon (left of it) and one in shadow (right).
 */
export const ARETE: readonly (readonly [number, number])[] = [
  [FACE_SUMMIT.x, FACE_SUMMIT.y],
  [596, 214],
  [628, 70],
  [676, -150],
  [744, -480],
  [800, -900],
];

/** The arête's height where it crosses x (it only falls, left to right). */
export function areteY(x: number): number {
  const pts = ARETE;
  if (x <= pts[0]![0]) return pts[0]![1];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  }
  return pts.at(-1)![1];
}

/**
 * The skyline of the face, left to right, at the ascent hold: the glacier, the spur with a
 * flat ledge at each camp, the Shoulder, the Bottleneck, the summit and the long east ridge.
 * Rock steps between the ledges come from `rough` in the scenery.
 */
export const FACE_RIDGE: readonly (readonly [number, number])[] = [
  // The foot falls away behind the bank, so the face never shows a cut edge as it arrives.
  [-700, -1300],
  [-480, -700],
  [-320, -330],
  [-220, -240],
  [CAMPS[0]!.x - CAMPS[0]!.half, CAMPS[0]!.y],
  [CAMPS[0]!.x + CAMPS[0]!.half, CAMPS[0]!.y],
  [26, -160],
  [CAMPS[1]!.x - CAMPS[1]!.half, CAMPS[1]!.y],
  [CAMPS[1]!.x + CAMPS[1]!.half, CAMPS[1]!.y],
  [160, -40],
  [CAMPS[2]!.x - CAMPS[2]!.half, CAMPS[2]!.y],
  [CAMPS[2]!.x + CAMPS[2]!.half, CAMPS[2]!.y],
  [276, 60],
  [CAMPS[3]!.x - CAMPS[3]!.half, CAMPS[3]!.y],
  [CAMPS[3]!.x + CAMPS[3]!.half, CAMPS[3]!.y],
  [392, 168],
  [CAMPS[4]!.x - CAMPS[4]!.half, CAMPS[4]!.y],
  [CAMPS[4]!.x + CAMPS[4]!.half, CAMPS[4]!.y],
  [528, 262],
  [548, 300],
  [FACE_SUMMIT.x, FACE_SUMMIT.y],
  [602, 322],
  [690, 262],
  [800, 196],
  [930, 104],
  [1080, -10],
  [1280, -170],
  [1560, -360],
];

/** The skyline's height at x (straight between the points), at the ascent hold. */
export function faceRidgeY(x: number): number {
  const pts = FACE_RIDGE;
  if (x <= pts[0]![0]) return pts[0]![1];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  }
  return pts.at(-1)![1];
}

/** True on a camp's ledge, where the ridge must stay flat for its tents. */
export const onLedge = (x: number) => CAMPS.some((c) => Math.abs(x - c.x) < c.half + 6);

/**
 * The route: from base camp up the ridge, a few switchbacks under the crest between each
 * camp, to the summit. Climbers' headlamps walk it.
 */
export const ROUTE: readonly (readonly [number, number])[] = (() => {
  const stops = [...CAMPS.map((c) => c.x), FACE_SUMMIT.x];
  const out: [number, number][] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    // Out of camp along the ledge, then zigzags a little under the crest to the next.
    for (let k = 0; k < 6; k++) {
      const x = a + ((b - a) * k) / 6;
      out.push([x, faceRidgeY(x) - (k === 0 ? 2 : k % 2 ? 18 : 7)]);
    }
  }
  out.push([FACE_SUMMIT.x, FACE_SUMMIT.y - 4]);
  return out;
})();

const ROUTE_LENGTHS = ROUTE.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE[i]![0], p[1] - ROUTE[i]![1]));
const ROUTE_TOTAL = ROUTE_LENGTHS.reduce((a, b) => a + b, 0);

/** A point on the route, s in [0, 1] from base camp to the summit. */
export function alongRoute(s: number): [number, number] {
  let d = Math.min(1, Math.max(0, s)) * ROUTE_TOTAL;
  let k = 0;
  while (k < ROUTE_LENGTHS.length - 1 && d > ROUTE_LENGTHS[k]!) d -= ROUTE_LENGTHS[k++]!;
  const a = ROUTE[k]!;
  const b = ROUTE[k + 1]!;
  const u = d / (ROUTE_LENGTHS[k] || 1);
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/** Climbers on the route: how many, and how long one takes from base camp to the top. */
export const CLIMBERS = { count: 7, period: 96 } as const;

/**
 * Where climber k's headlamp is at time t: spread along the route, moving up slowly, resting
 * at each camp for a while, and starting again from base camp once over the top.
 */
export function climberAt(t: number, k: number): { x: number; y: number; on: number } {
  const local = (t / CLIMBERS.period + k / CLIMBERS.count) % 1;
  // Rest at the camps: progress stalls at each fifth of the way.
  const legs = CAMPS.length;
  const leg = Math.floor(local * legs);
  const inLeg = local * legs - leg;
  const moving = smoothstep(0.18, 1, inLeg);
  const s = (leg + moving) / legs;
  const [x, ry] = alongRoute(s);
  // Never through the rock: a straight step between two turns can cut a corner of the ridge.
  const y = Math.min(ry, faceRidgeY(x) - 3);
  // Lamps fade in leaving base camp and out at the top.
  const on = smoothstep(0, 0.03, local) * (1 - smoothstep(0.97, 1, local));
  return { x, y, on };
}

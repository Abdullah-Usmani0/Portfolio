/**
 * The director: scroll progress in, camera shot and time of day out. Pure math — no
 * three, no DOM — so continuity can be unit-tested and the renderer only damps toward it.
 *
 * A key holds its shot over a plateau (`at ± hold`) so the camera settles before text
 * appears; between plateaus it eases, rising on an arc like a crane. Time of day runs
 * independently and linearly between key centres, so light keeps moving while the
 * camera rests.
 */
export type Vec3 = readonly [number, number, number];

export interface Shot {
  position: Vec3;
  target: Vec3;
  lensMm: number;
  /** Lens shift in units of the larger frame dimension (Blender's convention). */
  shiftX: number;
  shiftY: number;
}

export interface Key {
  /** Progress at the centre of this key, 0..1, strictly increasing across keys. */
  at: number;
  /** Half-width of the plateau where the shot holds still. */
  hold: number;
  shot: Shot;
  /** Time of day at this key's centre, 0 dawn … 1 night. */
  tod: number;
  /** Extra height (m) the camera rises mid-way through the move *into* this key. */
  arc?: number;
}

export interface Resolved extends Shot {
  tod: number;
  /** Index of the nearest key — what the page treats as "the current act". */
  key: number;
  /** 0 while holding on a plateau, up to 1 mid-transition. Text waits for this to fall. */
  moving: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** C2-continuous ease: zero velocity and acceleration at both ends. */
export const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/**
 * Blend where the camera *looks*, not the look-at points themselves: lerping a target 900 m
 * away into one 5 m away would whip the view round at the very end of the move. Direction
 * is normalised-lerped and distance lerped, then re-anchored on the moving camera.
 */
function lookBetween(a: Shot, b: Shot, pos: readonly number[], t: number): [number, number, number] {
  const dir = (s: Shot) => {
    const d = [s.target[0] - s.position[0], s.target[1] - s.position[1], s.target[2] - s.position[2]];
    const len = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
    return { d: d.map((v) => v / len), len };
  };
  const da = dir(a);
  const db = dir(b);
  const v = [0, 1, 2].map((i) => lerp(da.d[i]!, db.d[i]!, t));
  const n = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  const dist = lerp(da.len, db.len, t);
  return [pos[0]! + (v[0]! / n) * dist, pos[1]! + (v[1]! / n) * dist, pos[2]! + (v[2]! / n) * dist];
}

export function validateKeys(keys: readonly Key[]): void {
  if (keys.length === 0) throw new Error('director: no keys');
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (!(b.at > a.at)) throw new Error(`director: key ${i} is not after key ${i - 1}`);
    if (a.at + a.hold > b.at - b.hold) throw new Error(`director: plateaus ${i - 1} and ${i} overlap`);
  }
}

function todAt(keys: readonly Key[], p: number): number {
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (p <= first.at) return first.tod;
  if (p >= last.at) return last.tod;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (p <= b.at) return lerp(a.tod, b.tod, (p - a.at) / (b.at - a.at));
  }
  return last.tod;
}

export function resolveShot(keys: readonly Key[], progress: number): Resolved {
  const p = clamp01(progress);
  const tod = todAt(keys, p);
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  const hold = (k: Key, key: number): Resolved => ({ ...k.shot, tod, key, moving: 0 });

  if (p <= first.at + first.hold) return hold(first, 0);
  if (p >= last.at - last.hold) return hold(last, keys.length - 1);

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    if (Math.abs(p - k.at) <= k.hold) return hold(k, i);
    const next = keys[i + 1];
    if (!next) break;
    const start = k.at + k.hold;
    const end = next.at - next.hold;
    if (p > start && p < end) {
      const raw = (p - start) / (end - start);
      const t = smootherstep(raw);
      const lift = (next.arc ?? 0) * Math.sin(Math.PI * t);
      const pos = lerp3(k.shot.position, next.shot.position, t);
      pos[1] += lift;
      return {
        position: pos,
        target: lookBetween(k.shot, next.shot, pos, t),
        lensMm: lerp(k.shot.lensMm, next.shot.lensMm, t),
        shiftX: lerp(k.shot.shiftX, next.shot.shiftX, t),
        shiftY: lerp(k.shot.shiftY, next.shot.shiftY, t),
        tod,
        key: raw < 0.5 ? i : i + 1,
        moving: Math.sin(Math.PI * raw),
      };
    }
  }
  return hold(last, keys.length - 1);
}

/**
 * Vertical field of view for a lens, matching Blender's AUTO sensor fit: the sensor spans
 * the larger frame dimension, so a portrait phone sees more sky, not a sliver.
 */
export function verticalFovDeg(lensMm: number, aspect: number, sensorMm = 36): number {
  const half = sensorMm / 2;
  const span = aspect >= 1 ? half / aspect : half;
  return (2 * Math.atan(span / lensMm) * 180) / Math.PI;
}

/**
 * Lens shift → a pixel offset for `camera.setViewOffset(w, h, x, y, w, h)`.
 * Blender shifts the frame by a fraction of its larger dimension; +y moves the frame up,
 * which in three's top-left offset convention is a negative y.
 */
export function shiftToViewOffset(shiftX: number, shiftY: number, width: number, height: number): { x: number; y: number } {
  const m = Math.max(width, height);
  return { x: shiftX * m, y: -shiftY * m };
}

/**
 * The dive's camera move: the camera slides and moves forward towards one point of one
 * layer, as a real camera would in front of a painted scene. The target layer grows by
 * `zoom`; nearer layers grow faster and slide further, farther ones barely change, and a
 * layer the camera has moved past is hidden. Pure, so the move can be tested.
 *
 * Parallax stands in for nearness: p = 1 is right in front of the camera, p = 0 the sky.
 */

/** What is left of a layer's distance (as a share of it) when it counts as passed. */
const PASSED = 0.04;

/** How much a layer at `p` grows while the target layer (at `pTarget`) grows by `zoom`; null once passed. */
export function dollyScale(p: number, pTarget: number, zoom: number): number | null {
  if (zoom <= 1 || pTarget <= 0) return 1;
  const left = 1 - ((1 - 1 / zoom) / pTarget) * p;
  return left <= PASSED ? null : 1 / left;
}

/**
 * How far the camera has slid sideways, in the target layer's screen units, so that the
 * target moves in a straight line from `focus` (where it was) to `aim` (where it ends),
 * `t` of the way, while that layer has grown by `zoom`. Positions are from the screen centre.
 */
export function dollyShift(focus: number, aim: number, t: number, zoom: number): number {
  return focus - (focus * (1 - t) + aim * t) / zoom;
}

/** Where a point of a layer at `p` that was at `point` on screen is now. */
export function dollyPoint(point: number, p: number, pTarget: number, shift: number, s: number): number {
  return s * (point - (p / pTarget) * shift);
}

/** The same, for a layer's origin: `g` is where it sits without the dive, `cam` the camera. */
export function dollyOrigin(g: number, cam: number, p: number, pTarget: number, shift: number, s: number): number {
  return cam + dollyPoint(g - cam, p, pTarget, shift, s);
}

/**
 * The diorama tilt: where the eye wants to lean into the painted valley, −1…1 each way. It
 * follows the cursor; with no cursor (a touch screen) it drifts slowly by itself; and while
 * the page scrolls it dips, so the layers part and close. Pure, so it can be tested.
 */
export function leanTarget(cursor: { x: number; y: number; active: boolean }, time: number, speed: number): { x: number; y: number } {
  const dip = Math.max(-0.6, Math.min(0.6, speed * 0.7));
  if (cursor.active) return { x: cursor.x, y: cursor.y + dip };
  return { x: Math.sin(time * 0.11) * 0.45, y: Math.sin(time * 0.083 + 1.3) * 0.3 + dip };
}

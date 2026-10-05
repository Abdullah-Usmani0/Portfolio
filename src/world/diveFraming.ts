/**
 * Where a dive puts its target on screen. The step card covers part of the view (the right
 * on a wide screen, the bottom on a phone), so the target is framed in what is left.
 * Pure, so the framing can be tested.
 */
export interface DiveStage {
  /** Where the target ends up, in world units from the screen centre. */
  aimX: number;
  aimY: number;
  /** The free part of the view, in world units. */
  freeW: number;
  freeH: number;
}

/** Below this width (CSS px) the card is a bottom sheet. */
export const SHEET_BELOW = 760;

/**
 * `low` keeps the target small and near the bottom, leaving the upper part of the free view
 * for a diagram drawn over the sky (wide screens only; on a phone the diagram sits in the sheet).
 */
export function diveStage(screenW: number, viewW: number, viewH: number, low = false): DiveStage {
  if (screenW >= SHEET_BELOW) {
    return low
      ? { aimX: -0.17 * viewW, aimY: -0.25 * viewH, freeW: 0.62 * viewW, freeH: 0.34 * viewH }
      : { aimX: -0.17 * viewW, aimY: 0.05 * viewH, freeW: 0.62 * viewW, freeH: 0.82 * viewH };
  }
  return { aimX: 0, aimY: 0.22 * viewH, freeW: 0.94 * viewW, freeH: 0.46 * viewH };
}

/** How far to zoom so an anchor of size w × h fills `fill` of the free view; never below 1. */
export function fitZoom(w: number, h: number, stage: DiveStage, fill = 0.8, max = 5): number {
  const z = Math.min((stage.freeW * fill) / Math.max(1, w), (stage.freeH * fill) / Math.max(1, h));
  return Math.min(max, Math.max(1, z));
}

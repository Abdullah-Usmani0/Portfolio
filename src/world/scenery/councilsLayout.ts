/**
 * The council town as numbers: where each of the six buildings stands, its shape, and where
 * its windows are. Pure, so the painted town (councils.ts), the Blender model of it
 * (structures.ts) and the tests all read the same numbers, and a rendered building's windows
 * land exactly where the workers behind them are drawn.
 */
import { onValley, riverTop } from './valley.ts';

/** The six councils, in the order they stand along the river. */
export const BUILDINGS = ['research', 'design', 'implementation', 'audit', 'training', 'media'] as const;
export type Council = (typeof BUILDINGS)[number];

/** A window: left, bottom, width, height, and the seed for who works behind it. */
export type Pane = readonly [number, number, number, number, number];

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Windows in `cols` columns and `rows` rows, filling a wall's box with a margin round each. */
export function windowGrid(x0: number, x1: number, y0: number, y1: number, cols: number, rows: number, seed: number): Pane[] {
  const gw = (x1 - x0) / cols;
  const gh = (y1 - y0) / rows;
  const out: Pane[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) out.push([x0 + c * gw + gw * 0.18, y0 + r * gh + gh * 0.16, gw * 0.64, gh * 0.68, seed + c * 7.13 + r * 3.71]);
  }
  return out;
}

export function councilsLayout() {
  const cx = onValley('councils', 330);
  const at = (x: number) => riverTop(x) + 1;

  // Research: an observatory under a verdigris dome.
  const research = (() => {
    const x = cx - 470;
    const y = at(x + 50);
    return { x, y, w: 100, h: 74, dome: { cx: x + 56, cy: y + 80, r: 46 }, windows: windowGrid(x + 8, x + 96, y + 10, y + 66, 3, 2, 1) };
  })();

  // Design: a terraced drafting tower, three storeys stepping in, a spire on top.
  const design = (() => {
    const x = cx - 320;
    const y = at(x + 60);
    const tiers: (Box & { ledge: number })[] = [];
    const windows: Pane[] = [];
    let top = y;
    (
      [
        [0, 120, 70],
        [16, 104, 56],
        [32, 88, 46],
      ] as const
    ).forEach(([inset, right, h], k) => {
      tiers.push({ x0: x + inset, x1: x + right, y0: top, y1: top + h, ledge: 6 });
      windows.push(...windowGrid(x + inset + 6, x + right - 6, top + 8, top + h - 6, Math.max(2, Math.round((right - inset) / 26)), k === 0 ? 2 : 1, 40 + k * 9));
      top += h + 6;
    });
    return { x, y, tiers, spire: { x0: x + 40, x1: x + 80, y: top, apex: top + 26 }, windows };
  })();

  // Implementation: a long workshop under a sawtooth roof.
  const implementation = (() => {
    const x = cx - 160;
    const y = at(x + 80);
    return { x, y, w: 168, h: 66, teeth: 6, tooth: 28, rise: 26, windows: windowGrid(x + 8, x + 160, y + 10, y + 58, 6, 2, 80) };
  })();

  // Audit: a lighthouse, the tallest thing in town, watching everything.
  const audit = (() => {
    const x = cx + 40;
    const y = at(x + 27);
    const h = 200;
    const windows: Pane[] = [0, 1, 2, 3].map((k) => [x + 21, y + 26 + k * 40, 12, 16, 120 + k]);
    return { x, y, h, stripes: 5, halfBottom: 27, halfTop: 18, cx: x + 27, lantern: y + h + 18, windows };
  })();

  // Training: an academy with a pediment.
  const training = (() => {
    const x = cx + 120;
    const y = at(x + 90);
    return { x, y, w: 180, h: 72, windows: windowGrid(x + 10, x + 170, y + 8, y + 64, 6, 2, 160) };
  })();

  // Media: a studio with a radio mast.
  const media = (() => {
    const x = cx + 330;
    const y = at(x + 55);
    return { x, y, w: 110, h: 88, mast: { x: x + 76, y0: y + 96, y1: y + 230 }, windows: windowGrid(x + 8, x + 102, y + 10, y + 80, 4, 3, 200) };
  })();

  return { cx, research, design, implementation, audit, training, media };
}

export type CouncilsLayout = ReturnType<typeof councilsLayout>;

import { SCENES } from '../journey.ts';
import { bankLine } from './bankLine.ts';
import { rockAt, snowAt } from './climbLayout.ts';
import { forestLine, RIDGES } from './ridges.ts';
import { cliffLine, FALLS_X, groundY, riverBottom, riverTop, VALLEY_P, VALLEY_SPAN } from './valley.ts';

const r2 = (v: number) => Math.round(v * 100) / 100;
const list = (a: ArrayLike<number>) => Array.from(a, r2);

/**
 * The painted layers' shapes as plain numbers, for the Blender renders of the foreground
 * (blender/foreground_render.py): `npm run scenery` writes them to blender/out/scenery.json.
 * Every length is in the layer's own world units, which the renders keep.
 */
export function sceneryProfiles() {
  const bank = bankLine();
  const cliff = cliffLine();
  const valleyXs: number[] = [];
  for (let x = VALLEY_SPAN.x0; x <= VALLEY_SPAN.x1; x += VALLEY_SPAN.step) valleyXs.push(x);
  const trees = (t: { x: number; base: number; h: number; w: number }[]) => t.map((p) => [r2(p.x), r2(p.base), r2(p.h), r2(p.w)]);
  return {
    scenes: SCENES.map((s) => ({ id: s.id, x: s.x, y: s.y })),
    bank: {
      p: 1,
      xs: list(bank.xs),
      ys: list(bank.ys),
      ground: list(bank.ground),
      lift: list(bank.lift),
      rock: bank.xs.map((x) => r2(rockAt(x))),
      snow: bank.xs.map((x) => r2(snowAt(x))),
      trees: trees(bank.trees),
      crest: { xs: list(bank.crest.xs), top: list(bank.crest.top), bottom: list(bank.crest.bottom) },
    },
    ridges: RIDGES.map((o) => {
      const line = forestLine(o);
      return { p: o.p, depth: o.depth, treeH: o.treeH, xs: list(line.xs), ys: list(line.ys), ground: list(line.ground), trees: trees(line.trees) };
    }),
    valley: {
      p: VALLEY_P,
      xs: valleyXs,
      ground: valleyXs.map((x) => r2(groundY(x))),
      riverTop: valleyXs.map((x) => r2(riverTop(x))),
      riverBottom: valleyXs.map((x) => r2(riverBottom(x))),
      falls: FALLS_X,
      cliff: { xs: list(cliff.xs), ys: list(cliff.ys), ground: list(cliff.ground), trees: trees(cliff.trees) },
    },
  };
}

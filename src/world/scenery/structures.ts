import { BUILDINGS, councilsLayout, type Council, type Pane } from './councilsLayout.ts';
import { ROWS, farmLayout } from './farmLayout.ts';
import { lakeLayout } from './lakeLayout.ts';
import { BRIDGE_FIX, SCALE, gorgeLayout, provingLayout } from './provingLayout.ts';
import { groundY } from './valley.ts';
import { villageLayout } from './villageLayout.ts';

/**
 * The valley's buildings as plain numbers: blender/structures_render.py models and renders
 * each from these (`npm run scenery` writes them out), and the site lays the renders over
 * the painted buildings they stand for (see renderedStructures.ts). Every length is in the
 * valley's own units, so a render lands exactly where its painted building stands: its
 * windows, doors and chimneys where the scene's own animation expects them.
 */
export interface Structure {
  id: string;
  /** The scene it belongs to. */
  scene: string;
  /** What the Blender script builds. */
  kind: string;
  /** The building's number in its scene's dives (which cutaway opens it), or −1. */
  building: number;
  /** What the builder needs to know, by name. */
  p: Record<string, number | number[]>;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function village(): Structure[] {
  const L = villageLayout();
  return L.houses.map((h, i) => ({
    id: `village-${String(i).padStart(2, '0')}`,
    scene: 'npcs',
    kind: 'house',
    building: -1,
    p: {
      x0: r2(h.x0),
      w: h.w,
      h: h.h,
      roof: h.roof,
      base: r2(h.base),
      door: r2(h.door),
      doorW: h.doorW,
      doorH: h.doorH,
      windows: h.windows.flat().map(r2),
      chimney: h.chimney ? [r2(h.chimney.x), r2(h.chimney.y0), r2(h.chimney.y1)] : [],
      hall: h.kind === 'kickoff' ? 1 : 0,
      studio: h.kind === 'studio' ? 1 : 0,
      seed: i + 1,
    },
  }));
}

function councils(): Structure[] {
  const L = councilsLayout();
  const windows = (list: readonly Pane[]) => list.flatMap(([x, y, w, h]) => [r2(x), r2(y), r2(w), r2(h)]);
  const one = (id: Council, kind: string, p: Structure['p']): Structure => ({ id: `council-${id}`, scene: 'councils', kind, building: BUILDINGS.indexOf(id), p });
  const { research: r, design: d, implementation: m, audit: a, training: t, media: s } = L;
  return [
    one('research', 'observatory', { x: r2(r.x), y: r2(r.y), w: r.w, h: r.h, windows: windows(r.windows) }),
    one('design', 'tower', {
      tiers: d.tiers.flatMap((b) => [r2(b.x0), r2(b.x1), r2(b.y0), r2(b.y1)]),
      ledge: d.tiers[0]!.ledge,
      spire: [r2(d.spire.x0), r2(d.spire.x1), r2(d.spire.y), r2(d.spire.apex)],
      windows: windows(d.windows),
    }),
    one('implementation', 'workshop', { x: r2(m.x), y: r2(m.y), w: m.w, h: m.h, teeth: m.teeth, tooth: m.tooth, rise: m.rise, windows: windows(m.windows) }),
    one('audit', 'lighthouse', {
      x: r2(a.x),
      y: r2(a.y),
      h: a.h,
      stripes: a.stripes,
      halfBottom: a.halfBottom,
      halfTop: a.halfTop,
      cx: r2(a.cx),
      windows: windows(a.windows),
    }),
    one('training', 'academy', { x: r2(t.x), y: r2(t.y), w: t.w, h: t.h, windows: windows(t.windows) }),
    one('media', 'studio', { x: r2(s.x), y: r2(s.y), w: s.w, h: s.h, mast: [r2(s.mast.x), r2(s.mast.y0), r2(s.mast.y1)], windows: windows(s.windows) }),
  ];
}

/** The crop on each of the farm's rows, top to bottom (the most impactful category on top). */
export const FARM_CROPS = ['wheat', 'cabbage', 'barley', 'maize', 'oats', 'potato', 'sunflower'] as const;

function farm(): Structure[] {
  const L = farmLayout();
  const { barn: b, silo: s, mill: m, dock: d } = L;
  const one = (id: string, kind: string, building: number, p: Structure['p']): Structure => ({ id: `farm-${id}`, scene: 'scenarios', kind, building, p });
  // The hill's outline and the valley floor under it, every two units.
  const xs: number[] = [];
  for (let x = L.x0; x <= L.x1 + 1e-6; x += 2) xs.push(r2(x));
  return [
    one('fields', 'fields', -1, {
      xs,
      top: xs.map((x) => r2(L.hillTop(x))),
      ground: xs.map((x) => r2(groundY(x))),
      // Row k's band runs from this far under the hilltop to ten further.
      rows: Array.from({ length: ROWS }, (_, k) => 9 + k * 16),
      crops: FARM_CROPS.map((_, k) => k),
      scarecrow: [r2(L.scarecrow.x), r2(L.scarecrow.base)],
      chute: L.chute.flat().map(r2),
      // The terrace the barn and silo stand on.
      plateau: [r2(s.x - 26), r2(b.x + b.w + 24), r2(b.y + 3)],
    }),
    one('barn', 'barn', 0, { x: r2(b.x), y: r2(b.y), w: b.w, h: b.h }),
    one('silo', 'silo', 1, { x: r2(s.x), y: r2(s.y), w: s.w, h: s.h }),
    one('mill', 'mill', 2, { x: r2(m.x), base: r2(m.base), h: m.h, half: m.half, top: m.top }),
    one('sails', 'sails', 2, { x: r2(m.x), y: r2(m.base + m.h + 6), sail: m.sail }),
    one('dock', 'dock', -1, { x0: r2(d.x0), x1: r2(d.x1), top: r2(d.top) }),
  ];
}

function proving(): Structure[] {
  const L = provingLayout();
  const G = gorgeLayout(L);
  const one = (id: string, kind: string, building: number, p: Structure['p']): Structure => ({ id: `proving-${id}`, scene: 'learners', kind, building, p });
  const along = (from: number, to: number, step: number) => {
    const xs: number[] = [];
    for (let x = from; x <= to + 1e-6; x += step) xs.push(r2(x));
    return xs;
  };
  const wallXs = along(G.wall.from, G.wall.to, 3);
  const [left, right] = G.shoulders;
  const lxs = along(left!.from, left!.to, 2);
  const rxs = along(right!.from, right!.to, 2);
  const bridge = { left: r2(L.left), right: r2(L.right), deckY: r2(L.deckY), arch: 7 * SCALE, scale: SCALE };
  const gx = L.grader.x;
  const gy = L.trail(gx);
  return [
    one('wall', 'gorge-wall', -1, { xs: wallXs, top: wallXs.map((x) => r2(G.wall.top(x))), bottom: r2(G.bottom), fall: [r2(L.bx - 30), r2(L.bx + 30)] }),
    one('shoulders', 'gorge-shoulders', -1, {
      left: lxs,
      leftTop: lxs.map((x) => r2(left!.top(x))),
      right: rxs,
      rightTop: rxs.map((x) => r2(right!.top(x))),
      bottom: r2(G.bottom),
    }),
    one('bridge', 'bridge', -1, { ...bridge, planks: [0, 1, 2, 5, 6, 7] }),
    one('bridge-fix', 'bridge', BRIDGE_FIX, { ...bridge, planks: [3, 4], fix: 1 }),
    one('owl', 'owl', -1, { x: r2(L.owl.x), y: r2(L.trail(L.owl.x)), scale: SCALE }),
    one('desk', 'desk', -1, { x: r2(gx + 6), y: r2(gy), scale: SCALE }),
    one('lamp', 'lamp', -1, { x: r2(gx - 6), y: r2(gy), scale: SCALE }),
    ...L.flags.map((x, k) => one(`flag${k}`, 'flag', -1, { x: r2(x), y: r2(L.trail(x)), scale: SCALE })),
  ];
}

function lakeStage(): Structure[] {
  const L = lakeLayout();
  const one = (id: string, kind: string, p: Structure['p']): Structure => ({ id: `lake-${id}`, scene: 'voice', kind, building: -1, p });
  const x0 = L.lamps[0]!.x - 42;
  const x1 = L.lamps.at(-1)!.x + 22;
  return [
    one('stage', 'stage', { x: r2(L.ax), y: r2(L.shore(L.ax) - 2), steps: [300, 236, 176], rise: 11, screen: [r2(L.ax), r2(L.screenY), 172, 98] }),
    one('truss', 'truss', {
      x0: r2(x0),
      x1: r2(x1),
      y: r2(L.trussY),
      lamps: L.lamps.flatMap((l) => [r2(l.x), r2(l.y)]),
      drop: [r2(L.lamps.at(-1)!.x), r2(L.screenY + 49)],
    }),
    ...[x0 + 4, x1 - 4].map((x, k) => one(`tower${k}`, 'truss-tower', { x: r2(x), foot: r2(L.shore(x)), y: r2(L.trussY) })),
  ];
}

export function structures(): Structure[] {
  return [...village(), ...councils(), ...farm(), ...proving(), ...lakeStage()];
}

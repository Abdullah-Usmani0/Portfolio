/**
 * What the mind's fireflies do in each step of the context dive, and while no dive is open:
 * which formation they hold and how they get there, which parts glow, freeze or flash red,
 * the sparks that carry things between parts, and when each label shows. Free of three.js;
 * the layer (mind.ts) turns it into geometry and uniforms.
 */
import { FAILURES, LOOPS, loopTime } from '@/content/dives/context.ts';
import { CACHE_LINE, LAYER_COLORS } from '@/sim/particles/bust.ts';
import {
  ALL_ON,
  BLOCKS,
  G,
  GROUP_COLORS,
  GROUP_COUNT,
  MAIN_STACK,
  mainStack,
  agentsFormation,
  agentsLayout,
  bustFormation,
  factNode,
  journalEntry,
  memoryFormation,
  memoryLayout,
  ribbonFormation,
  ribbonLayout,
  scratchFormation,
  scratchLayout,
  selectFormation,
  selectLayout,
  stackFormation,
  stackLayout,
  cacheLineY,
  hash01,
  type Box,
  type Formation,
  type StackBox,
} from '@/sim/particles/formations.ts';

/** How the points are ordered on their way to a new formation. */
export type Order = 'top' | 'left' | 'random' | 'seq';

export interface Cue {
  /** The formation to hold. */
  key: string;
  order: Order;
  /** Seconds for the whole move, stagger included. */
  duration: number;
  /** The share of the duration taken by the stagger (0: all at once). */
  spread: number;
  /** A sideways swirl in flight, in bust units. */
  arc: number;
  /** Jump there without moving (only ever while the points are hidden). */
  instant?: boolean;
}

/** The world's state for this step: is the screen wide, and which blocks the lab has on. */
export interface Stage {
  wide: boolean;
  lab: readonly boolean[];
}

const POUR = { order: 'top', duration: 2.8, spread: 0.72, arc: 0.03 } as const;
const DRIFT = { order: 'random', duration: 2.2, spread: 0.6, arc: 0.07 } as const;

/** Blocks the omit step leaves out: there is no feedback yet and nothing was retrieved. */
export const OMIT = ALL_ON.map((_, k) => k !== 6 && k !== 7);

export const MAX_SPARKS = 192;

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
const BLOCK_RGB = LAYER_COLORS.map(rgb);
const C = {
  lime: rgb('#d4ff5c'),
  amber: rgb('#ffc45c'),
  cyan: rgb('#6ae8ff'),
  violet: rgb('#cfa6ff'),
  red: rgb('#ff5a4e'),
  cream: rgb('#fff6e8'),
  faq: rgb(GROUP_COLORS[G.faq]!),
};

/** What one frame looks like, filled in by a script. */
export class Look {
  /** Per group: shown (0–1), glow, calm (frozen, steady), alarm (red, jittering). */
  readonly groups = new Float32Array(GROUP_COUNT * 4);
  /** A bright band sweeping down the head: its height in bust units and its strength. */
  wave: [number, number] = [-10, 0];
  readonly labels: Record<string, number> = {};
  readonly sparkPos = new Float32Array(MAX_SPARKS * 3);
  readonly sparkColor = new Float32Array(MAX_SPARKS * 4);
  readonly sparkSize = new Float32Array(MAX_SPARKS);
  sparks = 0;

  reset(): void {
    for (let g = 0; g < GROUP_COUNT; g++) this.groups.set([g === G.hidden ? 0 : 1, 1, 0, 0], g * 4);
    this.wave = [-10, 0];
    for (const k of Object.keys(this.labels)) this.labels[k] = 1;
    this.sparks = 0;
  }

  on(g: number, v: number) {
    this.groups[g * 4] = v;
  }
  glow(g: number, v: number) {
    this.groups[g * 4 + 1] = v;
  }
  calm(g: number, v: number) {
    this.groups[g * 4 + 2] = v;
  }
  alarm(g: number, v: number) {
    this.groups[g * 4 + 3] = v;
  }
  label(id: string, v: number) {
    this.labels[id] = v;
  }

  spark(x: number, y: number, c: Rgb, alpha: number, size = 1) {
    if (this.sparks >= MAX_SPARKS || alpha <= 0.002) return;
    const i = this.sparks++;
    this.sparkPos.set([x, y, 0.05], i * 3);
    this.sparkColor.set([c[0], c[1], c[2], Math.min(1, alpha)], i * 4);
    this.sparkSize[i] = size;
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
/** A bump at `at`, `width` seconds wide. */
const pulse = (t: number, at: number, width: number) => Math.exp(-(((t - at) / width) ** 2));
/** 0 → 1 → 0 over [a, b], with soft edges `edge` seconds long. */
const window01 = (t: number, a: number, b: number, edge = 0.25) => clamp01((t - a) / edge) * clamp01((b - t) / edge);

/** A point along a curve from `a` to `b` that lifts by `lift` at its middle. */
function along(a: readonly [number, number], b: readonly [number, number], u: number, lift = 0): [number, number] {
  const t = smooth(u);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * lift];
}

/** A spark that travels from a to b over [start, start + dur], with a short tail, fading in and out at the ends. */
function carry(look: Look, t: number, start: number, dur: number, a: readonly [number, number], b: readonly [number, number], c: Rgb, lift = 0, size = 1.3) {
  const u = (t - start) / dur;
  if (u < 0 || u > 1) return;
  const fade = clamp01(u * 6) * clamp01((1 - u) * 6);
  for (let k = 0; k < 4; k++) {
    const uk = u - k * 0.028;
    if (uk < 0) break;
    const [x, y] = along(a, b, uk, lift);
    look.spark(x, y, c, fade * (1 - k * 0.26), size * (1 - k * 0.17));
  }
}

/* ─── Where things are, per layout ──────────────────────────────────────────────────── */

const centre = (b: Box): [number, number] => [b.cx, b.cy];

/** The labelled places (not the blocks), and the camera's boxes, in bust units. */
export function anchorBoxes(wide: boolean): Record<string, Box> {
  const memory = memoryLayout(wide);
  const ribbon = ribbonLayout(wide, false);
  const scratch = scratchLayout(wide);
  const select = selectLayout(wide);
  const agents = agentsLayout(wide);
  const pt = (cx: number, cy: number): Box => ({ cx, cy, w: 0, h: 0 });
  const turns = ribbon.turns;
  const span = (a: number, b: number): Box => {
    const ts = turns.slice(a, b);
    const x0 = Math.min(...ts.map((t) => t.x0));
    const x1 = Math.max(...ts.map((t) => t.x1));
    const y0 = Math.min(...ts.map((t) => t.y));
    const y1 = Math.max(...ts.map((t) => t.y));
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 + 0.16 };
  };
  const lt = turns[3]!;
  const fenceWin = agents.windows[3]!;
  const camera = wide
    ? {
        bust: { cx: 0, cy: 0.55, w: 2.2, h: 1.4 },
        stack: { cx: 0.42, cy: 0.5, w: 2.5, h: 1.25 },
        scratch: { cx: 0, cy: 0.55, w: 3.5, h: 1.05 },
        ribbon: { cx: 0.12, cy: 0.52, w: 3.65, h: 0.8 },
        memory: { cx: 0, cy: 0.5, w: 3.4, h: 1.3 },
        select: { cx: 0.12, cy: 0.5, w: 3.3, h: 1.15 },
        agents: { cx: 0.12, cy: 0.52, w: 3.0, h: 1.3 },
      }
    : {
        bust: { cx: 0, cy: 0.55, w: 1.5, h: 1.5 },
        stack: { cx: 0.16, cy: 0.62, w: 2.0, h: 1.62 },
        scratch: { cx: 0.08, cy: 0.66, w: 1.8, h: 1.9 },
        ribbon: { cx: 0.04, cy: 0.76, w: 1.8, h: 1.1 },
        memory: { cx: 0, cy: 0.62, w: 1.8, h: 2.0 },
        select: { cx: 0.06, cy: 0.52, w: 1.8, h: 2.0 },
        agents: { cx: 0, cy: 0.52, w: 1.8, h: 1.9 },
      };
  return {
    ...camera,
    moveWrite: wide ? pt(-0.7, 0.2) : pt(-0.42, -0.06),
    moveSelect: wide ? pt(0.7, 1.02) : pt(0.42, 1.12),
    moveCompress: wide ? pt(-0.7, 0.98) : pt(-0.42, 1.12),
    moveIsolate: wide ? pt(0.7, 0.24) : pt(0.42, -0.06),
    pad: scratch.pad,
    reply: { cx: (scratch.mouth[0] + scratch.out[0]) / 2, cy: scratch.mouth[1], w: scratch.out[0] - scratch.mouth[0], h: 0.12 },
    knot: { cx: ribbon.knot.cx, cy: ribbon.knot.cy, w: ribbon.knot.r * 2, h: ribbon.knot.r * 2 },
    turns: wide ? span(0, 10) : span(0, 5),
    long: { cx: lt.x0 + 0.15, cy: lt.y, w: 0.3, h: 0.16 },
    working: memory.working,
    episodic: memory.episodic,
    semantic: memory.semantic,
    procedural: memory.procedural,
    gate: wide ? pt((memory.episodic.cx + memory.semantic.cx) / 2, memory.episodic.cy - memory.episodic.h / 2 - 0.02) : pt(0, (memory.episodic.cy + memory.semantic.cy) / 2),
    faq: select.faq,
    library: select.library,
    lead: { cx: agents.lead.x, cy: agents.lead.base + agents.lead.scale / 2, w: agents.lead.scale, h: agents.lead.scale },
    sub0: agents.windows[0]!,
    sub1: agents.windows[1]!,
    sub2: agents.windows[2]!,
    sub3: agents.windows[3]!,
    fence: fenceBox(fenceWin),
  };
}

/** The fenced corner of the last sub-agent's window, where untrusted text sits. */
function fenceBox(w: Box): Box {
  return { cx: w.cx + w.w * 0.3, cy: w.cy - w.h * 0.12, w: w.w * 0.26, h: w.h * 0.42 };
}

/** The stack a formation shows, if any, so the block labels can ride on it. */
export function stackOf(key: string, wide: boolean): { box: StackBox; mask: readonly boolean[] } | null {
  if (key === 'stack') return { box: mainStack(wide), mask: ALL_ON };
  if (key === 'stack-omit') return { box: mainStack(wide), mask: OMIT };
  if (key.startsWith('stack-lab-')) return { box: mainStack(wide), mask: [...key.slice(10)].map((c) => c === '1') };
  if (key === 'select') return { box: selectLayout(wide).stack, mask: ALL_ON };
  return null;
}

/** Each block's box in a stack: centred on the stack, as tall as its band. */
export function blockBoxes(box: StackBox, mask: readonly boolean[]): Box[] {
  return stackLayout(mask, box).map((b) => ({ cx: box.cx, cy: b.top - b.h / 2, w: box.w, h: b.h }));
}

/** The lab's switches as a formation key; everything on is just the stack. */
export function labKey(mask: readonly boolean[]): string {
  return mask.every(Boolean) ? 'stack' : `stack-lab-${mask.map((on) => (on ? '1' : '0')).join('')}`;
}

/** Builds a formation by key. Pure; the layer caches the result. */
export function buildFormation(key: string, wide: boolean, bust: Float32Array, blocks: Float32Array): Formation {
  const stack = stackOf(key, wide);
  if (stack && key !== 'select') return stackFormation(blocks, stack.mask, stack.box);
  switch (key) {
    case 'bust':
      return bustFormation(bust);
    case 'memory':
      return memoryFormation(blocks, wide);
    case 'select':
      return selectFormation(blocks, wide);
    case 'agents':
      return agentsFormation(bust, wide);
    case 'scratch-blank':
      return scratchFormation(bust, wide, false);
    case 'scratch-written':
      return scratchFormation(bust, wide, true);
    case 'ribbon-empty':
    case 'ribbon-full':
    case 'ribbon-elided':
    case 'ribbon-folded':
      return ribbonFormation(blocks.length, wide, key.slice(7) as 'empty');
    default:
      return stackFormation(blocks);
  }
}

/* ─── The scripts ───────────────────────────────────────────────────────────────────── */

export interface Script {
  /** The formation the points should hold at time t into the step. */
  cue: (t: number, s: Stage) => Cue;
  /** Everything else about the frame. */
  look?: (t: number, s: Stage, look: Look) => void;
}

/** A block's centre and right edge in the stack a formation shows. */
function blockAt(box: StackBox, mask: readonly boolean[], k: number): { x: number; y: number; w: number } {
  const b = stackLayout(mask, box)[k]!;
  return { x: box.cx, y: b.top - b.h / 2, w: box.w };
}

/** Head-and-shoulders, with the four moves sparking around it and a scan rebuilding it. */
const mindScript: Script = {
  cue: () => ({ key: 'bust', ...POUR, duration: 2.4 }),
  look: (t, s, look) => {
    // Rebuilt every turn: a bright band sweeps down the head every few seconds.
    const p = (t % 4.6) / 1.7;
    if (p < 1) look.wave = [1.06 - p * 1.16, 1.25 * Math.sin(p * Math.PI)];
    const A = anchorBoxes(s.wide);
    const head: [number, number] = [0, 0.8];
    const at = (b: Box): [number, number] => [b.cx * 0.86, b.cy];
    // Write: notes leave the head for somewhere outside the window.
    for (let k = 0; k < 2; k++) carry(look, (t + k * 1.3) % 2.6, 0, 1.6, head, at(A.moveWrite!), C.amber, 0.12);
    // Select: what is needed comes back in.
    for (let k = 0; k < 2; k++) carry(look, (t + 0.8 + k * 1.45) % 2.9, 0, 1.6, at(A.moveSelect!), head, C.cyan, 0.1);
    // Compress: a ring of sparks squeezes to one.
    const cp = (t % 3.2) / 2.2;
    if (cp < 1) {
      const [cx, cy] = at(A.moveCompress!);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + t * 0.4;
        const r = 0.16 * (1 - smooth(cp));
        look.spark(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, C.lime, 0.9 * clamp01((1 - cp) * 4), 1 + smooth(cp));
      }
    }
    // Isolate: a piece of work goes off on its own and comes back done.
    const ip = t % 3.8;
    carry(look, ip, 0.2, 1.3, head, at(A.moveIsolate!), C.violet, -0.06);
    carry(look, ip, 2.1, 1.3, at(A.moveIsolate!), head, C.violet, 0.06, 1.8);
  },
};

/** The stack forms, crown first, and a pulse runs down it in reading order. */
const blocksScript: Script = {
  cue: () => ({ key: 'stack', ...POUR }),
  look: (t, _s, look) => {
    for (let k = 0; k < BLOCKS; k++) {
      look.label(`block${k}`, smooth((t - 1.2 - k * 0.14) / 0.4));
      const lp = (t - 3) % 5.5;
      if (t > 3) look.glow(k, 1 + 0.55 * pulse(lp, k * 0.2, 0.16));
    }
  },
};

/** The prefix freezes; the live tail shimmers as new sparks stream into it every turn. */
const cacheScript: Script = {
  cue: () => ({ key: 'stack', ...POUR }),
  look: (t, s, look) => {
    for (let k = 0; k < BLOCKS; k++) {
      if (k < CACHE_LINE) {
        look.calm(k, 1);
        look.glow(k, 1.08);
      } else look.glow(k, 1 + 0.2 * Math.sin(t * 2.6 + k * 1.3));
    }
    const box = mainStack(s.wide);
    for (let j = 0; j < 18; j++) {
      const k = CACHE_LINE + (j % (BLOCKS - CACHE_LINE));
      const b = blockAt(box, ALL_ON, k);
      const u = (t / 2.3 + j / 18) % 1;
      const start: [number, number] = [box.cx + box.w / 2 + 0.75, b.y + (hash01(j, 3) - 0.5) * 0.2];
      const end: [number, number] = [box.cx + (hash01(j, 4) - 0.35) * box.w * 0.8, b.y + (hash01(j, 5) - 0.5) * 0.05];
      const [x, y] = along(start, end, u);
      look.spark(x, y, BLOCK_RGB[k]!, Math.sin(u * Math.PI) ** 0.6, 1.1);
    }
  },
};

/** Two empty blocks flash "none", dissolve, and the rest close up; then it starts again. */
const omitScript: Script = {
  cue: (t) => {
    const L = LOOPS.omit;
    const lt = t % L.period;
    if (lt >= L.dissolve && lt < L.reopen) return { key: 'stack-omit', order: 'random', duration: 1.3, spread: 0.5, arc: 0.05 };
    return { key: 'stack', order: 'random', duration: t < 0.5 ? POUR.duration : 0.8, spread: 0.5, arc: 0.03 };
  },
  look: (t, _s, look) => {
    const L = LOOPS.omit;
    const lt = t % L.period;
    const before = lt < L.dissolve;
    const gone = lt >= L.dissolve && lt < L.reopen;
    for (const k of [6, 7]) {
      look.on(k, gone ? 0 : 1);
      if (before) look.alarm(k, 0.45 + 0.25 * Math.sin(t * 5));
    }
    look.label('none6', before ? smooth((lt - 0.8) / 0.3) : 0);
    look.label('none7', before ? smooth((lt - 0.8) / 0.3) : 0);
    look.label('gone', gone ? smooth((lt - L.dissolve - 0.9) / 0.4) : 0);
  },
};

/** Attention by position: the start and end of the window glow, the middle dims. */
const placementScript: Script = {
  cue: () => ({ key: 'stack', ...POUR }),
  look: (t, _s, look) => {
    for (let k = 0; k < BLOCKS; k++) {
      const u = ((k - (BLOCKS - 1) / 2) / ((BLOCKS - 1) / 2)) ** 2;
      look.glow(k, (0.42 + 0.95 * u) * (1 + 0.06 * Math.sin(t * 2 + k)));
    }
  },
};

/** The verdict is written on a hidden pad, then the reply leaves the head a sentence at a time. */
const scratchScript: Script = {
  cue: (t) => {
    const L = LOOPS.scratch;
    const lt = loopTime(L, t);
    if (lt < 0) return { key: 'scratch-blank', ...DRIFT };
    if (lt >= L.write && lt < L.clear) return { key: 'scratch-written', order: 'seq', duration: L.writeFor, spread: 0.95, arc: 0 };
    return { key: 'scratch-blank', order: 'random', duration: 0.7, spread: 0.4, arc: 0 };
  },
  look: (t, s, look) => {
    const L = LOOPS.scratch;
    const lay = scratchLayout(s.wide);
    look.on(G.frame, 0.5);
    look.glow(G.frame, 0.85);
    const lt = loopTime(L, t);
    look.label('pad', lt >= 0 ? window01(lt, L.write + 0.2, L.clear) : 0);
    look.label('reply', lt >= 0 ? window01(lt, L.speak, L.speak + L.sentence * L.sentences + 0.8) : 0);
    if (lt < 0) return;
    // The verdict is done: it locks, then sits steady while the reply is spoken.
    look.calm(G.pad, lt > L.write + L.writeFor ? 1 : 0);
    look.glow(G.pad, 1 + 0.8 * pulse(lt, L.write + L.writeFor + 0.1, 0.18));
    for (let j = 0; j < L.sentences; j++) {
      const depart = L.speak + j * L.sentence;
      look.glow(G.fire, 1 + 0.25 * pulse(lt, depart, 0.3));
      for (let m = 0; m < 8; m++) {
        const u = (lt - depart - m * 0.055) / L.travel;
        if (u < 0 || u > 1) continue;
        const x = lay.mouth[0] + (lay.out[0] - lay.mouth[0]) * smooth(u) * (s.wide ? 1 : 0.95);
        const y = lay.mouth[1] + Math.sin(u * 6 + j) * 0.02 + ((m % 3) - 1) * 0.012;
        look.spark(x, y, C.lime, clamp01(u * 8) * clamp01((1 - u) * 4), 1.15);
      }
    }
  },
};

/** Turns arrive one by one; an oversized one keeps its head and tail; ten fold into the summary. */
const shortScript: Script = {
  cue: (t) => {
    const L = LOOPS.short;
    const lt = loopTime(L, t);
    if (lt < 0) return { key: 'ribbon-empty', ...DRIFT, duration: L.settle };
    if (lt < L.arrive) return { key: 'ribbon-empty', order: 'random', duration: 0, spread: 0, arc: 0, instant: true };
    if (lt < L.elide) return { key: 'ribbon-full', order: 'seq', duration: L.arriveFor, spread: 0.93, arc: 0.03 };
    if (lt < L.fold) return { key: 'ribbon-elided', order: 'left', duration: 0.9, spread: 0.2, arc: 0 };
    return { key: 'ribbon-folded', order: 'left', duration: 1.3, spread: 0.5, arc: 0.04 };
  },
  look: (t, s, look) => {
    const L = LOOPS.short;
    const lt = loopTime(L, t);
    look.on(G.elided, 0);
    look.label('long', lt >= 0 ? window01(lt, L.elide + 0.4, L.fold + 0.2) : 0);
    if (lt < 0) return;
    look.on(G.absorbed, 1 - smooth((lt - L.fade) / 1));
    look.glow(G.summary, 1 + 0.9 * pulse(lt, L.fold + 1.1, 0.4));
    // A count of the turns so far, as a small tick under each one as it lands.
    const lay = ribbonLayout(s.wide, lt >= L.elide);
    if (lt > L.arrive && lt < L.fold) {
      lay.turns.forEach((tn, k) => {
        const landed = (lt - L.arrive) / L.arriveFor > k / 10 + 0.06;
        if (landed) look.spark((tn.x0 + tn.x1) / 2, tn.y - 0.13, C.cream, 0.45, 0.7);
      });
    }
  },
};

/** Four kinds of memory, with sparks for how they feed each other. */
const longScript: Script = {
  cue: () => ({ key: 'memory', ...DRIFT, duration: 2.4 }),
  look: (t, s, look) => {
    const M = memoryLayout(s.wide);
    const A = anchorBoxes(s.wide);
    const gate: [number, number] = centre(A.gate!);
    const working: [number, number] = [M.working.cx, M.working.cy + M.working.h * 0.42];
    // The same lesson in three episodes …
    const pt = t % 5.2;
    [1, 3, 5].forEach((e, k) => {
      const j = journalEntry(M.episodic, e);
      look.spark(j.x0 - M.episodic.w * 0.12, j.y, C.amber, pulse(pt, 0.3 + k * 0.45, 0.25) * 1.2, 1.8);
    });
    // … passes the gate and becomes a fact.
    const from = journalEntry(M.episodic, 3);
    carry(look, pt, 1.7, 0.9, [from.x1, from.y], gate, C.amber, -0.08, 1.6);
    if (pt > 2.6 && pt < 3.2) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        look.spark(gate[0] + Math.cos(a) * 0.07, gate[1] + Math.sin(a) * 0.07, C.cream, window01(pt, 2.6, 3.2, 0.12) * 0.9, 0.9);
      }
    }
    carry(look, pt, 3.1, 0.9, gate, factNode(M.semantic, 3), C.cyan, 0.1, 1.6);
    look.glow(G.semantic, 1 + 0.6 * pulse(pt, 4.1, 0.3));
    // Playbooks and facts are loaded into the turn.
    carry(look, (t + 1.1) % 4.4, 0, 1.4, [M.procedural.cx, M.procedural.cy + M.procedural.h * 0.42], working, C.violet, 0.34, 1.4);
    carry(look, (t + 3.3) % 4.4, 0, 1.2, factNode(M.semantic, 0), working, C.cyan, 0.24, 1.4);
    look.glow(G.episodic, 1 + 0.35 * pulse(pt, 1.2, 0.5));
  },
};

/** A question meets the stage FAQ: a near miss goes to retrieval; a paraphrase swaps the big blocks for one fact. */
const selectScript: Script = {
  cue: () => ({ key: 'select', ...DRIFT }),
  look: (t, s, look) => {
    const L = LOOPS.select;
    const lt = loopTime(L, t);
    if (lt < 0) return;
    const lay = selectLayout(s.wide);
    const retrieval = blockAt(lay.stack, ALL_ON, 7);
    const into: [number, number] = [retrieval.x + retrieval.w * 0.3, retrieval.y];
    const cards = lay.cards.map(centre);
    const enter: [number, number] = s.wide ? [lay.faq.cx - lay.faq.w / 2 - 0.25, lay.faq.cy + 0.25] : [lay.faq.cx - lay.faq.w / 2 - 0.1, lay.faq.cy + 0.3];
    const ask = (start: number, stopAt: number) => {
      carry(look, lt, start, 0.6, enter, cards[0]!, C.cream, 0.05, 1.6);
      const sweep = (lt - start - 0.6) / 0.9;
      if (sweep >= 0 && sweep <= 1) {
        const [x, y] = along(cards[0]!, cards[stopAt]!, sweep, 0.05);
        look.spark(x, y, C.cream, 1, 1.6);
      }
    };
    // A near miss: nothing on the shelf means the same, so retrieval fetches from the library.
    ask(L.miss, 3);
    const missLinger = window01(lt, L.miss + 1.5, L.retrieve + 0.2, 0.15);
    look.spark(cards[3]![0], cards[3]![1], C.cream, missLinger * 0.8, 1.6);
    [2, 9].forEach((b, k) => {
      const book = lay.books[b % lay.books.length]!;
      carry(look, lt, L.retrieve + k * 0.35, 1.1, [book.cx, book.cy + book.h / 2], into, C.cyan, 0.22, 1.4);
    });
    look.glow(G.library, 1 + 0.5 * window01(lt, L.retrieve, L.retrieve + 1.6));
    look.glow(7, 1 + 0.5 * pulse(lt, L.retrieve + 1.4, 0.4) + 0.5 * pulse(lt, L.swap + 1, 0.4));
    // A paraphrase: a hit. One fact replaces the big stage and resource blocks.
    ask(L.hit, 1);
    const hit = window01(lt, L.hit + 1.5, L.restore, 0.2);
    look.glow(G.faq, 1 + 0.7 * hit);
    carry(look, lt, L.swap, 1, cards[1]!, into, C.faq, 0.18, 1.8);
    const swapped = window01(lt, L.swap + 0.3, L.restore, 0.4);
    for (const k of [2, 4]) look.on(k, 1 - 0.78 * swapped);
  },
};

/** The lead hands work to four sub-agents, each in a clean window, and gets back short results. */
const isolateScript: Script = {
  cue: () => ({ key: 'agents', ...DRIFT, duration: 2.4, arc: 0.1 }),
  look: (t, s, look) => {
    const L = LOOPS.isolate;
    const lay = agentsLayout(s.wide);
    look.on(G.window, 0.55);
    look.glow(G.window, 0.9);
    // The fenced corner of the last window: untrusted text, read as data and never obeyed.
    const fence = fenceBox(lay.windows[3]!);
    for (let k = 0; k < 14; k++) {
      const u = k / 14;
      const per = 2 * (fence.w + fence.h);
      let d = u * per;
      let x: number;
      let y: number;
      if (d < fence.w) [x, y] = [fence.cx - fence.w / 2 + d, fence.cy + fence.h / 2];
      else if ((d -= fence.w) < fence.h) [x, y] = [fence.cx + fence.w / 2, fence.cy + fence.h / 2 - d];
      else if ((d -= fence.h) < fence.w) [x, y] = [fence.cx + fence.w / 2 - d, fence.cy - fence.h / 2];
      else [x, y] = [fence.cx - fence.w / 2, fence.cy - fence.h / 2 + (d - fence.w)];
      look.spark(x, y, C.red, 0.55 + 0.3 * Math.sin(t * 3 + k), 0.75);
    }
    look.spark(fence.cx + Math.sin(t * 1.7) * fence.w * 0.28, fence.cy + Math.cos(t * 2.3) * fence.h * 0.3, C.red, 1, 1.6);
    const lt = loopTime(L, t);
    if (lt < 0) return;
    const head: [number, number] = [lay.lead.x + lay.lead.scale * 0.1, lay.lead.base + lay.lead.scale * 0.78];
    lay.windows.forEach((w, k) => {
      const inbox: [number, number] = [w.cx - 0.08, w.cy + w.h * 0.1];
      carry(look, lt, L.send + k * 0.14, 0.9, head, inbox, C.cream, 0.12, 1.2);
      const workStart = L.work + k * L.stagger;
      look.glow(G.sub + k, 1 + 0.9 * window01(lt, workStart, workStart + L.workFor, 0.3) * (0.75 + 0.25 * Math.sin(t * 9 + k)));
      carry(look, lt, workStart + L.workFor, L.travel, [w.cx - w.w * 0.2, w.cy + w.h * 0.3], head, C.lime, 0.16, 2);
      look.glow(G.lead, 1 + 0.45 * pulse(lt, workStart + L.workFor + L.travel, 0.18));
    });
  },
};

/** The four failures, one after another, each caught by its defence. */
const failuresScript: Script = {
  cue: () => ({ key: 'stack', ...POUR }),
  look: (t, s, look) => {
    const L = LOOPS.failures;
    for (let k = 0; k < FAILURES.length; k++) look.label(`fail${k}`, 0);
    const lt = loopTime(L, t);
    if (lt < 0) return;
    const phase = Math.floor(lt / L.phase);
    const lp = lt % L.phase;
    const failing = lp < 1.8;
    const fixed = window01(lp, 1.9, L.phase - 0.15, 0.3);
    look.label(`fail${phase}`, window01(lp, 0.15, 1.8, 0.2));
    if (phase === 0) {
      // Poisoning: one wrong fact in memory; checked against its source, it goes.
      look.alarm(5, failing ? 1 : 0);
      look.glow(5, 1 + 0.6 * fixed);
    } else if (phase === 1) {
      // Distraction: noise floods in and everything dims; compaction squeezes it to a summary.
      for (let k = 0; k < BLOCKS; k++) look.glow(k, failing ? 0.42 : 1);
      for (let j = 0; j < 40; j++) {
        const a = hash01(j, 7) * Math.PI * 2;
        const r = 0.55 + hash01(j, 8) * 0.45;
        const drift = t * (0.2 + hash01(j, 9) * 0.3);
        const box = mainStack(s.wide);
        const loose: [number, number] = [box.cx + Math.cos(a + drift) * r * 1.3 * (box.w / 1.5), 0.5 + Math.sin(a + drift) * r * 0.62];
        const squeezed: [number, number] = [box.cx + box.w / 2 + 0.16, 0.5];
        const u = smooth((lp - 1.8) / 0.7);
        look.spark(loose[0] + (squeezed[0] - loose[0]) * u, loose[1] + (squeezed[1] - loose[1]) * u, C.amber, (0.75 - 0.3 * u) * window01(lp, 0, L.phase - 0.1, 0.25), 0.9);
      }
    } else if (phase === 2) {
      // Confusion: off-topic tools and resources; only what is relevant stays in.
      for (const k of [4, 7]) {
        look.alarm(k, failing ? 0.75 : 0);
        look.on(k, failing ? 1 : 1 - 0.75 * fixed);
      }
    } else {
      // Clash: identity and voice pull different ways; one source of truth settles it.
      const flip = Math.sin(t * 7) > 0;
      look.alarm(0, failing ? (flip ? 1 : 0.2) : 0);
      look.alarm(9, failing ? (flip ? 0.2 : 1) : 0);
      for (const k of [0, 9]) look.glow(k, 1 + 0.5 * fixed);
    }
  },
};

/** The lab: the stack follows the switches. */
const labScript: Script = {
  cue: (_t, s) => ({ key: labKey(s.lab), order: 'random', duration: 1.1, spread: 0.5, arc: 0.05 }),
  look: (_t, s, look) => {
    for (let k = 0; k < BLOCKS; k++) {
      look.on(k, s.lab[k] ? 1 : 0);
      look.label(`block${k}`, s.lab[k] ? 1 : 0.35);
    }
  },
};

/** No dive: the head, poured into the stack and back while the visitor looks on. */
export const attract: Script = {
  cue: (t) => {
    const stack = t > 4 && (t - 4) % 13 < 6.5;
    return { key: stack ? 'stack' : 'bust', ...POUR, duration: 3.2 };
  },
};

/** One script per step of the context dive. */
export const SCRIPTS: Readonly<Record<string, Script>> = {
  mind: mindScript,
  blocks: blocksScript,
  cache: cacheScript,
  omit: omitScript,
  placement: placementScript,
  scratch: scratchScript,
  short: shortScript,
  long: longScript,
  select: selectScript,
  isolate: isolateScript,
  failures: failuresScript,
  lab: labScript,
};

/** Where the cache line is, for its label. */
export function cacheLineBox(box: StackBox = MAIN_STACK): Box {
  const y = cacheLineY(stackLayout(ALL_ON, box)) ?? box.base + box.h / 2;
  return { cx: box.cx, cy: y, w: box.w, h: 0 };
}

/** The prefix and the tail, for their labels. */
export function prefixTailBoxes(box: StackBox = MAIN_STACK): { prefix: Box; tail: Box } {
  const bands = stackLayout(ALL_ON, box);
  const top = bands[0]!.top;
  const prefixBottom = bands[CACHE_LINE - 1]!.top - bands[CACHE_LINE - 1]!.h;
  const tailTop = bands[CACHE_LINE]!.top;
  const bottom = box.base;
  return {
    prefix: { cx: box.cx, cy: (top + prefixBottom) / 2, w: box.w, h: top - prefixBottom },
    tail: { cx: box.cx, cy: (tailTop + bottom) / 2, w: box.w, h: tailTop - bottom },
  };
}

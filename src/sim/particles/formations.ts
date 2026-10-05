/**
 * Formations for the mind's fireflies: where every point goes in each step of the
 * context-engineering dive. Pure and renderer-free, in the bust's units (the head is about
 * 1 tall from its base at y = 0, centred on x = 0), so the layer only has to scale them.
 *
 * Every formation places all n points and gives each one a group. A group is what the
 * shader colours and lights as one (a context block, a kind of memory, one sub-agent), so
 * the director can dim, freeze or alarm one part of a formation without touching the rest.
 * Each formation comes in a wide layout and a narrow one, for a phone held upright.
 */
import { CACHE_LINE, CONTEXT_LAYERS } from './bust.ts';

export const BLOCKS = CONTEXT_LAYERS.length;

/** Groups 0–9 are the context blocks, in order; the rest are named here. */
export const G = {
  hidden: 10,
  fire: 11,
  episodic: 12,
  semantic: 13,
  procedural: 14,
  lead: 15,
  /** Four sub-agents, 16–19. */
  sub: 16,
  window: 20,
  library: 21,
  faq: 22,
  pad: 23,
  frame: 24,
  learner: 25,
  npc: 26,
  summary: 27,
  absorbed: 28,
  elided: 29,
} as const;

export const GROUP_COUNT = 32;

/** Colours for the named groups (the blocks use the stack's own colours). */
export const GROUP_COLORS: Readonly<Record<number, string>> = {
  [G.episodic]: '#ffb547',
  [G.semantic]: '#3de0ff',
  [G.procedural]: '#c08cff',
  [G.lead]: '#c6ff3d',
  [G.sub]: '#9fd8ff',
  [G.sub + 1]: '#9fd8ff',
  [G.sub + 2]: '#9fd8ff',
  [G.sub + 3]: '#9fd8ff',
  [G.window]: '#7180b8',
  [G.library]: '#5fa8ff',
  [G.faq]: '#ffd27a',
  [G.pad]: '#ece8ff',
  [G.frame]: '#7180b8',
  [G.learner]: '#f6f1ea',
  [G.npc]: '#c6ff3d',
  [G.summary]: '#ffd27a',
  [G.absorbed]: '#ffd27a',
  [G.elided]: '#f6f1ea',
};

export interface Formation {
  /** n × 3, in bust units. */
  pos: Float32Array;
  /** n, the group of each point. */
  group: Float32Array;
  /** n, an optional natural order for a staggered arrival (0 arrives first, 1 last). */
  seq?: Float32Array;
}

/** A box by its centre and size, in bust units. */
export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** A deterministic hash of (index, salt) to [0, 1). */
export function hash01(i: number, salt: number): number {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function make(n: number, seq = false): Formation {
  return { pos: new Float32Array(n * 3), group: new Float32Array(n), seq: seq ? new Float32Array(n) : undefined };
}

function put(f: Formation, i: number, x: number, y: number, z: number, group: number) {
  f.pos[i * 3] = x;
  f.pos[i * 3 + 1] = y;
  f.pos[i * 3 + 2] = z;
  f.group[i] = group;
}

/** Which part a point belongs to, given the parts' shares of the points (they need not sum to 1). */
function part(i: number, salt: number, shares: readonly number[]): number {
  const total = shares.reduce((a, b) => a + b, 0);
  let u = hash01(i, salt) * total;
  for (let k = 0; k < shares.length; k++) {
    if (u < shares[k]!) return k;
    u -= shares[k]!;
  }
  return shares.length - 1;
}

/**
 * The block each point carries into the stack: the crown of the head becomes identity and the
 * shoulders become voice, an equal share each, so the head pours in from the top.
 */
export function blocksByHeight(bust: Float32Array): Float32Array {
  const n = bust.length / 3;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => bust[b * 3 + 1]! - bust[a * 3 + 1]!);
  const out = new Float32Array(n);
  order.forEach((idx, rank) => (out[idx] = Math.min(BLOCKS - 1, Math.floor((rank * BLOCKS) / n))));
  return out;
}

export const ALL_ON: readonly boolean[] = Array.from({ length: BLOCKS }, () => true);

/** A stack's place: centre x, the bottom, width and height. */
export interface StackBox {
  cx: number;
  base: number;
  w: number;
  h: number;
}

export interface Band {
  /** The top of the band and its height; an absent block has no height and sits at the seam. */
  top: number;
  h: number;
  on: boolean;
}

/**
 * The stack's bands, top to bottom, for the blocks that are present. Absent blocks take no
 * room (the rest close up); the cache line is a gap between the prefix and the live tail,
 * kept only while both sides have a block in them.
 */
export function stackLayout(mask: readonly boolean[], box: StackBox): Band[] {
  const present = mask.filter(Boolean).length;
  const prefix = mask.slice(0, CACHE_LINE).some(Boolean);
  const tail = mask.slice(CACHE_LINE).some(Boolean);
  const gap = prefix && tail ? box.h * 0.06 : 0;
  const band = present ? (box.h - gap) / present : 0;
  let y = box.base + box.h;
  let gapped = false;
  return mask.map((on, k) => {
    if (on && k >= CACHE_LINE && !gapped) {
      y -= gap;
      gapped = true;
    }
    if (!on) return { top: y, h: 0, on: false };
    const b = { top: y, h: band, on: true };
    y -= band;
    return b;
  });
}

/** Where the cache line sits in a layout (the middle of its gap), or null when there is none. */
export function cacheLineY(bands: readonly Band[]): number | null {
  const above = bands.slice(0, CACHE_LINE).filter((b) => b.on).at(-1);
  const below = bands.slice(CACHE_LINE).find((b) => b.on);
  return above && below ? (above.top - above.h + below.top) / 2 : null;
}

function placeInStack(f: Formation, i: number, k: number, bands: readonly Band[], box: StackBox) {
  const b = bands[k]!;
  const u = hash01(i, 11);
  const v = hash01(i, 12);
  const z = (hash01(i, 13) - 0.5) * 0.03;
  if (b.on) put(f, i, box.cx + (u - 0.5) * box.w, b.top - b.h * (0.12 + 0.76 * v), z, k);
  // An absent block's points drift out from the seam it left; the shader fades them.
  else put(f, i, box.cx + (u - 0.5) * box.w * 1.8, b.top + (v - 0.5) * 0.14, z, k);
}

export const MAIN_STACK: StackBox = { cx: 0, base: -0.02, w: 1.5, h: 1.05 };

/** The main stack: wide on a wide screen; narrower and taller on a phone, to leave room for its labels. */
export function mainStack(wide: boolean): StackBox {
  return wide ? MAIN_STACK : { cx: -0.28, base: -0.1, w: 1.06, h: 1.44 };
}

/** The context window: ten bands, identity on top, voice at the bottom. */
export function stackFormation(blocks: Float32Array, mask: readonly boolean[] = ALL_ON, box: StackBox = MAIN_STACK): Formation {
  const n = blocks.length;
  const f = make(n);
  const bands = stackLayout(mask, box);
  for (let i = 0; i < n; i++) placeInStack(f, i, blocks[i]!, bands, box);
  return f;
}

/** The head itself, every point a firefly. */
export function bustFormation(bust: Float32Array): Formation {
  const n = bust.length / 3;
  const f = make(n);
  f.pos.set(bust);
  f.group.fill(G.fire);
  return f;
}

/** A copy of the head, scaled and moved; each point keeps its own place on the face. */
function placeMiniBust(f: Formation, i: number, bust: Float32Array, x: number, base: number, scale: number, group: number) {
  put(f, i, x + bust[i * 3]! * scale, base + bust[i * 3 + 1]! * scale, bust[i * 3 + 2]! * scale * 0.4, group);
}

/** A point on the outline of a box. */
function onOutline(i: number, salt: number, b: Box): [number, number] {
  const u = hash01(i, salt) * 2 * (b.w + b.h);
  const j = (hash01(i, salt + 1) - 0.5) * 0.006;
  if (u < b.w) return [b.cx - b.w / 2 + u, b.cy + b.h / 2 + j];
  if (u < b.w + b.h) return [b.cx + b.w / 2 + j, b.cy + b.h / 2 - (u - b.w)];
  if (u < 2 * b.w + b.h) return [b.cx + b.w / 2 - (u - b.w - b.h), b.cy - b.h / 2 + j];
  return [b.cx - b.w / 2 + j, b.cy - b.h / 2 + (u - 2 * b.w - b.h)];
}

/** A point on a segment, with a little thickness. */
function onSegment(i: number, salt: number, x0: number, y0: number, x1: number, y1: number, thick = 0.006): [number, number] {
  const t = hash01(i, salt);
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const j = (hash01(i, salt + 1) - 0.5) * thick;
  return [x0 + (x1 - x0) * t - ((y1 - y0) / len) * j, y0 + (y1 - y0) * t + ((x1 - x0) / len) * j];
}

/** A point in a disc. */
function inDisc(i: number, salt: number, cx: number, cy: number, r: number): [number, number] {
  const rr = r * Math.sqrt(hash01(i, salt));
  const a = hash01(i, salt + 1) * Math.PI * 2;
  return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
}

/* ─── Long-term memory: four constellations ─────────────────────────────────────────── */

export const MEMORY_KINDS = ['working', 'episodic', 'semantic', 'procedural'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** Where each kind of memory sits: in a row on a wide screen, two by two on a phone. */
export function memoryLayout(wide: boolean): Record<MemoryKind, Box> {
  return wide
    ? {
        working: { cx: -1.3, cy: 0.5, w: 0.5, h: 0.8 },
        episodic: { cx: -0.45, cy: 0.5, w: 0.5, h: 0.8 },
        semantic: { cx: 0.44, cy: 0.5, w: 0.62, h: 0.8 },
        procedural: { cx: 1.3, cy: 0.5, w: 0.5, h: 0.8 },
      }
    : {
        working: { cx: -0.44, cy: 1.08, w: 0.5, h: 0.72 },
        episodic: { cx: 0.44, cy: 1.08, w: 0.56, h: 0.72 },
        semantic: { cx: -0.44, cy: 0.1, w: 0.62, h: 0.72 },
        procedural: { cx: 0.44, cy: 0.1, w: 0.5, h: 0.72 },
      };
}

/** Journal entries, newest at the top: what happened, one line each (x0, length, y, as shares of the box). */
const JOURNAL = [0.92, 0.66, 0.84, 0.58, 0.88, 0.72, 0.5].map((len, e) => ({ len, y: 0.44 - e * 0.145 }));

/** A small graph of facts: nodes and the edges between them, as shares of the box. */
const FACT_NODES = [
  [-0.36, 0.36],
  [0.06, 0.42],
  [0.38, 0.22],
  [-0.18, 0.02],
  [0.28, -0.12],
  [-0.4, -0.28],
  [0.06, -0.4],
] as const;
const FACT_EDGES = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [2, 4],
  [3, 4],
  [3, 5],
  [4, 6],
  [5, 6],
] as const;

/** A procedure: step, decision, step, step, joined top to bottom (shares of the box). */
const FLOW = [
  { y: 0.4, kind: 'step' },
  { y: 0.12, kind: 'choice' },
  { y: -0.14, kind: 'step' },
  { y: -0.4, kind: 'step' },
] as const;

/** Where a semantic node sits, for sparks and labels. */
export function factNode(b: Box, k: number): [number, number] {
  const [x, y] = FACT_NODES[k % FACT_NODES.length]!;
  return [b.cx + x * b.w, b.cy + y * b.h];
}

/** Where a journal entry starts and ends, for sparks. */
export function journalEntry(b: Box, e: number): { x0: number; x1: number; y: number } {
  const j = JOURNAL[e % JOURNAL.length]!;
  const x0 = b.cx - b.w * 0.32;
  return { x0, x1: x0 + b.w * 0.74 * j.len, y: b.cy + j.y * b.h };
}

export function memoryFormation(blocks: Float32Array, wide: boolean): Formation {
  const n = blocks.length;
  const f = make(n);
  const L = memoryLayout(wide);
  const w = L.working;
  const mini: StackBox = { cx: w.cx, base: w.cy - w.h / 2, w: w.w, h: w.h };
  const bands = stackLayout(ALL_ON, mini);
  for (let i = 0; i < n; i++) {
    const z = (hash01(i, 21) - 0.5) * 0.03;
    switch (part(i, 20, [0.3, 0.22, 0.26, 0.22])) {
      case 0:
        placeInStack(f, i, blocks[i]!, bands, mini);
        break;
      case 1: {
        // Episodic: a journal, one line per thing that happened, with a date dot before each.
        const b = L.episodic;
        const e = Math.floor(hash01(i, 22) * JOURNAL.length);
        const { x0, x1, y } = journalEntry(b, e);
        if (hash01(i, 23) < 0.12) {
          const [x, yy] = inDisc(i, 24, x0 - b.w * 0.12, y, 0.018);
          put(f, i, x, yy, z, G.episodic);
        } else put(f, i, x0 + (x1 - x0) * hash01(i, 25), y + (hash01(i, 26) - 0.5) * 0.032, z, G.episodic);
        break;
      }
      case 2: {
        // Semantic: facts as a small graph, dense nodes joined by fine edges.
        const b = L.semantic;
        if (hash01(i, 27) < 0.46) {
          const k = Math.floor(hash01(i, 28) * FACT_NODES.length);
          const [cx, cy] = factNode(b, k);
          const [x, y] = inDisc(i, 29, cx, cy, 0.03 + (k % 3) * 0.009);
          put(f, i, x, y, z, G.semantic);
        } else {
          const [a, c] = FACT_EDGES[Math.floor(hash01(i, 30) * FACT_EDGES.length)]!;
          const [x0, y0] = factNode(b, a);
          const [x1, y1] = factNode(b, c);
          const [x, y] = onSegment(i, 31, x0, y0, x1, y1);
          put(f, i, x, y, z, G.semantic);
        }
        break;
      }
      default: {
        // Procedural: a little flowchart, how to act.
        const b = L.procedural;
        const s = Math.floor(hash01(i, 32) * (FLOW.length * 2 - 1));
        if (s % 2 === 1) {
          // A connector between two shapes.
          const a = FLOW[(s - 1) / 2]!;
          const c = FLOW[(s + 1) / 2]!;
          const [x, y] = onSegment(i, 33, b.cx, b.cy + (a.y - 0.07) * b.h, b.cx, b.cy + (c.y + 0.07) * b.h);
          put(f, i, x, y, z, G.procedural);
        } else {
          const node = FLOW[s / 2]!;
          const cy = b.cy + node.y * b.h;
          if (node.kind === 'step') {
            const [x, y] = onOutline(i, 34, { cx: b.cx, cy, w: b.w * 0.74, h: b.h * 0.12 });
            put(f, i, x, y, z, G.procedural);
          } else {
            // A diamond for the decision.
            const t = hash01(i, 35) * 4;
            const side = Math.floor(t);
            const u = t - side;
            const hw = b.w * 0.3;
            const hh = b.h * 0.085;
            const corners = [
              [0, hh],
              [hw, 0],
              [0, -hh],
              [-hw, 0],
            ] as const;
            const [ax, ay] = corners[side]!;
            const [cx2, cy2] = corners[(side + 1) % 4]!;
            put(f, i, b.cx + ax + (cx2 - ax) * u, cy + ay + (cy2 - ay) * u, z, G.procedural);
          }
        }
      }
    }
  }
  return f;
}

/* ─── Short-term memory: a ribbon of turns and the summary they fold into ───────────── */

/** Widths of the ten turns on the ribbon; the fourth is an oversized one (a pasted file). */
const TURN_W = [0.17, 0.21, 0.15, 0.52, 0.19, 0.16, 0.21, 0.15, 0.2, 0.17] as const;
export const LONG_TURN = 3;
const TURN_GAP = 0.045;
/** An oversized turn keeps its opening and its end: 60% of the budget from the head, 40% from the tail. */
export const HEAD_SHARE = 0.6;
const LONG_BUDGET = 0.27;
/** Of the oversized message, the first 31% and the last 21% fit the budget, at 60:40. */
const HEAD_CUT = 0.31;
const TAIL_CUT = 0.79;

export interface RibbonLayout {
  knot: { cx: number; cy: number; r: number };
  /** Each turn's span on the ribbon. */
  turns: { x0: number; x1: number; y: number }[];
  /** Where new turns come in from. */
  spawn: { x: number; y: number };
}

export function ribbonLayout(wide: boolean, elided: boolean): RibbonLayout {
  const width = (k: number) => (k === LONG_TURN && elided ? LONG_BUDGET + 0.03 : TURN_W[k]!);
  const turns: RibbonLayout['turns'] = [];
  if (wide) {
    let x = -1.12;
    for (let k = 0; k < TURN_W.length; k++) {
      turns.push({ x0: x, x1: x + width(k), y: 0.5 });
      x += width(k) + TURN_GAP;
    }
    return { knot: { cx: -1.48, cy: 0.5, r: 0.14 }, turns, spawn: { x: 1.85, y: 0.5 } };
  }
  // Two rows on a phone: the five older turns above, the five newer below.
  for (const [row, y] of [
    [0, 0.72],
    [1, 0.34],
  ] as const) {
    let x = -0.68;
    for (let k = row * 5; k < row * 5 + 5; k++) {
      turns.push({ x0: x, x1: x + width(k), y });
      x += width(k) + TURN_GAP;
    }
  }
  return { knot: { cx: 0, cy: 1.16, r: 0.13 }, turns, spawn: { x: 0.95, y: 0.34 } };
}

export type RibbonState = 'empty' | 'full' | 'elided' | 'folded';

export function ribbonFormation(n: number, wide: boolean, state: RibbonState): Formation {
  const f = make(n, true);
  const L = ribbonLayout(wide, state === 'elided');
  const full = ribbonLayout(wide, false);
  const shares = [0.18, ...TURN_W];
  for (let i = 0; i < n; i++) {
    const z = (hash01(i, 41) - 0.5) * 0.03;
    const p = part(i, 40, shares);
    if (p === 0) {
      const [x, y] = inDisc(i, 42, L.knot.cx, L.knot.cy, L.knot.r);
      put(f, i, x, y, z, G.summary);
      f.seq![i] = 0;
      continue;
    }
    const k = p - 1;
    const u = hash01(i, 43);
    const v = (hash01(i, 44) - 0.5) * 0.15;
    // The manager opens; the learner answers. The oversized turn is a file the learner pasted.
    const own = k % 2 === 0 ? G.npc : G.learner;
    f.seq![i] = k / TURN_W.length + u * 0.04;
    if (state === 'empty') {
      put(f, i, L.spawn.x + (u - 0.5) * 0.2, L.spawn.y + v, z, G.hidden);
    } else if (state === 'folded') {
      const [x, y] = inDisc(i, 45, L.knot.cx, L.knot.cy, L.knot.r * 0.55);
      put(f, i, x, y, z, G.absorbed);
      f.seq![i] = k / TURN_W.length;
    } else {
      const t = (state === 'elided' ? L : full).turns[k]!;
      if (k === LONG_TURN && state === 'elided') {
        const head = LONG_BUDGET * HEAD_SHARE;
        const tail = LONG_BUDGET - head;
        if (u < HEAD_CUT) put(f, i, t.x0 + (u / HEAD_CUT) * head, t.y + v, z, own);
        else if (u > TAIL_CUT) put(f, i, t.x0 + head + 0.03 + ((u - TAIL_CUT) / (1 - TAIL_CUT)) * tail, t.y + v, z, own);
        else put(f, i, t.x0 + head + 0.015, t.y + v * 0.4, z, G.elided);
      } else put(f, i, t.x0 + (t.x1 - t.x0) * u, t.y + v, z, own);
    }
  }
  return f;
}

/* ─── Scratchpad: a verdict written first, then the reply spoken ───────────────────── */

export interface ScratchLayout {
  pad: Box;
  head: { x: number; base: number; scale: number };
  /** Where the spoken reply leaves the head and where it goes. */
  mouth: [number, number];
  out: [number, number];
}

export function scratchLayout(wide: boolean): ScratchLayout {
  return wide
    ? { pad: { cx: -1.06, cy: 0.55, w: 1.1, h: 0.86 }, head: { x: 0.16, base: 0.06, scale: 0.66 }, mouth: [0.36, 0.5], out: [1.7, 0.5] }
    : { pad: { cx: 0, cy: 1.3, w: 1.24, h: 0.62 }, head: { x: -0.22, base: -0.08, scale: 0.6 }, mouth: [-0.04, 0.33], out: [0.86, 0.33] };
}

/** Lines of the verdict, as shares of the pad's width. */
const VERDICT_LINES = [0.86, 0.7, 0.8, 0.55, 0.78, 0.4] as const;

export function scratchFormation(bust: Float32Array, wide: boolean, written: boolean): Formation {
  const n = bust.length / 3;
  const f = make(n, true);
  const L = scratchLayout(wide);
  const rows = VERDICT_LINES.length;
  for (let i = 0; i < n; i++) {
    const z = (hash01(i, 51) - 0.5) * 0.03;
    const p = part(i, 50, [0.5, 0.12, 0.38]);
    f.seq![i] = 0;
    if (p === 0) placeMiniBust(f, i, bust, L.head.x, L.head.base, L.head.scale, G.fire);
    else if (p === 1) {
      const [x, y] = onOutline(i, 52, L.pad);
      put(f, i, x, y, z, G.frame);
    } else {
      // Handwriting: each line is a run of words, written left to right, top to bottom.
      const r = Math.floor(hash01(i, 53) * rows);
      const len = VERDICT_LINES[r]! * L.pad.w * 0.84;
      const u = hash01(i, 54);
      const x0 = L.pad.cx - L.pad.w * 0.42;
      // Seven words to a line, each filling four fifths of its slot so the gaps read as spaces.
      const word = Math.floor(u * 7);
      const inWord = (u * 7) % 1;
      const x = x0 + (len * (word + inWord * 0.8)) / 7;
      const y = L.pad.cy + L.pad.h * 0.36 - (r * L.pad.h * 0.72) / (rows - 1) + (hash01(i, 55) - 0.5) * 0.022 + Math.sin(word * 2.3) * 0.004;
      put(f, i, x, y, z, written ? G.pad : G.hidden);
      f.seq![i] = (r + u) / rows;
    }
  }
  return f;
}

/* ─── Select: a compact stack beside a library and the stage's FAQ shelf ─────────── */

export interface SelectLayout {
  stack: StackBox;
  library: Box;
  faq: Box;
  /** Books on the shelves and FAQ cards, for sparks. */
  books: Box[];
  cards: Box[];
}

export function selectLayout(wide: boolean): SelectLayout {
  const stack: StackBox = wide ? { cx: -0.78, base: 0.04, w: 1.0, h: 0.92 } : { cx: 0, base: 0.6, w: 1.1, h: 0.8 };
  const library: Box = wide ? { cx: 0.95, cy: 0.33, w: 1.3, h: 0.6 } : { cx: 0, cy: -0.12, w: 1.2, h: 0.5 };
  const faq: Box = wide ? { cx: 0.95, cy: 0.86, w: 1.3, h: 0.18 } : { cx: 0, cy: 0.38, w: 1.2, h: 0.16 };
  const books: Box[] = [];
  for (let row = 0; row < 2; row++) {
    const shelfBase = library.cy - library.h / 2 + row * library.h * 0.52;
    let x = library.cx - library.w / 2 + 0.02;
    let k = 0;
    while (x < library.cx + library.w / 2 - 0.12) {
      const bw = 0.08 + hash01(k + row * 31, 61) * 0.06;
      const bh = library.h * (0.3 + hash01(k + row * 31, 62) * 0.16);
      books.push({ cx: x + bw / 2, cy: shelfBase + bh / 2, w: bw, h: bh });
      x += bw + 0.025;
      k++;
    }
  }
  const cards: Box[] = [0, 1, 2, 3].map((k) => ({ cx: faq.cx - faq.w / 2 + faq.w * (0.125 + k * 0.25), cy: faq.cy, w: faq.w * 0.21, h: faq.h }));
  return { stack, library, faq, books, cards };
}

export function selectFormation(blocks: Float32Array, wide: boolean): Formation {
  const n = blocks.length;
  const f = make(n);
  const L = selectLayout(wide);
  const bands = stackLayout(ALL_ON, L.stack);
  for (let i = 0; i < n; i++) {
    const z = (hash01(i, 61) - 0.5) * 0.03;
    const p = part(i, 60, [0.7, 0.21, 0.09]);
    if (p === 0) placeInStack(f, i, blocks[i]!, bands, L.stack);
    else if (p === 1) {
      const b = L.books[Math.floor(hash01(i, 63) * L.books.length)]!;
      // Books: mostly spine outlines, a few points inside.
      if (hash01(i, 64) < 0.7) {
        const [x, y] = onOutline(i, 65, b);
        put(f, i, x, y, z, G.library);
      } else put(f, i, b.cx + (hash01(i, 66) - 0.5) * b.w * 0.6, b.cy + (hash01(i, 67) - 0.5) * b.h * 0.8, z, G.library);
    } else {
      const c = L.cards[Math.floor(hash01(i, 68) * L.cards.length)]!;
      if (hash01(i, 69) < 0.62) {
        const [x, y] = onOutline(i, 70, c);
        put(f, i, x, y, z, G.faq);
      } else {
        // A question line and an answer line on each card.
        const line = hash01(i, 71) < 0.5 ? 0.22 : -0.16;
        put(f, i, c.cx - c.w * 0.36 + hash01(i, 72) * c.w * (line > 0 ? 0.72 : 0.5), c.cy + line * c.h, z, G.faq);
      }
    }
  }
  return f;
}

/* ─── Isolate: a lead and four sub-agents, each in its own clean window ───────────── */

export interface AgentsLayout {
  lead: { x: number; base: number; scale: number };
  windows: Box[];
  subScale: number;
}

export function agentsLayout(wide: boolean): AgentsLayout {
  const windows: Box[] = wide
    ? [
        { cx: 0.42, cy: 0.78, w: 0.66, h: 0.44 },
        { cx: 1.22, cy: 0.78, w: 0.66, h: 0.44 },
        { cx: 0.42, cy: 0.24, w: 0.66, h: 0.44 },
        { cx: 1.22, cy: 0.24, w: 0.66, h: 0.44 },
      ]
    : [
        { cx: -0.38, cy: 0.42, w: 0.66, h: 0.42 },
        { cx: 0.38, cy: 0.42, w: 0.66, h: 0.42 },
        { cx: -0.38, cy: -0.1, w: 0.66, h: 0.42 },
        { cx: 0.38, cy: -0.1, w: 0.66, h: 0.42 },
      ];
  return wide ? { lead: { x: -0.95, base: 0.1, scale: 0.72 }, windows, subScale: 0.34 } : { lead: { x: 0, base: 0.72, scale: 0.6 }, windows, subScale: 0.32 };
}

export function agentsFormation(bust: Float32Array, wide: boolean): Formation {
  const n = bust.length / 3;
  const f = make(n);
  const L = agentsLayout(wide);
  for (let i = 0; i < n; i++) {
    const p = part(i, 80, [0.34, 0.11, 0.11, 0.11, 0.11, 0.22]);
    if (p === 0) placeMiniBust(f, i, bust, L.lead.x, L.lead.base, L.lead.scale, G.lead);
    else if (p <= 4) {
      const w = L.windows[p - 1]!;
      placeMiniBust(f, i, bust, w.cx - 0.08, w.cy - w.h * 0.42, L.subScale, G.sub + p - 1);
    } else {
      const w = L.windows[Math.floor(hash01(i, 81) * 4)]!;
      const [x, y] = onOutline(i, 82, w);
      put(f, i, x, y, (hash01(i, 83) - 0.5) * 0.02, G.window);
    }
  }
  return f;
}

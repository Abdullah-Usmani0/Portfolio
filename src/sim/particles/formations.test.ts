import { describe, expect, it } from 'vitest';
import { CACHE_LINE } from './bust.ts';
import {
  ALL_ON,
  BLOCKS,
  G,
  GROUP_COUNT,
  HEAD_SHARE,
  LONG_TURN,
  MAIN_STACK,
  agentsFormation,
  blocksByHeight,
  bustFormation,
  cacheLineY,
  hash01,
  memoryFormation,
  ribbonFormation,
  ribbonLayout,
  scratchFormation,
  selectFormation,
  stackFormation,
  stackLayout,
  type Formation,
} from './formations.ts';

const N = 4000;
// A stand-in head: points spread over a 1 × 1 box, so heights are spread evenly.
const bust = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  bust[i * 3] = hash01(i, 1) - 0.5;
  bust[i * 3 + 1] = hash01(i, 2);
  bust[i * 3 + 2] = (hash01(i, 3) - 0.5) * 0.4;
}
const blocks = blocksByHeight(bust);

function extent(f: Formation, visibleOnly = true) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < f.group.length; i++) {
    if (visibleOnly && f.group[i] === G.hidden) continue;
    x0 = Math.min(x0, f.pos[i * 3]!);
    x1 = Math.max(x1, f.pos[i * 3]!);
    y0 = Math.min(y0, f.pos[i * 3 + 1]!);
    y1 = Math.max(y1, f.pos[i * 3 + 1]!);
  }
  return { w: x1 - x0, h: y1 - y0, x0, x1, y0, y1 };
}

function wellFormed(f: Formation) {
  expect(f.pos.length).toBe(N * 3);
  expect(f.group.length).toBe(N);
  for (const v of f.pos) expect(Number.isFinite(v)).toBe(true);
  for (const g of f.group) {
    expect(Number.isInteger(g)).toBe(true);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThan(GROUP_COUNT);
  }
  if (f.seq) for (const s of f.seq) expect(s).toBeGreaterThanOrEqual(0);
}

describe('blocksByHeight', () => {
  it('gives every block an equal share, the crown to identity and the shoulders to voice', () => {
    const counts = new Array<number>(BLOCKS).fill(0);
    const meanY = new Array<number>(BLOCKS).fill(0);
    for (let i = 0; i < N; i++) {
      counts[blocks[i]!]!++;
      meanY[blocks[i]!]! += bust[i * 3 + 1]!;
    }
    for (const c of counts) expect(c).toBe(N / BLOCKS);
    for (let k = 1; k < BLOCKS; k++) expect(meanY[k]!).toBeLessThan(meanY[k - 1]!);
  });
});

describe('stackLayout', () => {
  it('fills the box top to bottom, with the cache line as a gap between prefix and tail', () => {
    const bands = stackLayout(ALL_ON, MAIN_STACK);
    expect(bands[0]!.top).toBeCloseTo(MAIN_STACK.base + MAIN_STACK.h, 10);
    const last = bands.at(-1)!;
    expect(last.top - last.h).toBeCloseTo(MAIN_STACK.base, 10);
    for (let k = 1; k < BLOCKS; k++) expect(bands[k]!.top).toBeLessThan(bands[k - 1]!.top);
    const gap = bands[CACHE_LINE - 1]!.top - bands[CACHE_LINE - 1]!.h - bands[CACHE_LINE]!.top;
    expect(gap).toBeGreaterThan(0.05);
    expect(cacheLineY(bands)).not.toBeNull();
  });

  it('closes up when blocks are left out, and drops the cache line when one side is empty', () => {
    const mask = ALL_ON.map((_, k) => k !== 6 && k !== 7);
    const bands = stackLayout(mask, MAIN_STACK);
    expect(bands[6]!.h).toBe(0);
    expect(bands[7]!.h).toBe(0);
    // The rest grow to fill the same box.
    expect(bands[0]!.h).toBeGreaterThan(stackLayout(ALL_ON, MAIN_STACK)[0]!.h);
    const last = bands.at(-1)!;
    expect(last.top - last.h).toBeCloseTo(MAIN_STACK.base, 10);
    const tailOnly = ALL_ON.map((_, k) => k >= CACHE_LINE);
    expect(cacheLineY(stackLayout(tailOnly, MAIN_STACK))).toBeNull();
  });
});

describe('stackFormation', () => {
  it('puts each point in its own block’s band', () => {
    const f = stackFormation(blocks);
    wellFormed(f);
    const bands = stackLayout(ALL_ON, MAIN_STACK);
    for (let i = 0; i < N; i++) {
      const b = bands[blocks[i]!]!;
      const y = f.pos[i * 3 + 1]!;
      expect(y).toBeLessThanOrEqual(b.top);
      expect(y).toBeGreaterThanOrEqual(b.top - b.h);
      expect(f.group[i]).toBe(blocks[i]);
      expect(Math.abs(f.pos[i * 3]!)).toBeLessThanOrEqual(MAIN_STACK.w / 2);
    }
  });
});

describe('every formation', () => {
  const all: [string, Formation, number][] = [
    ['bust', bustFormation(bust), 1.1],
    ['stack', stackFormation(blocks), 2.8],
    ['memory', memoryFormation(blocks, true), 3.4],
    ['ribbon', ribbonFormation(N, true, 'full'), 3.4],
    ['scratch', scratchFormation(bust, true, true), 3.4],
    ['select', selectFormation(blocks, true), 3.4],
    ['agents', agentsFormation(bust, true), 3.4],
  ];
  const narrow: [string, Formation][] = [
    ['memory', memoryFormation(blocks, false)],
    ['ribbon', ribbonFormation(N, false, 'full')],
    ['scratch', scratchFormation(bust, false, true)],
    ['select', selectFormation(blocks, false)],
    ['agents', agentsFormation(bust, false)],
  ];

  it('places every point, finitely, in a known group', () => {
    for (const [, f] of all) wellFormed(f);
    for (const [, f] of narrow) wellFormed(f);
  });

  it('fits the stage it is framed in: wide on a wide screen, narrow on a phone', () => {
    for (const [name, f, maxW] of all) expect(extent(f).w, name).toBeLessThanOrEqual(maxW);
    for (const [name, f] of narrow) expect(extent(f).w, name).toBeLessThanOrEqual(1.8);
  });

  it('is the same every time', () => {
    expect(memoryFormation(blocks, true).pos).toEqual(memoryFormation(blocks, true).pos);
    expect(agentsFormation(bust, false).group).toEqual(agentsFormation(bust, false).group);
  });
});

describe('memoryFormation', () => {
  it('has all four kinds, and working memory keeps the blocks’ own colours', () => {
    const f = memoryFormation(blocks, true);
    const groups = new Set(f.group);
    for (const g of [G.episodic, G.semantic, G.procedural]) expect(groups.has(g)).toBe(true);
    for (let k = 0; k < BLOCKS; k++) expect(groups.has(k)).toBe(true);
  });
});

describe('ribbonFormation', () => {
  it('folds every turn into the summary, and hides them before they arrive', () => {
    const folded = ribbonFormation(N, true, 'folded');
    const empty = ribbonFormation(N, true, 'empty');
    expect(folded.group.some((g) => g === G.learner || g === G.npc)).toBe(false);
    expect(empty.group.some((g) => g === G.learner || g === G.npc)).toBe(false);
    expect(empty.group.some((g) => g === G.hidden)).toBe(true);
  });

  it('keeps an oversized turn’s head and tail at 60:40 and drops its middle', () => {
    const f = ribbonFormation(N, true, 'elided');
    const t = ribbonLayout(true, true).turns[LONG_TURN]!;
    const xs = [...Array(N).keys()]
      .filter((i) => f.group[i] === G.learner && Math.abs(f.pos[i * 3 + 1]! - t.y) < 0.1 && f.pos[i * 3]! >= t.x0 - 1e-6 && f.pos[i * 3]! <= t.x1 + 1e-6)
      .map((i) => f.pos[i * 3]! - t.x0);
    const head = Math.max(...xs.filter((x) => x < 0.17));
    const tailStart = Math.min(...xs.filter((x) => x > 0.17));
    const tail = Math.max(...xs) - tailStart;
    expect(head / (head + tail)).toBeCloseTo(HEAD_SHARE, 1);
    expect(f.group.some((g) => g === G.elided)).toBe(true);
    // The turns after it close up.
    expect(ribbonLayout(true, true).turns[LONG_TURN + 1]!.x0).toBeLessThan(ribbonLayout(true, false).turns[LONG_TURN + 1]!.x0);
  });

  it('brings the turns in one at a time, oldest first', () => {
    const f = ribbonFormation(N, true, 'full');
    const L = ribbonLayout(true, false);
    const seqOf = (k: number) => [...Array(N).keys()].filter((i) => f.group[i] !== G.summary && Math.abs(f.pos[i * 3]! - (L.turns[k]!.x0 + L.turns[k]!.x1) / 2) < 0.05).map((i) => f.seq![i]!);
    expect(Math.max(...seqOf(0))).toBeLessThan(Math.min(...seqOf(9)));
  });
});

describe('scratchFormation', () => {
  it('writes the verdict in place: blank and written differ only in what shows', () => {
    const blank = scratchFormation(bust, true, false);
    const written = scratchFormation(bust, true, true);
    expect(blank.pos).toEqual(written.pos);
    expect(blank.group.filter((g) => g === G.hidden).length).toBe(written.group.filter((g) => g === G.pad).length);
  });
});

describe('agentsFormation', () => {
  it('has a lead, four sub-agents and their windows', () => {
    const groups = new Set(agentsFormation(bust, true).group);
    for (const g of [G.lead, G.sub, G.sub + 1, G.sub + 2, G.sub + 3, G.window]) expect(groups.has(g)).toBe(true);
  });
});

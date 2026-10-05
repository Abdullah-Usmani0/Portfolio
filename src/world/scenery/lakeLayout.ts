/**
 * The lake stage as numbers: where the stage, its lighting truss and the learner's laptop
 * stand, how the two boats race, and where every packet and screen frame is at each moment
 * of each dive step. Pure, so the scenery, its anchors and the tests read the same numbers.
 *
 * The truss over the stage is the voice pipeline, one lamp per stage of it: listen,
 * transcribe, think, speak, and the avatar on the screen below.
 */
import { LAKE_X, riverBottom, riverTop } from './valley.ts';

/** The voice pipeline, one lamp each. */
export const PIPELINE = ['Listen', 'Transcribe', 'Think', 'Speak', 'Avatar'] as const;
/** Seconds to the first spoken sentence: two calls in a row, then one streamed call. */
export const RACE = { slow: 5.4, fast: 2.1, loop: 10 } as const;

export function lakeLayout() {
  const cx = LAKE_X;
  const shore = (x: number) => riverTop(x) + 1;
  const ax = cx + 180;
  // The stage's three steps, the screen on them, and the truss above it.
  const top = shore(ax) - 2 + 33;
  const screenY = top + 14 + 49;
  const trussY = screenY + 49 + 46;
  const lanes = [0.62, 0.32].map((k) => riverBottom(cx) + (riverTop(cx) - riverBottom(cx)) * k);
  const laptop = { x: ax - 340, y: shore(ax - 340) };
  return {
    cx,
    ax,
    shore,
    top,
    screenY,
    trussY,
    /** Where each pipeline lamp hangs from the truss. */
    lamps: PIPELINE.map((_, k) => ({ x: ax - 220 + k * 110, y: trussY - 9 })),
    /** Where a verdict goes instead of the speaker: the scoreboard at the truss's foot. */
    ledger: { x: ax - 262, y: trussY - 70 },
    race: { x0: cx - 460, span: 820, lanes },
    laptop,
    /** The gate a screen frame passes, or is dropped at, on its way to the model. */
    gate: { x: laptop.x + 62, y: laptop.y + 34 },
  };
}

export type LakeLayout = ReturnType<typeof lakeLayout>;

/** What a dive step makes the lake do; `loop` is the scene without a dive. */
export type LakeStep = 'loop' | 'race' | 'verdict' | 'sentences' | 'screen' | 'teach' | 'stack';
export const LOOPS: Readonly<Record<LakeStep, number>> = { loop: 10, race: RACE.loop, verdict: 9, sentences: 10, screen: 11, teach: 10, stack: 8 };

/** How far along a boat is, 0 to 1: the lime one (fast) and the white one (slow). */
export function boatAt(fast: boolean, t: number): number {
  const p = Math.min(1, Math.max(0, t / (fast ? RACE.fast : RACE.slow)));
  return 1 - (1 - p) ** 2;
}

export type PacketKind = 'voice' | 'text' | 'verdict' | 'sentence' | 'token';
/** A packet flies from one lamp to another (or to the scoreboard) between two times. */
interface Flight {
  kind: PacketKind;
  from: number;
  to: number | 'ledger';
  t0: number;
  t1: number;
}

const through = (kind: PacketKind, start: number, from = 0, to = 4, hop = 0.7): Flight[] =>
  Array.from({ length: to - from }, (_, k) => ({ kind, from: from + k, to: from + k + 1, t0: start + k * hop, t1: start + (k + 1) * hop }));

/** When each sentence leaves the model in the `sentences` step: as soon as it is written. */
export const SENTENCES = [1.4, 2.8, 4.2, 5.6, 7] as const;
/** In the `verdict` step: the verdict leaves first, then the reply, sentence by sentence. */
export const VERDICT = { at: 2.4, sentences: [3.6, 4.8, 6] } as const;

function flights(step: LakeStep): Flight[] {
  switch (step) {
    case 'verdict':
      return [
        { kind: 'voice', from: 0, to: 1, t0: 0.3, t1: 1.1 },
        { kind: 'text', from: 1, to: 2, t0: 1.2, t1: 2 },
        { kind: 'verdict', from: 2, to: 'ledger', t0: VERDICT.at, t1: VERDICT.at + 1 },
        ...VERDICT.sentences.flatMap((s) => through('sentence', s, 2, 4, 0.6)),
      ];
    case 'sentences':
      return [
        // The learner's words keep arriving as tokens while the model writes.
        ...Array.from({ length: 24 }, (_, k): Flight => ({ kind: 'token', from: 1, to: 2, t0: 0.2 + k * 0.28, t1: 0.75 + k * 0.28 })),
        ...SENTENCES.flatMap((s) => through('sentence', s, 2, 4, 0.55)),
      ];
    case 'stack':
      return [0, 1.6, 3.2, 4.8].flatMap((s) => through('voice', s, 0, 4, 0.5));
    case 'loop':
    case 'race':
    case 'teach':
    default:
      return [0.5, 5.5].flatMap((s) => through('voice', s, 0, 4, 0.8));
  }
}

export interface Packet {
  kind: PacketKind;
  x: number;
  y: number;
}

/** Every packet in flight at `t` seconds into a step. */
export function packetsAt(L: LakeLayout, step: LakeStep, t: number): Packet[] {
  const out: Packet[] = [];
  for (const f of flights(step)) {
    if (t < f.t0 || t > f.t1) continue;
    const u = (t - f.t0) / (f.t1 - f.t0);
    const a = L.lamps[f.from]!;
    const b = f.to === 'ledger' ? L.ledger : L.lamps[f.to]!;
    // A verdict drops away in an arc to the scoreboard, below the line the reply takes.
    const sag = f.to === 'ledger' ? Math.sin(Math.PI * u) * 14 : 0;
    out.push({ kind: f.kind, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - sag });
  }
  return out;
}

/** How lit lamp k is (0–1): bright as a packet reaches it, fading after. Always lit in `stack`. */
export function lampAt(step: LakeStep, t: number, k: number): number {
  if (step === 'stack') return 1;
  let lit = 0;
  for (const f of flights(step)) {
    if (f.to !== k && !(f.from === k && t >= f.t0 && t <= f.t1)) continue;
    const since = t - f.t1;
    if (f.to === k && since >= 0) lit = Math.max(lit, Math.max(0, 1 - since / 0.9));
    if (f.from === k && t >= f.t0 && t <= f.t1) lit = Math.max(lit, 0.6);
  }
  return lit;
}

/** How many sentences the avatar has spoken by `t` (one lantern lights for each). */
export function spokenBy(step: LakeStep, t: number): number {
  if (step === 'sentences') return SENTENCES.filter((s) => t >= s + 1.1).length;
  if (step === 'verdict') return VERDICT.sentences.filter((s) => t >= s + 1.2).length;
  return 0;
}

/** The learner's screen is polled every second; these frames repeat the one before. */
export const FRAMES = { every: 1, first: 0.4, count: 9, dup: [false, true, true, false, true, false, true, true, false] } as const;

export interface ScreenFrame {
  x: number;
  y: number;
  /** The same picture as the frame before: dropped at the gate. */
  dup: boolean;
  alpha: number;
}

/** Every screen frame in flight at `t` seconds into the `screen` step. */
export function framesAt(L: LakeLayout, t: number): ScreenFrame[] {
  const out: ScreenFrame[] = [];
  const start = { x: L.laptop.x + 8, y: L.laptop.y + 22 };
  const think = L.lamps[2]!;
  for (let j = 0; j < FRAMES.count; j++) {
    const t0 = FRAMES.first + j * FRAMES.every;
    const local = t - t0;
    if (local < 0) continue;
    const dup = FRAMES.dup[j]!;
    if (local < 0.5) {
      const u = local / 0.5;
      out.push({ x: start.x + (L.gate.x - start.x) * u, y: start.y + (L.gate.y - start.y) * u, dup, alpha: 1 });
    } else if (dup) {
      // Dropped: it falls away below the gate and fades.
      const u = (local - 0.5) / 0.7;
      if (u < 1) out.push({ x: L.gate.x, y: L.gate.y - 26 * u * u, dup, alpha: 1 - u });
    } else if (local < 1.6) {
      const u = (local - 0.5) / 1.1;
      // Up in an arc from the gate to the model's lamp.
      const x = L.gate.x + (think.x - L.gate.x) * u;
      const y = L.gate.y + (think.y - L.gate.y) * u + Math.sin(Math.PI * u) * 40;
      out.push({ x, y, dup, alpha: 1 });
    }
  }
  return out;
}

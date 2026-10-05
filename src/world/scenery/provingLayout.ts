/**
 * The proving grounds as numbers: where the trail, the bridge, the manager, the grader and
 * the owl stand, and where each simulated learner is at any moment of each dive step. Pure,
 * so the scenery, its anchors and the tests all read the same numbers.
 *
 * The trail is the order a learner meets a scenario in: they gather and read at the
 * trailhead, ask the manager, hand work in at the grader, then cross the bridge, where a
 * missing plank is the stumble a cohort finds before a real learner does.
 */
import { riverTop } from './valley.ts';
import { onValley } from './village.ts';

/** The set piece is drawn closer than the village, so it reads at a glance. */
export const SCALE = 1.8;
/** The five learner personas, each in its own scarf colour. */
export const PERSONAS = ['#7fb2e8', '#f0a35e', '#b892e0', '#8cc77a', '#e8c95a'] as const;
/** The learner whose stage reads two ways: the one who asks, and the first to stumble. */
export const ASKER = 2;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function provingLayout() {
  const cx = onValley('learners', 330);
  const bx = cx + 40;
  const span = 96 * SCALE;
  const left = bx - span / 2;
  const right = bx + span / 2;
  const deckY = riverTop(bx) + 30 * SCALE;
  const ramp = 150;
  /** The bridge deck: a gentle arch. */
  const deck = (x: number) => deckY + Math.sin(Math.PI * ((x - left) / span)) * 7 * SCALE;
  /** The trail: along the bank, up to the abutments, over the deck and down again. */
  const trail = (x: number) => {
    if (x > left && x < right) return deck(x) + 2;
    const lift = x <= left ? smooth(left - ramp, left, x) : 1 - smooth(right, right + ramp, x);
    return riverTop(x) + 1 + (deckY - riverTop(x) - 1) * lift;
  };
  return {
    cx,
    bx,
    span,
    left,
    right,
    deckY,
    ramp,
    deck,
    trail,
    /** Where the cohort gathers to read the stage. */
    lineup: PERSONAS.map((_, i) => cx - 720 + i * 34),
    manager: { x: cx - 500 },
    grader: { x: cx - 250 },
    owl: { x: left - 70 },
    /** Where the first learner stops: the edge of the missing planks. */
    gap: bx - 0.18 * span,
    /** Where a walking cohort sets out from, and how fast and how far apart. */
    start: cx - 760,
    speed: 74,
    /** A fresh cohort on the re-run walks a little quicker: nothing stops it now. */
    rerunSpeed: 96,
    spacing: 30 * SCALE,
    flags: [-470, -300, 330, 480].map((dx) => cx + dx),
  };
}

export type ProvingLayout = ReturnType<typeof provingLayout>;

/** What a dive step makes the cohort do; `loop` is the scene without a dive. */
export type ProvingStep = 'loop' | 'personas' | 'cold' | 'ask' | 'handin' | 'stumble' | 'fix' | 'rerun';
/** How long each step's animation runs before it starts again, in seconds. */
export const LOOPS: Readonly<Record<ProvingStep, number>> = { loop: 26, personas: 8, cold: 9, ask: 10, handin: 14, stumble: 8, fix: 9, rerun: 16 };

export type Bubble = 'think' | 'clear' | 'twoway' | 'ask' | 'card' | 'pass' | 'retry' | null;

export interface Pose {
  x: number;
  y: number;
  /** 1 standing, less while stumbling. */
  crouch: number;
  /** Walk cycle phase, or null while standing still. */
  walk: number | null;
  /** 1 facing right (along the trail), −1 walking back. */
  face: 1 | -1;
  visible: boolean;
  bubble: Bubble;
}

/** Each learner's turn at the grader, and how it went: some pass, some are sent back to rework. */
export const HANDIN = { first: 1, every: 2.4, walk: 0.7, wait: 1.1, outcomes: ['pass', 'retry', 'pass', 'retry', 'pass'] as const };

/** Where learner i is, at `t` seconds into step `step` (`time` is the world clock, for walk cycles). */
export function cohortPose(L: ProvingLayout, step: ProvingStep, t: number, i: number, time = t): Pose {
  const still = (x: number, bubble: Bubble = null): Pose => ({ x, y: L.trail(x), crouch: 1, walk: null, face: 1, visible: true, bubble });
  const walking = (x: number, face: 1 | -1, bubble: Bubble = null): Pose => ({
    x,
    y: L.trail(x) + Math.abs(Math.sin(time * 7 + i)) * 1.2,
    crouch: 1,
    walk: time * 7 + i,
    face,
    visible: true,
    bubble,
  });
  const home = L.lineup[i]!;

  switch (step) {
    case 'personas':
      return still(home);
    case 'cold': {
      // Everyone reads; most understand, one finds the stage reads two ways.
      if (t < 0.6 + i * 0.18 || t > 8.4) return still(home);
      if (t < 3 + i * 0.3) return still(home, 'think');
      return still(home, i === ASKER ? 'twoway' : 'clear');
    }
    case 'ask': {
      if (i !== ASKER) return still(home);
      const to = L.manager.x - 30;
      if (t < 0.4) return still(home, 'twoway');
      if (t < 2.6) return walking(home + (to - home) * smooth(0.4, 2.6, t), 1, 'twoway');
      if (t < 5.4) return still(to, 'ask');
      if (t < 8.4) return still(to, t > 7.6 ? 'clear' : null);
      if (t < 9.8) return walking(to + (home - to) * smooth(8.4, 9.8, t), -1, 'clear');
      return still(home);
    }
    case 'handin': {
      // A queue at the grader; each goes up with a card and comes back with a verdict.
      const queue = L.grader.x - 46 - i * 32;
      const booth = L.grader.x - 26;
      const a = HANDIN.first + i * HANDIN.every;
      const outcome = HANDIN.outcomes[i]!;
      if (t < a - 0.4) return still(queue);
      if (t < a) return still(queue, 'card');
      if (t < a + HANDIN.walk) return walking(queue + (booth - queue) * smooth(a, a + HANDIN.walk, t), 1, 'card');
      if (t < a + HANDIN.walk + HANDIN.wait) return still(booth, t > a + HANDIN.walk + 0.5 ? outcome : 'card');
      const back = a + HANDIN.walk + HANDIN.wait;
      if (t < back + HANDIN.walk) return walking(booth + (queue - booth) * smooth(back, back + HANDIN.walk, t), -1, outcome);
      return still(queue, t < back + HANDIN.walk + 1.4 ? outcome : null);
    }
    case 'stumble':
    case 'fix': {
      const stop = L.gap - i * L.spacing;
      const p = still(stop);
      // The first to arrive stumbles at the edge, again and again while the step is open.
      if (i === 0 && step === 'stumble') p.crouch = 0.74 + 0.26 * Math.abs(Math.sin(t * 5));
      return p;
    }
    case 'rerun': {
      // A fresh cohort, and nobody stops: the stage reads one way now, and the work passes.
      const x = L.start - i * L.spacing + t * L.rerunSpeed;
      const read = x > L.lineup[0]! - 20 && x < L.lineup.at(-1)! + 40;
      const graded = x > L.grader.x - 70 && x < L.grader.x + 30;
      return { ...walking(x, 1, read ? 'clear' : graded ? 'pass' : null), visible: x > L.start - 40 && x < L.cx + 700 };
    }
    case 'loop':
    default: {
      // The scene without a dive: the cohort arrives, the first stumbles, the owl flags it,
      // the bridge is mended and they all cross.
      const arrive = (L.gap - L.start) / L.speed;
      const fixed = arrive + 3.4;
      let x = L.start - i * L.spacing + t * L.speed;
      const stop = L.gap - i * L.spacing;
      const waiting = t < fixed && x > stop;
      if (!waiting) return { ...walking(x, 1), visible: x > L.cx - 900 && x < L.cx + 700 };
      x = stop;
      const p = still(x);
      if (i === 0) p.crouch = t - arrive < 1.4 ? 0.72 + 0.28 * Math.abs(Math.sin((t - arrive) * 6)) : 0.92;
      return p;
    }
  }
}

/** What the bridge looks like: planks missing, a ghost of the fix (previewed), or mended. */
export type Planks = 'missing' | 'ghost' | 'fixed';

/** The bridge and the owl's signal at `t` seconds into a step. */
export function bridgeAt(L: ProvingLayout, step: ProvingStep, t: number): { planks: Planks; signal: 'flag' | 'ok' | null; since: number } {
  switch (step) {
    case 'personas':
    case 'cold':
    case 'ask':
    case 'handin':
      return { planks: 'missing', signal: null, since: 0 };
    case 'stumble':
      return { planks: 'missing', signal: t > 0.8 ? 'flag' : null, since: t - 0.8 };
    case 'fix':
      return t < 3 ? { planks: 'ghost', signal: 'flag', since: 3 } : { planks: 'fixed', signal: 'ok', since: t - 3 };
    case 'rerun': {
      // The owl's tick once the last of the cohort is over.
      const crossed = (L.right + 20 - (L.start - (PERSONAS.length - 1) * L.spacing)) / L.rerunSpeed;
      return { planks: 'fixed', signal: t > crossed && t < crossed + 3 ? 'ok' : null, since: t - crossed };
    }
    case 'loop':
    default: {
      const arrive = (L.gap - L.start) / L.speed;
      const fixed = arrive + 3.4;
      if (t < fixed) return { planks: 'missing', signal: t > arrive ? 'flag' : null, since: t - arrive };
      return { planks: 'fixed', signal: t < fixed + 3 ? 'ok' : null, since: t - fixed };
    }
  }
}

/** The manager's side of the conversation in the `ask` step: thinking, then the answer. */
export function managerBubble(step: ProvingStep, t: number): 'typing' | 'reply' | null {
  if (step !== 'ask') return null;
  if (t > 5.4 && t < 6.2) return 'typing';
  if (t >= 6.2 && t < 8.6) return 'reply';
  return null;
}

/** The grader's stamp in the `handin` step: which verdict is showing, if any. */
export function graderStamp(step: ProvingStep, t: number): 'pass' | 'retry' | null {
  if (step !== 'handin') return null;
  for (let i = 0; i < HANDIN.outcomes.length; i++) {
    const at = HANDIN.first + i * HANDIN.every + HANDIN.walk + 0.5;
    if (t > at && t < at + 1.2) return HANDIN.outcomes[i]!;
  }
  return null;
}

/** How many of the three blame chips the owl has raised in the `stumble` step. */
export const blameShown = (step: ProvingStep, t: number) => (step === 'stumble' ? Math.min(3, Math.max(0, Math.floor((t - 1.4) / 1.1) + 1)) : 0);

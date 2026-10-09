/**
 * The village as numbers: which house is which place a character works in, where the
 * manager walks between them, and what the villagers are saying at each moment of each
 * dive step. Pure, so the scenery, its anchors and the tests all read the same numbers.
 *
 * Every house is one surface the same manager appears on: the chat, plan mode, the review
 * of submitted work, the kickoff, and the check-ins the post office sends. The studio
 * gives characters their faces and voices; the square in the middle is where four of them
 * talk, each in their own way.
 */
import { seeded } from './types.ts';
import { onValley, riverTop } from './valley.ts';

/** The places the same manager works, in the order a learner meets them. */
export const SURFACES = ['chat', 'plan', 'review', 'kickoff', 'post'] as const;
export type Surface = (typeof SURFACES)[number];
export type HouseKind = Surface | 'studio' | 'home';

export interface House {
  kind: HouseKind;
  x0: number;
  w: number;
  h: number;
  roof: number;
  /** Where its walls stand on the bank. */
  base: number;
  /** Where its door is: the manager stops here. */
  door: number;
  /** The door's half width and height. */
  doorW: number;
  doorH: number;
  /** Its windows: left, bottom, width, height. */
  windows: [number, number, number, number][];
  /** A chimney on the roof (left edge, bottom, top), or none. */
  chimney: { x: number; y0: number; y1: number } | null;
}

/** kind, offset from the village centre, width, wall height, roof height. */
const PLAN: readonly (readonly [HouseKind, number, number, number, number])[] = [
  ['home', -470, 44, 30, 18],
  ['chat', -414, 56, 40, 22],
  ['plan', -344, 54, 38, 20],
  ['review', -276, 58, 42, 24],
  ['kickoff', 30, 104, 54, 30],
  ['post', 150, 56, 38, 20],
  ['studio', 222, 76, 48, 24],
  ['home', 316, 46, 32, 20],
  ['home', 378, 50, 34, 20],
];

/** The four voices a character can talk in, one per villager in the square. */
export const STYLES = ['Dry and clipped', 'Warm and hypey', 'Chill, thinks aloud', 'Proper but human'] as const;

export function villageLayout() {
  const cx = onValley('npcs', 60);
  const rnd = seeded(42);
  const houses: House[] = PLAN.map(([kind, dx, w, h, roof]) => {
    const x0 = cx + dx;
    const base = riverTop(x0 + w / 2) + 1;
    const door = x0 + w / 2;
    const hall = kind === 'kickoff';
    // Windows either side of the door; the studio has one big window above it instead.
    const windows: House['windows'] =
      kind === 'studio' ? [[door - 20, base + 20, 40, 18]] : (w > 50 ? [0.2, 0.8] : [0.22]).map((k) => [x0 + w * k - 5, base + h * 0.42, 10, hall ? 14 : 11]);
    // Every home has a chimney, and some of the others.
    let chimney: House['chimney'] = null;
    if (kind === 'home' || rnd() > 0.4) {
      const x = x0 + w * (0.68 + rnd() * 0.12);
      chimney = { x, y0: base + h + roof * 0.3, y1: base + h + roof * 0.95 };
    }
    return { kind, x0, w, h, roof, base, door, doorW: hall ? 9 : 4.5, doorH: hall ? 22 : 15, windows, chimney };
  });
  const house = (kind: HouseKind) => houses.find((h) => h.kind === kind)!;
  const review = house('review');
  const kickoff = house('kickoff');
  /** The open square between the review house and the kickoff hall. */
  const square = { x0: review.x0 + review.w + 12, x1: kickoff.x0 - 12 };
  const talkers = STYLES.map((_, i) => square.x0 + 26 + i * ((square.x1 - square.x0 - 52) / (STYLES.length - 1)));
  return {
    cx,
    houses,
    house,
    square,
    /** Where the four villagers in the square stand. */
    talkers,
    /** Where the manager stops on the way round: one door per surface. */
    doors: SURFACES.map((s) => house(s).door),
    ground: (x: number) => riverTop(x) + 1,
  };
}

export type VillageLayout = ReturnType<typeof villageLayout>;

/** What a dive step makes the village do; `loop` is the scene without a dive. */
export type VillageStep = 'loop' | 'everywhere' | 'styles' | 'disposition' | 'onemanager' | 'checkins' | 'faces';
/** How long each step's animation runs before it starts again, in seconds. */
export const LOOPS: Readonly<Record<VillageStep, number>> = { loop: 0, everywhere: 0, styles: 9, disposition: 8, onemanager: 9, checkins: 12, faces: 10 };

/** The manager's round: walking pace, and how long it stays at each door. */
export const ROUND = { speed: 52, pause: 1.6 } as const;
/** The doors in the order the manager visits them: along the bank and back. */
const ORDER = [0, 1, 2, 3, 4, 3, 2, 1] as const;

/** How long one round takes. */
export function roundLength(L: VillageLayout): number {
  let total = 0;
  ORDER.forEach((d, k) => {
    const next = ORDER[(k + 1) % ORDER.length]!;
    total += ROUND.pause + Math.abs(L.doors[next]! - L.doors[d]!) / ROUND.speed;
  });
  return total;
}

export interface ManagerPose {
  x: number;
  /** 1 walking right, −1 walking left. */
  face: 1 | -1;
  walking: boolean;
  /** The surface whose door the manager is at, or null on the way. */
  at: Surface | null;
  /** Seconds since arriving at that door. */
  since: number;
}

/** Where the manager is `t` seconds into the round. */
export function managerOnRound(L: VillageLayout, t: number): ManagerPose {
  let left = ((t % roundLength(L)) + roundLength(L)) % roundLength(L);
  for (let k = 0; k < ORDER.length; k++) {
    const d = ORDER[k]!;
    const next = ORDER[(k + 1) % ORDER.length]!;
    if (left < ROUND.pause) return { x: L.doors[d]!, face: next >= d ? 1 : -1, walking: false, at: SURFACES[d]!, since: left };
    left -= ROUND.pause;
    const span = Math.abs(L.doors[next]! - L.doors[d]!) / ROUND.speed;
    if (left < span) {
      const u = left / span;
      return { x: L.doors[d]! + (L.doors[next]! - L.doors[d]!) * u, face: next > d ? 1 : -1, walking: true, at: null, since: 0 };
    }
    left -= span;
  }
  return { x: L.doors[0]!, face: 1, walking: false, at: 'chat', since: 0 };
}

/** Where the manager is in a dive step: on the round, or at the door the step is about. */
export function managerAt(L: VillageLayout, step: VillageStep, t: number): ManagerPose {
  const stand = (s: HouseKind): ManagerPose => ({ x: L.house(s).door, face: -1, walking: false, at: s === 'studio' || s === 'home' ? null : s, since: t });
  switch (step) {
    case 'styles':
    case 'onemanager':
      // Beside the hall's door rather than in it, so nothing over the door hides them.
      return { ...stand('kickoff'), x: L.house('kickoff').door - 30 };
    case 'disposition':
      return stand('chat');
    case 'checkins':
      return stand('post');
    case 'faces':
      return { ...stand('studio'), x: L.house('studio').door - 30 };
    case 'everywhere':
    case 'loop':
    default:
      return managerOnRound(L, t);
  }
}

/** What each villager in the square is saying in the `styles` step: one after another. */
export const talkerSays = (step: VillageStep, t: number, i: number) => step === 'styles' && t > 0.6 + i * 1.4 && t < LOOPS.styles - 0.4;

/** The post office's bell in the `checkins` step: it rings once, when every gate has passed. */
export const BELL = { at: 5.6, for: 1.6 } as const;
export const bellRinging = (step: VillageStep, t: number) => step === 'checkins' && t > BELL.at && t < BELL.at + BELL.for;

/** The studio's flash in the `faces` step: a picture taken every few seconds. */
export const FLASHES = [1.2, 3.6, 6, 8.4] as const;
export const flashAt = (step: VillageStep, t: number) => (step === 'faces' ? Math.max(0, ...FLASHES.map((f) => 1 - Math.abs(t - f) * 5)) : 0);

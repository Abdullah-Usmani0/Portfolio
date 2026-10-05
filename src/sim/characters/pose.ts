/**
 * Procedural character animation — pure math, no renderer.
 *
 * A villager is six rigid parts on joints (hips, shoulders, neck). Each frame we ask
 * `pose(action, t, persona)` for joint angles. Persona changes *how* an action is
 * performed: energy → bounce and speed, confidence → posture, stress → fidget.
 * Character faces +Z (three's frame); angles are radians.
 */
export type Action = 'idle' | 'walk' | 'wave' | 'talk' | 'work' | 'stumble' | 'celebrate';

export interface Persona {
  /** 0 calm … 1 bouncy */
  energy: number;
  /** 0 hunched … 1 upright */
  confidence: number;
  /** 0 relaxed … 1 fidgety */
  stress: number;
}

export interface Pose {
  /** Vertical offset of the whole body (m). */
  lift: number;
  /** Squash & stretch: scale.y of the body (scale.xz = 1/sqrt(sy) preserves volume). */
  squash: number;
  /** Lean forward (+) / back (−) around X. */
  lean: number;
  /** Sway left/right around Z. */
  sway: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  /** Arm swing around X at the shoulder (+ forward). */
  armL: number;
  armR: number;
  /** Arm raise around Z at the shoulder (+ outwards / up). */
  armLRaise: number;
  armRRaise: number;
  /** Leg swing around X at the hip (+ forward). */
  legL: number;
  legR: number;
}

export const NEUTRAL_PERSONA: Persona = { energy: 0.5, confidence: 0.6, stress: 0.2 };

const TAU = Math.PI * 2;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Cheap smooth 1-D value noise in [-1, 1] — deterministic per seed. */
export function noise1(x: number, seed = 0): number {
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/** Walking speed in m/s for a persona — the stage moves the villager this fast along its path. */
export function walkSpeed(p: Persona): number {
  return 0.9 + 0.7 * clamp(p.energy, 0, 1);
}

export function pose(action: Action, t: number, persona: Persona = NEUTRAL_PERSONA, seed = 0): Pose {
  const e = clamp(persona.energy, 0, 1);
  const c = clamp(persona.confidence, 0, 1);
  const s = clamp(persona.stress, 0, 1);

  // Always-on life: breathing, posture, a wandering gaze, and stress fidget.
  const breath = Math.sin(t * (1.4 + e * 0.6) + seed) * 0.012;
  const fidget = s * 0.06 * noise1(t * (2 + s * 4), seed + 9);
  const base: Pose = {
    lift: 0,
    squash: 1 + breath,
    lean: (0.5 - c) * 0.22,
    sway: fidget * 0.6,
    headYaw: noise1(t * 0.35, seed + 1) * 0.45,
    headPitch: (c - 0.55) * -0.25 + noise1(t * 0.27, seed + 2) * 0.06,
    headRoll: noise1(t * 0.31, seed + 3) * 0.05,
    armL: 0.05 + fidget,
    armR: 0.05 - fidget,
    armLRaise: 0.12,
    armRRaise: 0.12,
    legL: 0,
    legR: 0,
  };

  switch (action) {
    case 'idle':
      return base;

    case 'walk': {
      const freq = 1.6 + e * 0.9; // steps per second
      const ph = t * freq * Math.PI;
      const stride = 0.45 + e * 0.15;
      const bounce = Math.abs(Math.sin(ph));
      return {
        ...base,
        lift: bounce * (0.04 + e * 0.05),
        squash: 1 + (bounce - 0.5) * (0.04 + e * 0.04),
        lean: base.lean + 0.06,
        sway: Math.sin(ph) * 0.05,
        headYaw: base.headYaw * 0.4,
        legL: Math.sin(ph) * stride,
        legR: -Math.sin(ph) * stride,
        armL: -Math.sin(ph) * stride * 0.8,
        armR: Math.sin(ph) * stride * 0.8,
      };
    }

    case 'wave': {
      const w = Math.sin(t * TAU * (1.6 + e * 0.8));
      return {
        ...base,
        sway: base.sway + w * 0.03,
        headRoll: base.headRoll + w * 0.04,
        headYaw: base.headYaw * 0.3,
        armRRaise: 2.55 + w * 0.32,
        armR: 0.15,
        lift: Math.max(0, w) * 0.015 * (1 + e),
      };
    }

    case 'talk': {
      const k = t * (2.2 + e);
      return {
        ...base,
        headPitch: base.headPitch + Math.sin(k * 2.1) * 0.06,
        headYaw: base.headYaw * 0.5 + Math.sin(k * 0.7) * 0.12,
        armL: 0.3 + Math.sin(k) * 0.25 * (0.5 + e),
        armR: 0.25 + Math.sin(k + 1.7) * 0.2 * (0.5 + e),
        armLRaise: 0.3,
        armRRaise: 0.25,
      };
    }

    case 'work': {
      const k = t * TAU * 0.9;
      const swing = Math.max(0, Math.sin(k));
      return {
        ...base,
        lean: base.lean + 0.25 * swing,
        armL: 0.9 * swing,
        armR: 0.9 * swing,
        headPitch: 0.2,
      };
    }

    case 'stumble': {
      // A 1.6 s trip-and-recover, then loop back to idle shape.
      const k = (t % 1.6) / 1.6;
      const trip = Math.sin(Math.min(1, k * 2) * Math.PI);
      return {
        ...base,
        lean: base.lean + 0.55 * trip,
        squash: 1 - 0.08 * trip,
        armLRaise: 0.12 + 1.2 * trip,
        armRRaise: 0.12 + 1.2 * trip,
        legL: 0.35 * trip,
        headPitch: -0.3 * trip,
      };
    }

    case 'celebrate': {
      const k = t * TAU * 1.4;
      const hop = Math.max(0, Math.sin(k));
      return {
        ...base,
        lift: hop * 0.28,
        squash: 1 + (hop - 0.4) * 0.12,
        armLRaise: 2.4 + Math.sin(k) * 0.2,
        armRRaise: 2.4 - Math.sin(k) * 0.2,
        headPitch: -0.15,
      };
    }
  }
}

const POSE_KEYS = [
  'lift', 'squash', 'lean', 'sway', 'headYaw', 'headPitch', 'headRoll',
  'armL', 'armR', 'armLRaise', 'armRRaise', 'legL', 'legR',
] as const satisfies readonly (keyof Pose)[];

/** Cross-fade two poses (w = 0 → a, 1 → b) so switching actions never pops. */
export function blendPose(a: Pose, b: Pose, w: number): Pose {
  const t = clamp(w, 0, 1);
  if (t === 0) return { ...a };
  if (t === 1) return { ...b };
  const out = { ...a };
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

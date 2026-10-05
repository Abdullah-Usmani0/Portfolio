import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Tier } from '@/sim/device/tier.ts';

/**
 * Per-frame world state. Read it in useFrame with `stage.getState()` (no React re-render);
 * subscribe with `useStage(selector)` only for things that change rarely (tier, ready).
 */
export interface StageState {
  /** Time-of-day dial, 0 dawn … 1 night. */
  tod: number;
  /** Where the visitor is in the journey, 0..1 (drives the camera). */
  progress: number;
  /** Index of the director key the camera is nearest — the current act. */
  act: number;
  /** 0 while the camera rests on a shot, up to 1 mid-move. */
  moving: number;
  /** Clock time (s) the intro crane started; null until the world is ready. */
  introStart: number | null;
  /** When set (the sun dial), time of day stops following the scroll. */
  todOverride: number | null;
  /** Mind Garden: true = poured into the context pond, false = bust, null = attract loop. */
  mindPond: boolean | null;
  /** Pointer in normalized device coords, for gentle parallax. */
  pointer: { x: number; y: number };
  tier: Tier;
  ready: boolean;
  /** Frames rendered — the test hook reads this to know the stage is alive. */
  frames: number;
  setTod: (tod: number) => void;
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  setTier: (tier: Tier) => void;
  setReady: (ready: boolean) => void;
  setShot: (act: number, moving: number) => void;
  setTodOverride: (tod: number | null) => void;
  setMindPond: (pond: boolean | null) => void;
}

export const stage = createStore<StageState>()((set) => ({
  tod: 0,
  progress: 0,
  act: 0,
  moving: 0,
  introStart: null,
  todOverride: null,
  mindPond: null,
  pointer: { x: 0, y: 0 },
  tier: 'mid',
  ready: false,
  frames: 0,
  setTod: (tod) => set({ tod: Math.min(1, Math.max(0, tod)) }),
  setProgress: (progress) => set({ progress: Math.min(1, Math.max(0, progress)) }),
  setPointer: (x, y) => set({ pointer: { x, y } }),
  setTier: (tier) => set({ tier }),
  setReady: (ready) => set({ ready }),
  setTodOverride: (todOverride) => set({ todOverride: todOverride === null ? null : Math.min(1, Math.max(0, todOverride)) }),
  setMindPond: (mindPond) => set({ mindPond }),
  setShot: (act, moving) => set((s) => (s.act === act && Math.abs(s.moving - moving) < 0.02 ? s : { act, moving })),
}));

export function useStage<T>(selector: (s: StageState) => T): T {
  return useStore(stage, selector);
}

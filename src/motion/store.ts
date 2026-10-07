import { create } from 'zustand';
import { WORLD_LOOKS } from '@/world/palette.ts';

/** What the UI needs from the world: the hour, whether the sky is dark, the nearest scene. */
export const useDay = create<{ label: string; clock: string; dark: boolean; scene: number }>(() => ({
  label: WORLD_LOOKS.dawn.label,
  clock: WORLD_LOOKS.dawn.clock,
  dark: false,
  scene: 0,
}));

/** The open deep dive, if any: the scene it belongs to and the step on screen. */
export const useDive = create<{ scene: string | null; step: number }>(() => ({ scene: null, step: 0 }));

/** Open a scene's dive at a step (0 = its overview). */
export const openDive = (scene: string, step = 0) => useDive.setState({ scene, step });
export const closeDive = () => useDive.setState({ scene: null });

/** The context lab's switches: which of the ten blocks are in the window. */
export const useLab = create<{ on: boolean[] }>(() => ({ on: Array.from({ length: 10 }, () => true) }));
export const toggleLab = (k: number) => useLab.setState(({ on }) => ({ on: on.map((v, i) => (i === k ? !v : v)) }));
export const resetLab = () => useLab.setState({ on: Array.from({ length: 10 }, () => true) });

/** Where the viewport centre sits among the scenes: 0 = first scene centred, 1 = the next, … */
export const progress = { s: 0 };

/** Raised from 0 to 1 by the intro, as the camera rises out of the valley at dawn. */
export const intro = { rise: 0 };

/**
 * True while a reading page (the CV, How it works) covers the valley. The valley stays built
 * underneath, so Back is instant, but it stops drawing and stops reading the scroll.
 */
export const valley = { hidden: false };

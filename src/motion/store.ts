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

/** Where the viewport centre sits among the scenes: 0 = first scene centred, 1 = the next, … */
export const progress = { s: 0 };

/** Raised from 0 to 1 by the intro, as the camera rises out of the valley at dawn. */
export const intro = { rise: 0 };

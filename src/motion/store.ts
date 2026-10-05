import { create } from 'zustand';
import { WORLD_LOOKS } from '@/world/palette.ts';

/** What the UI needs from the world: the hour, whether the sky is dark, the nearest scene. */
export const useDay = create<{ label: string; clock: string; dark: boolean; scene: number }>(() => ({
  label: WORLD_LOOKS.dawn.label,
  clock: WORLD_LOOKS.dawn.clock,
  dark: false,
  scene: 0,
}));

/** Which details panel is open, by scene id. */
export const usePanel = create<{ open: string | null }>(() => ({ open: null }));

/** Where the viewport centre sits among the scenes: 0 = first scene centred, 1 = the next, … */
export const progress = { s: 0 };

/** Raised from 0 to 1 by the intro, as the camera rises out of the valley at dawn. */
export const intro = { rise: 0 };

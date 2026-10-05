import { create } from 'zustand';
import { LOOKS, type Look } from './pageLight.ts';

/** What the rest of the UI needs to know about the light: the hour, and whether it is dark. */
export const useDay = create<{ look: Look; dark: boolean }>(() => ({ look: LOOKS.dawn, dark: false }));

/** Raised from 0 to 1 by the hero intro as the sun comes up over the first screen. */
export const intro = { rise: 0 };

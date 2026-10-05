import type { Object3D } from 'three';

/** The live world as far as the page needs it: where a point of a layer is on screen, in CSS pixels. */
export const worldView: {
  project: ((group: Object3D, x: number, y: number) => { x: number; y: number } | null) | null;
} = { project: null };

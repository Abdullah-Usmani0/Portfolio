import type { Object3D } from 'three';

/** The live world as far as the page needs it: where a point of a layer is on screen, in CSS pixels. */
export const worldView: {
  project: ((group: Object3D, x: number, y: number) => { x: number; y: number } | null) | null;
  /** Labels the world shows and hides in time with its animation, by label id (0–1; absent means shown). */
  labels: Record<string, number>;
} = { project: null, labels: {} };

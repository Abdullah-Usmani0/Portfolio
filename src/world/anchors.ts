import type { Object3D } from 'three';
import type { AnchorScene } from './anchorIds.ts';

/** A place in a layer the camera can dive to: its centre and size, in the layer's units. */
export interface Anchor {
  x: number;
  y: number;
  w: number;
  h: number;
}

const registry = new Map<string, { group: Object3D; anchors: Readonly<Record<string, Anchor>> }>();

/** Set pieces register where their parts are, computed from the same numbers as their geometry. */
export function registerAnchors(scene: AnchorScene, group: Object3D, anchors: Readonly<Record<string, Anchor>>): void {
  const prev = registry.get(scene);
  registry.set(scene, { group, anchors: prev?.group === group ? { ...prev.anchors, ...anchors } : anchors });
}

/** An anchor and the layer group it lives in, or null when the world has not drawn it. */
export function anchorOf(scene: string, id: string): (Anchor & { group: Object3D }) | null {
  const entry = registry.get(scene);
  const a = entry?.anchors[id];
  return entry && a ? { ...a, group: entry.group } : null;
}

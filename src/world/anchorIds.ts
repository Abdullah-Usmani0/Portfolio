/**
 * The places a dive can fly to, per scene. The set pieces register these ids and the dive
 * content points at them, so the list lives here, free of three.js, where both can import it
 * and a test can hold them to each other.
 */
export const ANCHOR_IDS = {
  npcs: ['village'],
  councils: ['town', 'research', 'design', 'implementation', 'audit', 'training', 'media'],
  scenarios: ['farm'],
  learners: ['bridge'],
  voice: ['stage'],
  mind: ['bust'],
} as const;

export type AnchorScene = keyof typeof ANCHOR_IDS;
export type AnchorId<S extends AnchorScene> = (typeof ANCHOR_IDS)[S][number];

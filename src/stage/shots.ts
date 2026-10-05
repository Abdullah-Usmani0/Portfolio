import type { Key, Shot, Vec3 } from './director.ts';
import type { CameraMeta, ValleyMeta } from './assets.ts';

/** The six beats of the M0 slice — one day over the valley, dawn to night, then into a mind. */
export const M0_ACTS = ['dawn', 'morning', 'golden', 'dusk', 'night', 'mind'] as const;
export type M0Act = (typeof M0_ACTS)[number];

const fromCamera = (c: CameraMeta): Shot => ({
  position: c.position,
  target: c.target,
  lensMm: c.lensMm,
  shiftX: c.shiftX,
  shiftY: c.shiftY,
});

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Keys for the slice. The first two are the exact Blender cameras, so the browser can be
 * A/B'd against the Cycles style frames; the rest are framed for the scroll.
 */
export function m0Keys(meta: ValleyMeta, bust: Vec3): Key[] {
  const establish = fromCamera(meta.camera.establish);
  const hero = fromCamera(meta.camera.hero);
  const summit = meta.landmarks.k2Summit;
  return [
    { at: 0, hold: 0.05, shot: establish, tod: 0 },
    { at: 0.2, hold: 0.05, shot: hero, tod: 0.3 },
    {
      at: 0.4,
      hold: 0.05,
      tod: 0.55,
      arc: 18,
      shot: { position: [-34, 78, 214], target: add(meta.landmarks.village, [-40, 0, -70]), lensMm: 24, shiftX: 0, shiftY: 0.04 },
    },
    {
      at: 0.6,
      hold: 0.05,
      tod: 0.8,
      arc: 10,
      // K2 sits right of centre so the panel can live on the left without covering it.
      shot: { position: establish.position, target: add(summit, [0, -330, 0]), lensMm: 58, shiftX: -0.13, shiftY: 0 },
    },
    {
      at: 0.8,
      hold: 0.05,
      tod: 1,
      arc: 6,
      shot: { position: [-92, 56, 252], target: [0, 8, 20], lensMm: 24, shiftX: 0, shiftY: 0.05 },
    },
    {
      // Down into the meadow, face to face with the firefly bust.
      at: 1,
      hold: 0.06,
      tod: 1,
      arc: 4,
      shot: { position: add(bust, [-7, 9, 31]), target: add(bust, [0, 7.6, 0]), lensMm: 32, shiftX: -0.15, shiftY: 0 },
    },
  ];
}

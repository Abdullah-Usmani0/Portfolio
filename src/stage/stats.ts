/** Live renderer numbers, written by the stage each frame and read by tests and the ?debug HUD. */
export const stats = {
  frames: 0,
  calls: 0,
  triangles: 0,
  cam: [0, 0, 0] as [number, number, number],
};

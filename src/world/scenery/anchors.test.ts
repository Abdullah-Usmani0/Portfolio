// @vitest-environment jsdom
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { anchorOf } from '../anchors.ts';
import { ANCHOR_IDS } from '../anchorIds.ts';
import { provingGrounds } from './proving.ts';
import { village } from './village.ts';

// A dive flies to and labels anchors by id; a set piece that forgets to register one fails
// silently (the label never shows), so each set piece is built here and asked for all of them.
describe('set pieces register every anchor their dive uses', () => {
  beforeAll(() => {
    // jsdom draws nothing; the painted textures just stay blank.
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('the proving grounds', () => {
    provingGrounds(new THREE.Group());
    for (const id of ANCHOR_IDS.learners) expect(anchorOf('learners', id), id).not.toBeNull();
  });

  it('the village', () => {
    village(new THREE.Group());
    for (const id of ANCHOR_IDS.npcs) expect(anchorOf('npcs', id), id).not.toBeNull();
  });
});

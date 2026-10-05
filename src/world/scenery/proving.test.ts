// @vitest-environment jsdom
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { anchorOf } from '../anchors.ts';
import { ANCHOR_IDS } from '../anchorIds.ts';
import { provingGrounds } from './proving.ts';

describe('the proving grounds', () => {
  it('register every anchor the Learners dive may fly to or label', () => {
    // jsdom draws nothing; the painted textures just stay blank.
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
    provingGrounds(new THREE.Group());
    for (const id of ANCHOR_IDS.learners) expect(anchorOf('learners', id), id).not.toBeNull();
  });
});

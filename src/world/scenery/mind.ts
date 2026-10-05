import * as THREE from 'three';
import { smootherstep } from '@/motion/color.ts';
import { loadBinary } from '@/lib/loadBinary.ts';
import bustUrl from '@/assets/bust_m0.bin?url';
import { createRng } from '@/sim/rng.ts';
import { buildBustTargets, CONTEXT_LAYERS, LAYER_COLORS, parseBustMesh, stackTargets } from '@/sim/particles/bust.ts';
import { shared } from '../gl/flat.ts';
import { pointScale } from '../gl/sprites.ts';
import { sceneX } from '../journey.ts';
import { pointer } from '../pointer.ts';
import type { Frame, Layer } from './types.ts';

const P = 0.62;
/** Bust height in world units, and where its base floats over the night meadow. */
const SCALE = 270;
const BASE_Y = -150;
const MIND_SCENE = 6;

const vertexShader = /* glsl */ `
  attribute vec3 aStack;
  attribute vec3 aSwarm;
  attribute float aLayer;
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uGather;
  uniform float uMorph;
  uniform float uScale;
  uniform float uSize;
  uniform vec3 uLayerColors[${CONTEXT_LAYERS.length}];
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = aRand.x;
    // Gather: each firefly rises on its own schedule, so the head assembles like a breeze.
    float g = smoothstep(d * 0.55, d * 0.55 + 0.45, uGather);
    // Pour: the head drains from the crown down, filling the blocks from the top.
    float md = (1.0 - clamp(position.y, 0.0, 1.0)) * 0.6 + d * 0.15;
    float m = smoothstep(md, md + 0.25, uMorph);
    vec3 p = mix(aSwarm, mix(position, aStack, m), g);

    float t = uTime * 0.55 + aRand.z * 6.2831;
    vec3 drift = vec3(sin(t + p.y * 4.1), sin(t * 1.3 + p.z * 3.7), cos(t * 0.9 + p.x * 3.3));
    p += drift * (0.004 + 0.06 * (1.0 - g * 0.92));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.6 + aRand.y * 1.3) * uSize * uScale;

    vec3 fire = mix(vec3(0.78, 1.0, 0.24), vec3(1.0, 0.74, 0.3), aRand.w * aRand.w);
    vColor = mix(fire, uLayerColors[int(aLayer)] * 1.25, m);
    float tw = 0.6 + 0.4 * sin(uTime * (2.0 + aRand.w * 3.0) + aRand.z * 40.0);
    vAlpha = tw * mix(0.55, 1.0, g);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  uniform float uOn;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor * uIntensity * a * a * vAlpha * uOn, 1.0);
  }
`;

/**
 * Inside a mind, at night: fireflies over the meadow gather into a head and shoulders as
 * the camera arrives, then pour, crown first, into ten stacked blocks of context (identity
 * on top, voice at the bottom, the cache line between them) and back. The head turns a
 * little towards the cursor. Points are sampled on the device from a small CC0 bust.
 */
export function mind(maxPoints: number): Layer {
  const group = new THREE.Group();
  group.position.z = 0;
  const holder = new THREE.Group();
  holder.position.set(sceneX('mind') * P + 330, BASE_Y, 0);
  holder.scale.setScalar(SCALE);
  group.add(holder);

  const uniforms = {
    uTime: shared.uTime,
    uGather: { value: 0 },
    uMorph: { value: 0 },
    uScale: pointScale,
    uSize: { value: 3.2 },
    uIntensity: { value: 1.6 },
    uOn: { value: 0 },
    uLayerColors: { value: LAYER_COLORS.map((c) => new THREE.Color(c)) },
  };
  let points: THREE.Points | null = null;
  let arrivedAt = -1;
  let morph = 0;

  void loadBinary(bustUrl)
    .then((buf) => {
      const t = buildBustTargets(parseBustMesh(buf), maxPoints, createRng('firefly-bust'));
      const g = new THREE.BufferGeometry();
      // The bust is about 1 tall from its base; the stack and the swarm are laid out to match.
      const stack = stackTargets(t.layer, t.rand, 1.05);
      for (let i = 0; i < t.count; i++) {
        stack[i * 3] = stack[i * 3]! * 1.5 + 0.9;
        stack[i * 3 + 1] = stack[i * 3 + 1]! * 1.0 - 0.02;
      }
      const swarm = t.swarm;
      for (let i = 0; i < t.count; i++) {
        swarm[i * 3] = swarm[i * 3]! * 1.5;
        swarm[i * 3 + 2] = 0;
      }
      g.setAttribute('position', new THREE.BufferAttribute(t.bust, 3));
      g.setAttribute('aStack', new THREE.BufferAttribute(stack, 3));
      g.setAttribute('aSwarm', new THREE.BufferAttribute(swarm, 3));
      g.setAttribute('aLayer', new THREE.BufferAttribute(t.layer, 1));
      g.setAttribute('aRand', new THREE.BufferAttribute(t.rand, 4));
      points = new THREE.Points(
        g,
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      points.frustumCulled = false;
      points.renderOrder = 10;
      holder.add(points);
    })
    .catch((err: unknown) => console.error('[mind] bust failed to load', err));

  return {
    group,
    p: P,
    py: P,
    update: (f: Frame) => {
      // Fireflies only show after dark, and only gather while the mind's scene is near.
      uniforms.uOn.value = f.look.stars;
      const near = 1 - Math.min(1, Math.abs(f.s - MIND_SCENE) / 0.8);
      uniforms.uGather.value = smootherstep(near * 1.4 - 0.2);
      const settled = near > 0.85;
      if (settled && arrivedAt < 0) arrivedAt = f.time;
      if (!settled) arrivedAt = -1;
      // Attract loop: admire the head, pour into the blocks, hold, gather again.
      const rest = arrivedAt < 0 ? -1 : f.time - arrivedAt;
      const want = rest > 4 && ((rest - 4) % 13) < 6.5 ? 1 : 0;
      morph += (want - morph) * (1 - Math.exp(-0.9 * f.dt));
      uniforms.uMorph.value = morph;
      // A glance towards the cursor, never more than a few degrees.
      const yaw = 0.42 + (pointer.active ? pointer.x * 0.16 : Math.sin(f.time * 0.25) * 0.06);
      holder.rotation.y += (yaw * (1 - morph) - holder.rotation.y) * (1 - Math.exp(-3 * f.dt));
      holder.rotation.x = (pointer.active ? -pointer.y * 0.05 : 0) * (1 - morph);
      if (points) points.visible = uniforms.uOn.value > 0.01;
    },
  };
}

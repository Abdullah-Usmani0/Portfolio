import * as THREE from 'three';
import { shared } from './flat.ts';

/** World units → device pixels, for point sizes; set on resize. */
export const pointScale = { value: 1 };

/**
 * Chimney smoke: each particle loops from its chimney up and downwind, growing and
 * fading. Positions are computed on the GPU from time, so the CPU does nothing per frame.
 */
export function smoke(origins: readonly [number, number][], perChimney = 26) {
  const n = origins.length * perChimney;
  const origin = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  origins.forEach(([x, y], c) => {
    for (let i = 0; i < perChimney; i++) {
      const k = c * perChimney + i;
      origin.set([x, y, 0], k * 3);
      seed[k] = i / perChimney + Math.random() * 0.02;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(origin, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0.5 }, uTime: shared.uTime, uScale: pointScale };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vLife;
      void main() {
        float t = fract(uTime * 0.07 + aSeed);
        vLife = t;
        vec3 p = position;
        p.y += t * 95.0;
        p.x += t * t * 60.0 + sin(t * 7.0 + aSeed * 40.0) * 4.0 * t;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (4.0 + t * 26.0) * uScale;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * smoothstep(0.0, 0.12, vLife) * (1.0 - vLife) * uAlpha;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  return { points, uniforms };
}

/**
 * Small people, drawn in the shader: a head, a body and swinging legs. One instance per
 * person; the CPU moves them, the GPU draws them.
 */
export function peopleMaterial() {
  const uniforms = { uShade: { value: new THREE.Color() }, uMix: { value: 0.55 }, uTime: shared.uTime };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aWalk;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vWalk;
      void main() {
        vUv = uv;
        vColor = aColor;
        vWalk = aWalk;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uShade;
      uniform float uMix;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vWalk;
      float seg(vec2 p, vec2 a, vec2 b, float r) {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h) - r;
      }
      void main() {
        vec2 p = vUv;
        float swing = sin(vWalk) * 0.12;
        float head = length(p - vec2(0.5, 0.84)) - 0.13;
        float body = seg(p, vec2(0.5, 0.6), vec2(0.5, 0.36), 0.13);
        float legs = min(seg(p, vec2(0.46, 0.34), vec2(0.46 + swing, 0.04), 0.055), seg(p, vec2(0.54, 0.34), vec2(0.54 - swing, 0.04), 0.055));
        float d = min(head, min(body, legs));
        float a = smoothstep(0.02, -0.02, d);
        vec3 col = mix(uShade, vColor, uMix);
        col = mix(col, mix(uShade, vec3(0.96, 0.86, 0.76), 0.5), step(head, 0.0) * step(0.0, -head));
        gl_FragColor = vec4(col, a);
      }`,
  });
  return { material, uniforms };
}

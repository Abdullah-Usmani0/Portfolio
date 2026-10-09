import * as THREE from 'three';
import type { Relight } from '../scenery/relight.ts';

/**
 * A mountain layer rendered in Blender (blender/k2_render.py), relit for the hour. Its light
 * texture holds the layer lit three ways, stacked top to bottom, as the square roots of
 * linear light (more steps in the shade): by a low sun from the left, from the right, and by
 * the open sky. Its mask stacks coverage, how far through the layer each point is, and bare
 * rock. Light is premultiplied by coverage, so the edges blend clean. `rows` is one image's
 * height and `pad` the gap between them, in pixels.
 */
export function renderedMaterial(light: THREE.Texture, mask: THREE.Texture, o: { scale: number; nearKm: number; farKm: number; horizonY: number; degY: number; rows: number; pad: number }) {
  const total = 3 * o.rows + 2 * o.pad;
  const uniforms = {
    uLight: { value: light },
    uMask: { value: mask },
    uScale: { value: o.scale },
    uKm: { value: new THREE.Vector2(o.nearKm, o.farKm) },
    uHorizonY: { value: o.horizonY },
    uDegY: { value: o.degY },
    uSun: { value: new THREE.Vector3() },
    uSky: { value: new THREE.Vector3() },
    uSide: { value: new THREE.Vector2(0.5, 0.5) },
    uHaze: { value: new THREE.Vector3() },
    uHazeKm: { value: 30 },
    uGlowDeg: { value: -30 },
    uRock: { value: new THREE.Vector3(1.08, 0.97, 0.86) },
    uOpacity: { value: 0 },
    // One image's share of the stacked texture's height, and the step from one to the next.
    uSlot: { value: o.rows / total },
    uStride: { value: (o.rows + o.pad) / total },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uHorizonY;
      uniform float uDegY;
      varying vec2 vUv;
      varying float vDeg;
      void main() {
        vUv = uv;
        vDeg = (position.y - uHorizonY) / uDegY;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLight;
      uniform sampler2D uMask;
      uniform float uScale;
      uniform vec2 uKm;
      uniform vec3 uSun;
      uniform vec3 uSky;
      uniform vec2 uSide;
      uniform vec3 uHaze;
      uniform float uHazeKm;
      uniform float uGlowDeg;
      uniform vec3 uRock;
      uniform float uOpacity;
      uniform float uSlot;
      uniform float uStride;
      varying vec2 vUv;
      varying float vDeg;
      // The k-th image of a stack (0 the top), at this point.
      float slot(sampler2D tex, float k) {
        return texture2D(tex, vec2(vUv.x, 1.0 - k * uStride - (1.0 - vUv.y) * uSlot)).r;
      }
      vec3 srgb(vec3 c) {
        c = max(c, 0.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        vec3 m = vec3(slot(uMask, 0.0), slot(uMask, 1.0), slot(uMask, 2.0));
        float a = m.r * uOpacity;
        if (a < 0.003) discard;
        vec3 t = vec3(slot(uLight, 0.0), slot(uLight, 1.0), slot(uLight, 2.0));
        t = t * t * uScale;
        // As the sun sets, its light leaves the valleys first and lingers on the peaks.
        float lit = smoothstep(uGlowDeg - 2.5, uGlowDeg + 2.5, vDeg);
        vec3 c = uSun * (uSide.x * t.r + uSide.y * t.g) * lit + uSky * t.b;
        c *= mix(vec3(1.0), uRock, m.b);
        // Air: the farther the rock, the more of the haze's colour it takes.
        float km = mix(uKm.x, uKm.y, m.g);
        float h = 1.0 - exp(-km / uHazeKm);
        vec3 u = mix(c / max(m.r, 0.004), uHaze, h);
        u = srgb(u);
        // A gentle grade: a touch more contrast through the middle tones.
        u = mix(u, u * u * (3.0 - 2.0 * u), 0.35);
        // A little dither, so soft shading never bands.
        u += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(u * a, a);
      }`,
  });
  return {
    material,
    uniforms,
    /** Light the layer for the hour. */
    set(r: Relight) {
      uniforms.uSun.value.set(...r.sun);
      uniforms.uSky.value.set(...r.sky);
      uniforms.uSide.value.set(r.left, r.right);
      uniforms.uHaze.value.set(...r.haze);
      uniforms.uHazeKm.value = r.hazeKm;
      uniforms.uGlowDeg.value = r.glowDeg;
    },
  };
}

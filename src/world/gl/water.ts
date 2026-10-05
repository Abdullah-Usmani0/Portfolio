import * as THREE from 'three';
import { shared } from './flat.ts';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }`;

/** A band of water between two edges; uv.x is world x, uv.y runs 0 (far bank) to 1 (near bank). */
export function bandGeometry(xs: ArrayLike<number>, top: ArrayLike<number>, bottom: ArrayLike<number>): THREE.BufferGeometry {
  const n = xs.length;
  const pos = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    pos.set([xs[i]!, top[i]!, 0, xs[i]!, bottom[i]!, 0], i * 6);
    uv.set([xs[i]!, 0, xs[i]!, 1], i * 4);
    if (i < n - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** River water: sky reflected in it, long glints drifting downstream, pale banks. */
export function riverMaterial() {
  const uniforms = {
    uWater: { value: new THREE.Color() },
    uSkyTop: { value: new THREE.Color() },
    uSkyHorizon: { value: new THREE.Color() },
    uBank: { value: new THREE.Color() },
    uFlow: { value: 1 },
    uTime: shared.uTime,
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uWater;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyHorizon;
      uniform vec3 uBank;
      uniform float uFlow;
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float v = vUv.y;
        vec3 refl = mix(uSkyHorizon, uSkyTop, 0.15 + v * 0.55);
        vec3 col = mix(uWater, refl, 0.5);
        float drift = uTime * 0.85 * uFlow;
        float n = vnoise(vec2(vUv.x * 0.02 - drift, v * 9.0));
        float n2 = vnoise(vec2(vUv.x * 0.055 - drift * 1.7, v * 21.0 + 3.0));
        float glint = smoothstep(0.66, 0.92, n * 0.65 + n2 * 0.45);
        col = mix(col, mix(refl, vec3(1.0), 0.55), glint * 0.6);
        float far = smoothstep(0.16, 0.0, v);
        float near = smoothstep(0.86, 1.0, v);
        col = mix(col, uBank, far * 0.55 + near * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return { material, uniforms };
}

/** Falling water: bright streaks racing down, foam where it lands. uv.x across, uv.y top → bottom. */
export function waterfallMaterial() {
  const uniforms = {
    uWater: { value: new THREE.Color() },
    uLight: { value: new THREE.Color() },
    uTime: shared.uTime,
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uWater;
      uniform vec3 uLight;
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float fall = uTime * 1.9;
        float n = vnoise(vec2(vUv.x * 14.0, vUv.y * 5.0 - fall));
        float n2 = vnoise(vec2(vUv.x * 31.0 + 7.0, vUv.y * 9.0 - fall * 1.4));
        float streak = smoothstep(0.35, 0.95, n * 0.6 + n2 * 0.5);
        vec3 col = mix(uWater, uLight, 0.35 + streak * 0.65);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float foam = smoothstep(0.82, 1.0, vUv.y);
        col = mix(col, uLight, foam * 0.8);
        float alpha = mix(0.55, 0.96, streak) * edge;
        alpha = max(alpha, foam * edge);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  return { material, uniforms };
}

/** Soft drifting haze: a horizontal band that thins at its edges and wanders with noise. */
export function mistMaterial(range: [number, number] = [-1e6, 1e6]) {
  const uniforms = {
    uColor: { value: new THREE.Color() },
    uAmount: { value: 0.5 },
    uRange: { value: new THREE.Vector2(...range) },
    uTime: shared.uTime,
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAmount;
      uniform vec2 uRange;
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float u = (vUv.x - uRange.x) / (uRange.y - uRange.x);
        float ends = smoothstep(0.0, 0.3, u) * smoothstep(1.0, 0.7, u);
        float body = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * ends;
        float n = vnoise(vec2(vUv.x * 0.0035 + uTime * 0.012, vUv.y * 2.0));
        float n2 = vnoise(vec2(vUv.x * 0.011 - uTime * 0.02, vUv.y * 3.0 + 5.0));
        float a = body * (0.45 + 0.55 * (n * 0.7 + n2 * 0.3)) * uAmount;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  return { material, uniforms };
}

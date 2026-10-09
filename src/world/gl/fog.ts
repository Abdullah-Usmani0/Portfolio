import * as THREE from 'three';
import { shared } from './flat.ts';

/**
 * A bank of fog lying in the valleys at a mountain layer's foot: billows that drift and roll
 * slowly, lit on their tops and grey underneath, thinning to nothing upward, so the peaks
 * stand out of it. The quad spans `x0`–`x1`; the fog fills it from `y0` to around `y1`.
 */
export function fogBank(o: { x0: number; x1: number; y0: number; y1: number; seed: number; drift: number }) {
  const uniforms = {
    uLit: { value: new THREE.Color() },
    uShade: { value: new THREE.Color() },
    uAmount: { value: 0 },
    uTime: shared.uTime,
    uY: { value: new THREE.Vector2(o.y0, o.y1) },
    uX: { value: new THREE.Vector2(o.x0, o.x1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform float uAmount;
      uniform float uTime;
      uniform vec2 uY;
      uniform vec2 uX;
      varying vec2 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          s += vnoise(p) * a;
          p = p * 2.03 + 17.1;
          a *= 0.5;
        }
        return s / 0.96875;
      }
      void main() {
        float h = uY.y - uY.x;
        // Height through the bank: 0 at its base, 1 at its usual top.
        float y = (vP.y - uY.x) / h;
        // Billows, stretched along the valley, folded into each other, drifting and rolling.
        vec2 q = vec2(vP.x / (h * 2.6), y * 1.6) + vec2(${o.seed.toFixed(1)}, 0.0);
        float t = uTime * ${o.drift.toFixed(4)};
        vec2 w = vec2(fbm(q * 0.9 + vec2(t, 0.0)), fbm(q * 0.9 + vec2(5.2 - t * 0.6, 1.3)));
        float n = fbm(q + w * 1.6 + vec2(t * 1.4, 0.0));
        // Thick below, thinning upward to a ragged top where the billows break.
        float top = 0.55 + 0.75 * n;
        float body = smoothstep(top, top - 0.55, y) * smoothstep(-0.15, 0.25, y);
        float u = (vP.x - uX.x) / (uX.y - uX.x);
        float ends = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.96, u);
        float a = body * ends * smoothstep(0.25, 0.75, n + 0.35 * (1.0 - y)) * uAmount;
        if (a < 0.004) discard;
        // Lit on the tops of the billows, grey in their folds.
        vec3 col = mix(uShade, uLit, smoothstep(0.2, 0.95, y * 0.6 + n * 0.7));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const geo = new THREE.PlaneGeometry(o.x1 - o.x0, o.y1 + (o.y1 - o.y0) * 0.6 - o.y0);
  geo.translate((o.x0 + o.x1) / 2, (o.y0 + o.y1 + (o.y1 - o.y0) * 0.6) / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

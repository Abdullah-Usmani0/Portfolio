import * as THREE from 'three';
import { shared } from './flat.ts';

/**
 * The sky: a screen-filling gradient from the zenith down to a warm horizon, with the sun
 * or moon (disc and halo) and, at night, stars that twinkle. A touch of dither keeps the
 * long gradient free of banding.
 */
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSun: { value: new THREE.Color() },
    uSunPos: { value: new THREE.Vector2() },
    uStars: { value: 0 },
    uAspect: { value: 1 },
    uTime: shared.uTime,
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSun;
      uniform vec2 uSunPos;
      uniform float uStars;
      uniform float uAspect;
      uniform float uTime;
      varying vec2 vUv;

      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        // Horizon sits low; the gradient bends towards it like real air.
        float h = clamp((vUv.y - 0.22) / 0.78, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.72));

        // Sun or moon: a soft halo, a wider bloom of warm air and a crisp disc.
        vec2 d = vec2((vUv.x - 0.5) * uAspect, vUv.y) - vec2(uSunPos.x * 0.5 * uAspect, uSunPos.y);
        float r = length(d);
        col += uSun * (0.32 * exp(-r * 5.5) + 0.12 * exp(-r * 1.6));
        col = mix(col, uSun, smoothstep(0.034, 0.03, r));

        // Stars, only where the sky is dark: two sizes, each twinkling at its own pace.
        float stars = 0.0;
        for (int k = 0; k < 2; k++) {
          float scale = k == 0 ? 160.0 : 340.0;
          vec2 g = vUv * vec2(uAspect, 1.0) * scale;
          vec2 cell = floor(g);
          float s = hash(cell + float(k) * 17.0);
          vec2 pos = vec2(hash(cell + 3.1), hash(cell + 7.7));
          float dist = length(fract(g) - pos);
          float size = k == 0 ? 0.11 : 0.16;
          float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + s * 2.5) + s * 50.0);
          stars += step(k == 0 ? 0.985 : 0.97, s) * smoothstep(size, 0.0, dist) * twinkle;
        }
        col += vec3(stars) * uStars * smoothstep(0.3, 0.65, vUv.y);

        // Dither.
        col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, uniforms };
}

import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { shared } from '../gl/flat.ts';
import { pointScale } from '../gl/sprites.ts';
import type { Frame, Layer } from './types.ts';
import { snowfall } from './weather.ts';

const NOISE = /* glsl */ `
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
    for (int i = 0; i < 4; i++) {
      s += vnoise(p) * a;
      p = p * 2.07 + 11.3;
      a *= 0.5;
    }
    return s / 0.9375;
  }`;

/**
 * Spindrift: the plume of snow the jet stream tears off K2's summit, streaming downwind in
 * torn wisps. Drawn in the shader on one quad, hung on the summit of K2's own layer.
 */
export function spindrift(group: THREE.Object3D, summit: { x: number; y: number }, still: () => boolean) {
  const LEN = 300;
  const uniforms = {
    uLit: { value: new THREE.Color() },
    uShade: { value: new THREE.Color() },
    uAmount: { value: 0 },
    uTime: { value: 0 },
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
      varying vec2 vP;
      ${NOISE}
      void main() {
        // Along the wind (0 at the summit, 1 where the plume has thinned away) and across it.
        float x = vP.x;
        float spread = mix(0.045, 0.24, pow(x, 0.75));
        // The plume rises off the crest a little, then sags as it thins.
        float y = vP.y - (0.05 * x - 0.11 * x * x);
        float body = exp(-(y * y) / (spread * spread));
        // Gusts: wisps tear off and race downwind; the root stays bright.
        vec2 q = vec2(x * 3.4 - uTime * 0.42, y * 15.0 + x * 1.5);
        float wisps = smoothstep(0.28, 0.8, fbm(q) + 0.28 * (1.0 - x));
        float a = body * wisps * smoothstep(0.0, 0.05, x) * pow(1.0 - x, 1.6) * uAmount;
        if (a < 0.003) discard;
        // Lit along its upper edge, in its own shadow below.
        vec3 col = mix(uShade, uLit, smoothstep(-0.6, 0.6, y / spread));
        gl_FragColor = vec4(col, a);
      }`,
  });
  // The quad's own units run 0–1 along the wind; scaled out to the plume's length.
  const geo = new THREE.PlaneGeometry(1, 0.8);
  geo.translate(0.5, 0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.set(LEN, LEN, 1);
  mesh.position.set(summit.x - 4, summit.y - 2, 0.5);
  mesh.frustumCulled = false;
  group.add(mesh);

  return (f: Frame) => {
    const { look } = f;
    const lit = mixHex(look.snow, look.sun, 0.3);
    uniforms.uLit.value.set(lit);
    uniforms.uShade.value.set(mixHex(mixHex(look.snow, look.skyTop, 0.45), look.haze, 0.3));
    // Brightest against a day sky; faint by moonlight, when there is little to light it.
    uniforms.uAmount.value = 0.95 - 0.5 * look.stars;
    if (!still()) uniforms.uTime.value = f.time;
  };
}

/**
 * Snow on the night climb: flakes at many depths, the near ones bigger and faster, each
 * sliding past at its own parallax as the camera moves. Every flake is placed on the GPU
 * from time and the camera, wrapped round the view, so the CPU does nothing per flake.
 */
export function snow(count: number, still: () => boolean): Layer {
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds.set([Math.random(), Math.random(), Math.random()], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  const uniforms = {
    uView: { value: new THREE.Vector2(1, 1) },
    uCam: { value: new THREE.Vector2() },
    uTime: shared.uTime,
    uScale: pointScale,
    uAmount: { value: 0 },
    uColor: { value: new THREE.Color() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform vec2 uView;
      uniform vec2 uCam;
      uniform float uTime;
      uniform float uScale;
      uniform float uAmount;
      varying float vAlpha;
      varying float vNear;
      void main() {
        float d = position.z;                       // 0 far … 1 near
        float p = mix(0.3, 1.1, d);                 // how fast it slides past
        float fall = mix(16.0, 64.0, d);
        float wind = mix(5.0, 26.0, d);
        vec2 box = uView * vec2(1.08, 1.12);
        float flutter = sin(uTime * (0.6 + d) + position.x * 40.0) * 10.0 * d;
        vec2 w = position.xy * box + vec2(wind * uTime + flutter, -fall * uTime) - uCam * p;
        w = mod(w, box) - box * 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 0.0, 1.0);
        gl_PointSize = mix(1.6, 9.0, d * d * d) * uScale;
        vAlpha = uAmount * mix(0.3, 0.9, d);
        vNear = d;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      varying float vNear;
      void main() {
        // Near flakes fall fast enough to smear into short streaks.
        vec2 c = (gl_PointCoord - 0.5) * vec2(1.0 + vNear * 0.9, 1.0);
        float r = length(c);
        float a = smoothstep(0.5, 0.1, r) * vAlpha;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  return {
    group,
    // Pinned to the camera; each flake works out its own parallax in the shader.
    p: 0,
    py: 0,
    update: (f) => {
      const amount = still() ? 0 : snowfall(f.s) * (1 - 0.6 * (f.dive?.t ?? 0));
      points.visible = amount > 0.002;
      if (!points.visible) return;
      uniforms.uAmount.value = amount;
      uniforms.uView.value.set(f.viewW, f.viewH);
      // The flakes lean with the rest of the diorama, each by its own depth.
      uniforms.uCam.value.set(f.camX + f.tilt.x, f.camY + f.tilt.y);
      uniforms.uColor.value.set(mixHex(f.look.snow, '#ffffff', 0.35));
    },
  };
}

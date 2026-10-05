import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { shared } from '../gl/flat.ts';
import { pointScale } from '../gl/sprites.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { LAKE_X, riverBottom, riverTop } from './valley.ts';

/** The amphitheatre screen: a live voice waveform, bars rising as someone speaks. */
function screenMaterial() {
  const uniforms = { uBg: { value: new THREE.Color() }, uBar: { value: new THREE.Color() }, uTime: shared.uTime };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBg;
      uniform vec3 uBar;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float n = 28.0;
        float i = floor(vUv.x * n);
        float x = fract(vUv.x * n);
        // Speech comes in phrases: an envelope of words, each bar its own syllable.
        float phrase = smoothstep(0.0, 0.3, sin(uTime * 0.9) * 0.5 + 0.5);
        float h = 0.12 + phrase * (0.25 + 0.55 * abs(sin(uTime * 7.0 + i * 1.7) * sin(uTime * 3.1 + i * 0.6)));
        float bar = step(0.25, x) * step(x, 0.75) * step(abs(vUv.y - 0.5), h * 0.5);
        vec3 col = mix(uBg, uBar, bar);
        col += uBar * 0.12 * smoothstep(0.7, 0.0, abs(vUv.y - 0.5));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return { material, uniforms };
}

/**
 * Dusk at the lake, the realtime-voice scene: an amphitheatre on the far shore with a big
 * screen speaking, two boats racing to the first spoken sentence (the old pipeline at
 * 5.4 s, the streamed one at 2.1 s), and lanterns lighting one by one on the water.
 */
export function lake(group: THREE.Group) {
  const cx = LAKE_X;
  const shore = (x: number) => riverTop(x) + 1;

  // The amphitheatre: tiers of seating stepping up the far shore, the screen above them.
  const stone = new THREE.MeshBasicMaterial();
  const stoneShade = new THREE.MeshBasicMaterial();
  const ax = cx + 180;
  for (let k = 0; k < 5; k++) {
    const w = 300 - k * 48;
    const tier = new THREE.Mesh(new THREE.PlaneGeometry(w, 9), k % 2 ? stoneShade : stone);
    tier.position.set(ax, shore(ax) + 4.5 + k * 9, 0.44);
    group.add(tier);
  }
  const screen = screenMaterial();
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(172, 98), stoneShade);
  frame.position.set(ax, shore(ax) + 45 + 60, 0.44);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(160, 86), screen.material);
  display.position.set(ax, shore(ax) + 45 + 60, 0.45);
  const legs = [-60, 60].map((dx) => {
    const leg = new THREE.Mesh(new THREE.PlaneGeometry(6, 60), stoneShade);
    leg.position.set(ax + dx, shore(ax) + 45 + 3, 0.43);
    return leg;
  });
  group.add(frame, display, ...legs);

  // The race: two boats, a sail each; the lime one is the streamed pipeline.
  const hull = new THREE.MeshBasicMaterial();
  const boats = ['#e8e1d6', '#c6ff3d'].map((sailColor) => {
    const g = new THREE.Group();
    const h = new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-20, 4), new THREE.Vector2(20, 4), new THREE.Vector2(14, -4), new THREE.Vector2(-14, -4)])),
      hull,
    );
    const sailMat = new THREE.MeshBasicMaterial({ color: sailColor });
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-2, 6), new THREE.Vector2(-2, 40), new THREE.Vector2(16, 8)])), sailMat);
    g.add(h, sail);
    g.userData.sail = sailMat;
    group.add(g);
    return g;
  });

  // Lanterns on the water: they light one per sentence, then drift.
  const n = 18;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = cx - 520 + (i / n) * 1040 + Math.sin(i * 12.9) * 30;
    const y = riverBottom(x) + (riverTop(x) - riverBottom(x)) * (0.25 + 0.5 * ((i * 0.37) % 1));
    pos.set([x, y, 0], i * 3);
    seed[i] = i / n;
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const lanternUniforms = { uOn: { value: 0 }, uTime: shared.uTime, uScale: pointScale };
  const lanterns = new THREE.Points(
    lg,
    new THREE.ShaderMaterial({
      uniforms: lanternUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uOn;
        uniform float uScale;
        varying float vLit;
        void main() {
          // Lit in turn, a sentence at a time, then all of them as night falls.
          float wave = step(aSeed, fract(uTime * 0.06));
          vLit = clamp(max(wave, uOn) * uOn * 1.4, 0.0, 1.0);
          vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 30.0) * 6.0, sin(uTime * 1.1 + aSeed * 9.0) * 1.2, 0.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 26.0 * uScale;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLit;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.08, 0.0, d);
          float halo = smoothstep(0.5, 0.0, d) * 0.45;
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * (core + halo) * vLit, 1.0);
        }`,
    }),
  );
  lanterns.position.z = 0.64;
  lanterns.frustumCulled = false;
  group.add(lanterns);

  return (f: Frame) => {
    const { look } = f;
    const base = tone(look, 0.2, 0.1);
    stone.color.set(mixHex(base, '#e9dfcf', 0.55));
    stoneShade.color.set(mixHex(base, '#8f8478', 0.45));
    hull.color.set(mixHex(base, '#6b4a33', 0.6));
    screen.uniforms.uBg.value.set(mixHex(base, '#0f1320', 0.85));
    screen.uniforms.uBar.value.set(mixHex('#7fe8ff', '#c6ff3d', 0.35));
    lanternUniforms.uOn.value = Math.min(1, look.windows * 1.2);

    // The race restarts every ten seconds; each boat crosses in its own time.
    const t = f.time % 10;
    const lane = (k: number) => riverBottom(cx) + (riverTop(cx) - riverBottom(cx)) * (k ? 0.32 : 0.62);
    [5.4, 2.1].forEach((secs, k) => {
      const progress = Math.min(1, t / secs);
      const ease = 1 - (1 - progress) ** 2;
      const x = cx - 460 + ease * 820;
      const boat = boats[k]!;
      boat.position.set(x, lane(k) + Math.sin(f.time * 2 + k) * 1.2, 0.65 + k * 0.01);
      boat.rotation.z = Math.sin(f.time * 1.6 + k * 2) * 0.04;
    });
  };
}

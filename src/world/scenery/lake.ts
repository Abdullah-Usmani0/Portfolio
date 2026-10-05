import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { shared } from '../gl/flat.ts';
import { peopleMaterial, pointScale } from '../gl/sprites.ts';
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
 * Dusk at the lake, the realtime-voice scene: an open-air stage on the far shore with a big
 * screen speaking to an audience, two boats racing to the first spoken sentence (the old pipeline at
 * 5.4 s, the streamed one at 2.1 s), and lanterns lighting one by one on the water.
 */
export function lake(group: THREE.Group) {
  const cx = LAKE_X;
  const shore = (x: number) => riverTop(x) + 1;

  // The stage: a stepped stone plinth carrying the screen, and an audience on the shore
  // in front of it, watching it speak.
  const stone = new THREE.MeshBasicMaterial();
  const stoneShade = new THREE.MeshBasicMaterial();
  const ax = cx + 180;
  let top = shore(ax) - 2;
  [300, 236, 176].forEach((w, k) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, 11), stoneShade);
    face.position.set(ax, top + 5.5, 0.44 + k * 0.002);
    const tread = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.5), stone);
    tread.position.set(ax, top + 9.75, 0.441 + k * 0.002);
    group.add(face, tread);
    top += 11;
  });
  const screen = screenMaterial();
  const screenY = top + 14 + 49;
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(172, 98), stoneShade);
  frame.position.set(ax, screenY, 0.45);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(160, 86), screen.material);
  display.position.set(ax, screenY, 0.451);
  const legs = [-58, 58].map((dx) => {
    const leg = new THREE.Mesh(new THREE.PlaneGeometry(7, 16), stoneShade);
    leg.position.set(ax + dx, top + 7, 0.449);
    return leg;
  });
  group.add(frame, display, ...legs);

  const audience = 14;
  const seated = peopleMaterial();
  seated.uniforms.uMix.value = 0.5;
  const seatGeo = new THREE.PlaneGeometry(17, 38);
  seatGeo.translate(0, 19, 0);
  const seatColors = new Float32Array(audience * 3);
  const palette = ['#7fb2e8', '#f0a35e', '#b892e0', '#8cc77a', '#e8c95a', '#e88c7f'];
  for (let i = 0; i < audience; i++) {
    const c = new THREE.Color(palette[i % palette.length]);
    seatColors.set([c.r, c.g, c.b], i * 3);
  }
  seatGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(seatColors, 3));
  seatGeo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(new Float32Array(audience), 1));
  const crowd = new THREE.InstancedMesh(seatGeo, seated.material, audience);
  const seat = new THREE.Matrix4();
  for (let i = 0; i < audience; i++) {
    const x = ax - 156 + (i / (audience - 1)) * 312 + Math.sin(i * 7.3) * 6;
    seat.makeScale(1, 0.62 + 0.06 * Math.sin(i * 3.1), 1).setPosition(x, shore(x) - 2, 0);
    crowd.setMatrixAt(i, seat);
  }
  crowd.position.z = 0.46;
  crowd.frustumCulled = false;
  group.add(crowd);

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
    stone.color.set(mixHex(base, '#efe6d8', 0.62));
    stoneShade.color.set(mixHex(base, '#a39684', 0.5));
    hull.color.set(mixHex(base, '#6b4a33', 0.6));
    screen.uniforms.uBg.value.set(mixHex(base, '#0f1320', 0.85));
    seated.uniforms.uShade.value.set(tone(look, 0.1));
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

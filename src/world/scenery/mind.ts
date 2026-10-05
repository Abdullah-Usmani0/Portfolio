import * as THREE from 'three';
import { smootherstep } from '@/motion/color.ts';
import { useLab } from '@/motion/store.ts';
import { loadBinary } from '@/lib/loadBinary.ts';
import bustUrl from '@/assets/bust_m0.bin?url';
import { createRng } from '@/sim/rng.ts';
import { LAYER_COLORS, buildBustTargets, parseBustMesh } from '@/sim/particles/bust.ts';
import { BLOCKS, G, GROUP_COLORS, GROUP_COUNT, blocksByHeight, hash01, mainStack, type Box, type Formation } from '@/sim/particles/formations.ts';
import { shared } from '../gl/flat.ts';
import { pointScale } from '../gl/sprites.ts';
import { sceneIndex, sceneX } from '../journey.ts';
import { registerAnchors, type Anchor } from '../anchors.ts';
import { diveStage } from '../diveFraming.ts';
import { pointer } from '../pointer.ts';
import { worldView } from '../view.ts';
import { Look, MAX_SPARKS, SCRIPTS, anchorBoxes, attract, blockBoxes, buildFormation, cacheLineBox, prefixTailBoxes, stackOf, type Cue } from './mindScript.ts';
import type { Frame, Layer } from './types.ts';

const P = 0.62;
/** Bust height in world units, and where its base floats over the night meadow. */
const SCALE = 270;
const BASE_Y = -150;
const MIND_SCENE = sceneIndex('mind');
/** The widest formation, in bust units: below this much free view, the formations stack for a phone. */
const WIDEST = 3.5;

const vertexShader = /* glsl */ `
  attribute vec3 aTo;
  attribute vec2 aGroups;
  attribute float aDelay;
  attribute vec3 aSwarm;
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uGather;
  uniform float uBlend;
  uniform float uSpread;
  uniform float uArc;
  uniform float uScale;
  uniform float uSize;
  uniform vec4 uGroup[${GROUP_COUNT}];
  uniform vec3 uPalette[${GROUP_COUNT}];
  uniform vec2 uWave;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 tint(int g) {
    if (g == ${G.fire}) return mix(vec3(0.78, 1.0, 0.24), vec3(1.0, 0.74, 0.3), aRand.w * aRand.w);
    return uPalette[g] * 1.25;
  }

  void main() {
    int gf = int(aGroups.x + 0.5);
    int gt = int(aGroups.y + 0.5);
    // Each point leaves on its own schedule, so a formation pours instead of jumping.
    float lead = aDelay * uSpread;
    float w = smoothstep(lead, lead + 1.0 - uSpread, uBlend);
    vec3 p = mix(position, aTo, w);
    float sw = aRand.z * 6.2832;
    p += vec3(cos(sw), sin(sw), 0.0) * sin(w * 3.14159) * uArc * (0.4 + aRand.y);
    // Shown, glow, calm, alarm: each point takes its group's, blended as it travels.
    vec4 s = mix(uGroup[gf], uGroup[gt], w);
    // Gather: loose over the meadow until the camera arrives.
    float g = smoothstep(aRand.x * 0.55, aRand.x * 0.55 + 0.45, uGather);
    p = mix(aSwarm, p, g);
    float t = uTime * 0.55 + aRand.z * 6.2831;
    vec3 drift = vec3(sin(t + p.y * 4.1), sin(t * 1.3 + p.z * 3.7), cos(t * 0.9 + p.x * 3.3));
    p += drift * (0.004 * (1.0 - s.z) + 0.06 * (1.0 - g * 0.92));
    p.x += s.w * 0.012 * sin(uTime * 37.0 + aRand.z * 90.0);
    p.y += s.w * 0.008 * sin(uTime * 29.0 + aRand.w * 70.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.6 + aRand.y * 1.3) * uSize * uScale;

    vec3 c = mix(tint(gf), tint(gt), w);
    c = mix(c, vec3(0.9, 0.95, 1.0) * 1.15, s.z * 0.28);
    c = mix(c, vec3(1.0, 0.3, 0.26) * 1.35, s.w);
    float wave = uWave.y * exp(-pow((p.y - uWave.x) / 0.045, 2.0));
    vColor = c * (s.y + wave);
    float tw = 0.6 + 0.4 * sin(uTime * (2.0 + aRand.w * 3.0) + aRand.z * 40.0);
    vAlpha = mix(tw, 0.92, s.z) * mix(0.55, 1.0, g) * s.x;
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

const sparkVertex = /* glsl */ `
  attribute vec4 aColor;
  attribute float aSize;
  uniform float uScale;
  uniform float uSize;
  varying vec4 vColor;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uSize * uScale;
    vColor = aColor;
  }
`;

const sparkFragment = /* glsl */ `
  uniform float uOn;
  varying vec4 vColor;
  void main() {
    // A hot core in a soft halo.
    float r = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.2, 0.0, r);
    float halo = smoothstep(0.5, 0.05, r);
    float a = (core * 1.3 + halo * halo * 0.55) * vColor.a * uOn;
    gl_FragColor = vec4(vColor.rgb * a + vec3(core * core * 0.45 * vColor.a * uOn), 1.0);
  }
`;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Inside a mind, at night: fireflies over the meadow gather into a head and shoulders as
 * the camera arrives. With no dive open the head pours, crown first, into the ten blocks of
 * its context and back. In the context dive the same fireflies become each step's picture
 * (the stack, a scratchpad, a ribbon of turns, four kinds of memory, a library, a lead and
 * its sub-agents), with brighter sparks carrying things between the parts. Points are sampled
 * on the device from a small CC0 bust.
 */
export function mind(maxPoints: number): Layer {
  const group = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(sceneX('mind') * P + 330, BASE_Y, 0);
  holder.scale.setScalar(SCALE);
  group.add(holder);

  // Anchors, in the layer's units. The boxes come from the same layouts as the formations.
  const toLayer = (b: Box, a: Anchor = { x: 0, y: 0, w: 0, h: 0 }) => {
    a.x = holder.position.x + b.cx * SCALE;
    a.y = BASE_Y + b.cy * SCALE;
    a.w = b.w * SCALE;
    a.h = b.h * SCALE;
    return a;
  };
  const anchors: Record<string, Anchor> = {};
  const placeAnchors = (wide: boolean) => {
    for (const [id, box] of Object.entries(anchorBoxes(wide))) anchors[id] = toLayer(box, anchors[id]);
    const { prefix, tail } = prefixTailBoxes(mainStack(wide));
    anchors.prefix = toLayer(prefix, anchors.prefix);
    anchors.tail = toLayer(tail, anchors.tail);
    anchors.cacheLine = toLayer(cacheLineBox(mainStack(wide)), anchors.cacheLine);
  };
  const blockTargets = blockBoxes(mainStack(true), Array.from({ length: BLOCKS }, () => true));
  blockTargets.forEach((b, k) => (anchors[`block${k}`] = toLayer(b)));
  let wide = true;
  placeAnchors(wide);
  registerAnchors('mind', group, anchors);

  const groupState = Array.from({ length: GROUP_COUNT }, () => new THREE.Vector4(1, 1, 0, 0));
  const palette = Array.from({ length: GROUP_COUNT }, (_, g) => new THREE.Color(g < BLOCKS ? LAYER_COLORS[g] : (GROUP_COLORS[g] ?? '#ffffff')));
  const uniforms = {
    uTime: shared.uTime,
    uGather: { value: 0 },
    uBlend: { value: 1 },
    uSpread: { value: 0.7 },
    uArc: { value: 0 },
    uScale: pointScale,
    uSize: { value: 2.6 },
    uIntensity: { value: 0.85 },
    uOn: { value: 0 },
    uGroup: { value: groupState },
    uPalette: { value: palette },
    uWave: { value: new THREE.Vector2(-10, 0) },
  };

  // Sparks: a few hundred brighter points the script moves every frame.
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3);
  const sparkColor = new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 4), 4);
  const sparkSize = new THREE.BufferAttribute(new Float32Array(MAX_SPARKS), 1);
  for (const a of [sparkPos, sparkColor, sparkSize]) a.setUsage(THREE.DynamicDrawUsage);
  sparkGeo.setAttribute('position', sparkPos);
  sparkGeo.setAttribute('aColor', sparkColor);
  sparkGeo.setAttribute('aSize', sparkSize);
  sparkGeo.setDrawRange(0, 0);
  const sparkUniforms = { uScale: pointScale, uSize: { value: 12 }, uOn: { value: 0 } };
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.ShaderMaterial({ vertexShader: sparkVertex, fragmentShader: sparkFragment, uniforms: sparkUniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
  );
  sparks.frustumCulled = false;
  sparks.renderOrder = 11;
  holder.add(sparks);

  // The points, once the bust has loaded.
  let points: THREE.Points | null = null;
  let geo: THREE.BufferGeometry | null = null;
  let bust: Float32Array | null = null;
  let blocks: Float32Array | null = null;
  let rand: Float32Array | null = null;
  let from: Float32Array | null = null;
  let to: Float32Array | null = null;
  let groups: Float32Array | null = null;
  let delay: Float32Array | null = null;
  const cache = new Map<string, Formation>();
  let currentKey = '';
  let builtWide = true;
  let duration = 1;
  /** When the current move started, on the world's clock: moves keep to time whatever the frame rate. */
  let movedAt = 0;

  const formation = (key: string) => {
    const id = `${key}|${wide ? 'w' : 'n'}`;
    let f = cache.get(id);
    if (!f && bust && blocks) {
      f = buildFormation(key, wide, bust, blocks);
      cache.set(id, f);
    }
    return f!;
  };

  /** Starts the points towards a formation from wherever they are now, mid-flight or not. */
  const apply = (cue: Cue, now: number) => {
    if (!geo || !from || !to || !groups || !delay || !rand) return;
    movedAt = now;
    const target = formation(cue.key);
    const n = delay.length;
    if (cue.instant || cue.duration <= 0) {
      from.set(target.pos);
      to.set(target.pos);
      for (let i = 0; i < n; i++) groups[i * 2] = groups[i * 2 + 1] = target.group[i]!;
      uniforms.uBlend.value = 1;
    } else {
      const b = uniforms.uBlend.value;
      const spread = uniforms.uSpread.value;
      const arc = uniforms.uArc.value;
      for (let i = 0; i < n; i++) {
        let w = 1;
        if (b < 1) {
          const lead = delay[i]! * spread;
          w = smoothstep(lead, lead + 1 - spread, b);
        }
        const sw = rand[i * 4 + 2]! * Math.PI * 2;
        const swirl = Math.sin(w * Math.PI) * arc * (0.4 + rand[i * 4 + 1]!);
        from[i * 3] = from[i * 3]! + (to[i * 3]! - from[i * 3]!) * w + Math.cos(sw) * swirl;
        from[i * 3 + 1] = from[i * 3 + 1]! + (to[i * 3 + 1]! - from[i * 3 + 1]!) * w + Math.sin(sw) * swirl;
        from[i * 3 + 2] = from[i * 3 + 2]! + (to[i * 3 + 2]! - from[i * 3 + 2]!) * w;
        groups[i * 2] = w < 0.5 ? groups[i * 2]! : groups[i * 2 + 1]!;
        groups[i * 2 + 1] = target.group[i]!;
      }
      to.set(target.pos);
      // The order points leave in.
      if (cue.order === 'top' || cue.order === 'left') {
        const axis = cue.order === 'top' ? 1 : 0;
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < n; i++) {
          const v = to[i * 3 + axis]!;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const span = hi - lo || 1;
        for (let i = 0; i < n; i++) {
          const v = (to[i * 3 + axis]! - lo) / span;
          delay[i] = (axis === 1 ? 1 - v : v) * 0.88 + hash01(i, 91) * 0.12;
        }
      } else if (cue.order === 'seq' && target.seq) delay.set(target.seq);
      else for (let i = 0; i < n; i++) delay[i] = hash01(i, 92);
      uniforms.uBlend.value = 0;
      uniforms.uSpread.value = cue.spread;
      uniforms.uArc.value = cue.arc;
      duration = cue.duration;
    }
    for (const name of ['position', 'aTo', 'aGroups', 'aDelay']) geo.getAttribute(name).needsUpdate = true;
    currentKey = cue.key;
    builtWide = wide;
  };

  void loadBinary(bustUrl)
    .then((buf) => {
      const t = buildBustTargets(parseBustMesh(buf), maxPoints, createRng('firefly-bust'));
      const n = t.count;
      bust = t.bust;
      blocks = blocksByHeight(t.bust);
      rand = t.rand;
      const swarm = t.swarm;
      for (let i = 0; i < n; i++) {
        swarm[i * 3] = swarm[i * 3]! * 1.5;
        swarm[i * 3 + 2] = 0;
      }
      const head = buildFormation('bust', wide, bust, blocks);
      from = Float32Array.from(head.pos);
      to = Float32Array.from(head.pos);
      groups = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) groups[i * 2] = groups[i * 2 + 1] = head.group[i]!;
      delay = new Float32Array(n);
      currentKey = 'bust';
      geo = new THREE.BufferGeometry();
      const dyn = (arr: Float32Array, size: number) => new THREE.BufferAttribute(arr, size).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', dyn(from, 3));
      geo.setAttribute('aTo', dyn(to, 3));
      geo.setAttribute('aGroups', dyn(groups, 2));
      geo.setAttribute('aDelay', dyn(delay, 1));
      geo.setAttribute('aSwarm', new THREE.BufferAttribute(swarm, 3));
      geo.setAttribute('aRand', new THREE.BufferAttribute(t.rand, 4));
      points = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
      );
      points.frustumCulled = false;
      points.renderOrder = 10;
      holder.add(points);
    })
    .catch((err: unknown) => console.error('[mind] bust failed to load', err));

  const look = new Look();
  const eased = new Float32Array(GROUP_COUNT * 4);
  look.reset();
  eased.set(look.groups);
  let arrivedAt = -1;
  let step: string | null = null;
  let stepStart = 0;
  let bustness = 1;

  return {
    group,
    p: P,
    py: P,
    update: (f: Frame) => {
      const diving = f.dive?.scene === 'mind' ? f.dive : null;
      // Fireflies only show after dark and near the mind's scene, and gather as it arrives.
      const away = Math.abs(f.s - MIND_SCENE);
      const on = Math.max(diving ? 1 : 0, f.look.stars * (1 - smootherstep((away - 0.45) / 0.45)));
      uniforms.uOn.value = on;
      sparkUniforms.uOn.value = on;
      const near = 1 - Math.min(1, away / 0.8);
      uniforms.uGather.value = diving ? 1 : smootherstep(near * 1.4 - 0.2);
      const settled = near > 0.55;
      if (settled && arrivedAt < 0) arrivedAt = f.time;
      if (!settled) arrivedAt = -1;
      const visible = on > 0.01;
      if (points) points.visible = visible;
      sparks.visible = visible;
      if (!visible && !diving) return;

      // Wide or narrow formations, by how much of the view a dive leaves free.
      const stage = diveStage(window.innerWidth, f.viewW, f.viewH);
      const nowWide = stage.freeW >= WIDEST * SCALE * 0.98;
      if (nowWide !== wide) {
        wide = nowWide;
        placeAnchors(wide);
      }

      // Which script, and how far into it.
      const id = diving ? diving.step : null;
      if (id !== step) {
        step = id;
        stepStart = f.time;
      }
      const script = (id && SCRIPTS[id]) || attract;
      const t = id && SCRIPTS[id] ? f.time - stepStart : arrivedAt < 0 ? -1 : f.time - arrivedAt;
      const s = { wide, lab: useLab.getState().on };
      const cue = script.cue(t, s);
      if (cue.key !== currentKey || builtWide !== wide) apply(cue, f.time);
      if (uniforms.uBlend.value < 1) uniforms.uBlend.value = Math.min(1, (f.time - movedAt) / Math.max(0.05, duration));

      // Glow, calm and alarm per group, eased so nothing snaps.
      look.reset();
      script.look?.(t, s, look);
      const k = 1 - Math.exp(-7 * f.dt);
      for (let i = 0; i < eased.length; i++) eased[i]! += (look.groups[i]! - eased[i]!) * k;
      for (let g = 0; g < GROUP_COUNT; g++) groupState[g]!.set(eased[g * 4]!, eased[g * 4 + 1]!, eased[g * 4 + 2]!, eased[g * 4 + 3]!);
      uniforms.uWave.value.set(look.wave[0], look.wave[1]);
      Object.assign(worldView.labels, look.labels);

      // Sparks.
      sparkPos.array.set(look.sparkPos.subarray(0, look.sparks * 3));
      sparkColor.array.set(look.sparkColor.subarray(0, look.sparks * 4));
      sparkSize.array.set(look.sparkSize.subarray(0, look.sparks));
      sparkPos.needsUpdate = sparkColor.needsUpdate = sparkSize.needsUpdate = true;
      sparkGeo.setDrawRange(0, look.sparks);

      // The block labels ride on whichever stack is showing.
      const shown = stackOf(currentKey, wide);
      if (shown) {
        const kb = 1 - Math.exp(-4 * f.dt);
        blockBoxes(shown.box, shown.mask).forEach((b, i) => {
          const a = anchors[`block${i}`]!;
          const want = toLayer(b);
          a.x += (want.x - a.x) * kb;
          a.y += (want.y - a.y) * kb;
          a.w += (want.w - a.w) * kb;
          a.h += (want.h - a.h) * kb;
        });
      }

      // A glance towards the cursor while it is a head, never more than a few degrees.
      bustness += ((currentKey === 'bust' ? 1 : 0) - bustness) * (1 - Math.exp(-2.5 * f.dt));
      const yaw = 0.42 + (pointer.active ? pointer.x * 0.16 : Math.sin(f.time * 0.25) * 0.06);
      holder.rotation.y += (yaw * bustness - holder.rotation.y) * (1 - Math.exp(-3 * f.dt));
      holder.rotation.x = (pointer.active ? -pointer.y * 0.05 : 0) * bustness;
    },
  };
}

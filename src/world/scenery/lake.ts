import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { shared } from '../gl/flat.ts';
import { registerAnchors, type Anchor } from '../anchors.ts';
import { peopleMaterial, pointScale } from '../gl/sprites.ts';
import { worldView } from '../view.ts';
import { renderedStructures } from './renderedStructures.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { boatAt, framesAt, FRAMES, lakeLayout, lampAt, LOOPS, packetsAt, RACE, spokenBy, VERDICT, type LakeStep, type PacketKind } from './lakeLayout.ts';
import { riverBottom, riverTop } from './valley.ts';

const LIME = '#c6ff3d';

/**
 * The amphitheatre screen: a live voice waveform, bars rising as someone speaks. With
 * `uFace` up it shows the avatar instead, its mouth moving with the same voice.
 */
function screenMaterial() {
  const uniforms = { uBg: { value: new THREE.Color() }, uBar: { value: new THREE.Color() }, uTime: shared.uTime, uFace: { value: 0 }, uTalk: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBg;
      uniform vec3 uBar;
      uniform float uTime;
      uniform float uFace;
      uniform float uTalk;
      varying vec2 vUv;
      void main() {
        float n = 28.0;
        float i = floor(vUv.x * n);
        float x = fract(vUv.x * n);
        // Speech comes in phrases: an envelope of words, each bar its own syllable.
        float phrase = smoothstep(0.0, 0.3, sin(uTime * 0.9) * 0.5 + 0.5) * uTalk;
        float h = 0.12 + phrase * (0.25 + 0.55 * abs(sin(uTime * 7.0 + i * 1.7) * sin(uTime * 3.1 + i * 0.6)));
        float bar = step(0.25, x) * step(x, 0.75) * step(abs(vUv.y - 0.5), h * 0.5);
        vec3 col = mix(uBg, uBar, bar);
        col += uBar * 0.12 * smoothstep(0.7, 0.0, abs(vUv.y - 0.5));
        // The avatar: a head and shoulders, the mouth opening with each syllable.
        vec2 p = (vUv - vec2(0.5, 0.5)) * vec2(1.86, 1.0);
        float head = length(p - vec2(0.0, 0.08)) - 0.25;
        float body = length((p - vec2(0.0, -0.5)) * vec2(0.7, 1.0)) - 0.36;
        float hair = max(length(p - vec2(0.0, 0.13)) - 0.26, -(p.y - 0.12));
        float eyes = min(length(p - vec2(-0.09, 0.12)), length(p - vec2(0.09, 0.12))) - 0.025;
        float open = 0.012 + 0.05 * phrase * abs(sin(uTime * 11.0) * sin(uTime * 4.3));
        float mouth = length((p - vec2(0.0, -0.03)) / vec2(0.07, open + 0.004)) - 1.0;
        vec3 face = uBg * 0.8;
        face = mix(face, uBar * 0.85, step(body, 0.0));
        face = mix(face, vec3(0.94, 0.85, 0.76), step(head, 0.0));
        face = mix(face, vec3(0.29, 0.2, 0.16), step(hair, 0.0));
        face = mix(face, vec3(0.09, 0.08, 0.11), step(eyes, 0.0));
        face = mix(face, vec3(0.45, 0.16, 0.14), step(mouth, 0.0) * step(head, 0.0));
        gl_FragColor = vec4(mix(col, face, uFace), 1.0);
      }`,
  });
  return { material, uniforms };
}

/** A small picture painted once on a canvas. */
function painted(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const PACKET_COLOR: Record<PacketKind, string> = { voice: '#7fe8ff', text: '#f6f1ea', verdict: '#9aa0ac', sentence: LIME, token: '#f6f1ea' };

/**
 * Dusk at the lake, the realtime-voice scene: an open-air stage on the far shore with a big
 * screen speaking to an audience, two boats racing to the first spoken sentence (the old pipeline at
 * 5.4 s, the streamed one at 2.1 s), and lanterns lighting one by one on the water. Over the
 * stage, a lighting truss carries the voice pipeline, a lamp per stage of it; on the shore,
 * a learner's laptop shares its screen through a gate that drops the frames already seen.
 */
/** Where each rendered piece lies: the stage just under the picture on its screen, the truss behind the lamps. */
const RENDER_Z: Readonly<Record<string, number>> = { 'lake-stage': 0.4502, 'lake-truss': 0.4305, 'lake-tower0': 0.4305, 'lake-tower1': 0.4305 };

export function lake(group: THREE.Group, half = false) {
  const L = lakeLayout();
  const { cx, ax, shore } = L;

  // The stage: a stepped stone plinth carrying the screen, and an audience on the shore
  // in front of it, watching it speak.
  const stone = new THREE.MeshBasicMaterial();
  const stoneShade = new THREE.MeshBasicMaterial();
  // What the Blender renders replace, once they are in.
  const stageParts: THREE.Mesh[] = [];
  const trussParts: THREE.Mesh[] = [];
  let top = shore(ax) - 2;
  [300, 236, 176].forEach((w, k) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, 11), stoneShade);
    face.position.set(ax, top + 5.5, 0.44 + k * 0.002);
    const tread = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.5), stone);
    tread.position.set(ax, top + 9.75, 0.441 + k * 0.002);
    group.add(face, tread);
    stageParts.push(face, tread);
    top += 11;
  });
  const screen = screenMaterial();
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(172, 98), stoneShade);
  frame.position.set(ax, L.screenY, 0.45);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(160, 86), screen.material);
  display.position.set(ax, L.screenY, 0.451);
  const legs = [-58, 58].map((dx) => {
    const leg = new THREE.Mesh(new THREE.PlaneGeometry(7, 16), stoneShade);
    leg.position.set(ax + dx, top + 7, 0.449);
    return leg;
  });
  group.add(frame, display, ...legs);
  stageParts.push(frame, ...legs);

  // The truss: two posts from the plinth and a beam, a lamp per stage of the pipeline.
  const steel = new THREE.MeshBasicMaterial();
  const span = { x0: L.lamps[0]!.x - 42, x1: L.lamps.at(-1)!.x + 22 };
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(span.x1 - span.x0, 4), steel);
  beam.position.set((span.x0 + span.x1) / 2, L.trussY, 0.43);
  group.add(beam);
  trussParts.push(beam);
  for (const x of [span.x0 + 4, span.x1 - 4]) {
    const h = L.trussY - shore(x);
    const post = new THREE.Mesh(new THREE.PlaneGeometry(3.4, h), steel);
    post.position.set(x, shore(x) + h / 2, 0.43);
    group.add(post);
    trussParts.push(post);
  }
  const lampMats = L.lamps.map((l) => {
    const hanger = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 6), steel);
    hanger.position.set(l.x, L.trussY - 3, 0.43);
    trussParts.push(hanger);
    const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20), m);
    lamp.position.set(l.x, l.y, 0.47);
    const glowMat = new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(16, 24), glowMat);
    glow.position.set(l.x, l.y, 0.469);
    group.add(hanger, glow, lamp);
    return { lamp: m, glow: glowMat };
  });
  // From the last lamp a cable drops to the screen: the avatar is the face it shows.
  const drop = new THREE.Mesh(new THREE.PlaneGeometry(1.2, L.trussY - 9 - (L.screenY + 49)), steel);
  drop.position.set(L.lamps.at(-1)!.x, (L.trussY - 9 + L.screenY + 49) / 2, 0.43);
  group.add(drop);
  trussParts.push(drop);
  const rendered = renderedStructures(group, 'voice', { z: 0.4502, half, zOf: (id) => RENDER_Z[id] });

  // The scoreboard at the truss's foot, where a verdict goes instead of the speaker.
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 22),
    new THREE.MeshBasicMaterial({
      map: painted(128, 84, (ctx) => {
        ctx.fillStyle = '#1b1d2a';
        ctx.beginPath();
        ctx.roundRect(2, 2, 124, 80, 12);
        ctx.fill();
        ctx.strokeStyle = LIME;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(40, 44);
        ctx.lineTo(56, 60);
        ctx.lineTo(88, 26);
        ctx.stroke();
      }),
      transparent: true,
    }),
  );
  board.position.set(L.ledger.x, L.ledger.y, 0.47);
  const boardFlash = new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), boardFlash);
  flashMesh.position.set(L.ledger.x, L.ledger.y, 0.468);
  group.add(flashMesh, board);

  // Packets in flight along the truss.
  const POOL = 14;
  const packets = Array.from({ length: POOL }, () => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(3.2, 12), m);
    mesh.position.z = 0.48;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, m };
  });

  // The learner's laptop on a little table, and the gate its screen frames pass through.
  const wood = new THREE.MeshBasicMaterial();
  const lx = L.laptop.x;
  const ly = L.laptop.y;
  const table = new THREE.Mesh(new THREE.PlaneGeometry(34, 3), wood);
  table.position.set(lx + 8, ly + 13, 0.46);
  const tableLegs = [-12, 12].map((dx) => {
    const leg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 12), wood);
    leg.position.set(lx + 8 + dx, ly + 6, 0.46);
    return leg;
  });
  const lidMat = new THREE.MeshBasicMaterial();
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), lidMat);
  lid.position.set(lx + 8, ly + 21.5, 0.461);
  const glassMat = new THREE.MeshBasicMaterial();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 9.5), glassMat);
  glass.position.set(lx + 8, ly + 21.5, 0.462);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(22, 2), lidMat);
  base.position.set(lx + 8, ly + 15.2, 0.461);
  group.add(table, ...tableLegs, lid, glass, base);
  const gateLight = new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0 });
  for (const dx of [-9, 9]) {
    const post = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 34), steel);
    post.position.set(L.gate.x + dx, shore(L.gate.x) + 17, 0.46);
    group.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.PlaneGeometry(24, 3), steel);
  lintel.position.set(L.gate.x, shore(L.gate.x) + 34, 0.46);
  const beacon = new THREE.Mesh(new THREE.CircleGeometry(2.6, 12), gateLight);
  beacon.position.set(L.gate.x, shore(L.gate.x) + 38.5, 0.461);
  group.add(lintel, beacon);
  const frames = Array.from({ length: FRAMES.count }, () => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(17, 11), m);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    edge.position.z = -0.001;
    mesh.add(edge);
    mesh.position.z = 0.49;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, m, edge: edge.material as THREE.MeshBasicMaterial };
  });

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
  const boats = ['#e8e1d6', LIME].map((sailColor) => {
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
  const lanternUniforms = { uOn: { value: 0 }, uTime: shared.uTime, uScale: pointScale, uCount: { value: -1 } };
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
        uniform float uCount;
        varying float vLit;
        void main() {
          // Lit in turn, a sentence at a time, then all of them as night falls. In the dive
          // a lantern lights for each sentence actually spoken.
          float wave = step(aSeed, fract(uTime * 0.06));
          vLit = uCount < 0.0 ? clamp(max(wave, uOn) * uOn * 1.4, 0.0, 1.0) : step(aSeed * 18.0 + 0.5, uCount * 3.6);
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

  // Where the dive can fly, and what its labels ride on.
  const [laneSlow, laneFast] = L.race.lanes as [number, number];
  const finish = L.race.x0 + L.race.span;
  const low = laneFast - 22;
  const high = L.trussY + 18;
  const anchors: Record<string, Anchor> = {
    stage: { x: cx - 30, y: (low + high) / 2, w: 920, h: high - low },
    screen: { x: ax, y: L.screenY - 10, w: 280, h: 190 },
    pipeline: { x: ax - 30, y: L.trussY - 26, w: 560, h: 120 },
    ledger: { x: L.ledger.x, y: L.ledger.y, w: 34, h: 22 },
    race: { x: cx - 50, y: (laneSlow + laneFast) / 2 + 12, w: 900, h: 110 },
    finishFast: { x: finish + 24, y: laneFast + 6, w: 10, h: 10 },
    finishSlow: { x: finish + 24, y: laneSlow + 16, w: 10, h: 10 },
    screenshare: { x: (lx - 30 + ax + 30) / 2, y: (shore(lx) + L.trussY) / 2, w: ax + 30 - (lx - 30), h: L.trussY - shore(lx) + 50 },
    laptop: { x: lx + 8, y: ly + 20, w: 24, h: 16 },
    gate: { x: L.gate.x, y: shore(L.gate.x) + 24, w: 24, h: 32 },
    lanterns: { x: cx, y: (laneSlow + laneFast) / 2, w: 1040, h: 50 },
  };
  L.lamps.forEach((l, k) => (anchors[`lamp${k}`] = { x: l.x, y: l.y, w: 16, h: 16 }));
  registerAnchors('voice', group, anchors);

  const STEPS = new Set<string>(['race', 'verdict', 'sentences', 'screen', 'teach', 'stack']);
  let playing = 'loop';
  let step: LakeStep = 'loop';
  let stepStart = 0;

  return (f: Frame) => {
    const { look } = f;
    rendered?.update(f);
    const stageIn = (rendered?.fadeOf('lake-stage') ?? 0) >= 1;
    for (const m of stageParts) m.visible = !stageIn;
    const trussIn = Math.min(...['lake-truss', 'lake-tower0', 'lake-tower1'].map((id) => rendered?.fadeOf(id) ?? 0)) >= 1;
    for (const m of trussParts) m.visible = !trussIn;
    const shade = tone(look, 0.2, 0.1);
    stone.color.set(mixHex(shade, '#efe6d8', 0.62));
    stoneShade.color.set(mixHex(shade, '#a39684', 0.5));
    steel.color.set(mixHex(shade, '#3a3a46', 0.6));
    wood.color.set(mixHex(shade, '#6b4a33', 0.6));
    lidMat.color.set(mixHex(shade, '#c9ccd6', 0.55));
    hull.color.set(mixHex(shade, '#6b4a33', 0.6));
    screen.uniforms.uBg.value.set(mixHex(shade, '#0f1320', 0.85));
    seated.uniforms.uShade.value.set(tone(look, 0.1));
    screen.uniforms.uBar.value.set(mixHex('#7fe8ff', LIME, 0.35));
    lanternUniforms.uOn.value = Math.min(1, look.windows * 1.2);

    // The dive's step decides what the stage does, and each step plays from its start.
    const key = f.dive?.scene === 'voice' ? f.dive.step : 'loop';
    if (key !== playing) {
      playing = key;
      step = STEPS.has(key) ? (key as LakeStep) : 'loop';
      stepStart = f.time;
    }
    const t = (f.time - stepStart) % LOOPS[step];

    // The race: both boats from the line together; the lime one is home at 2.1 s.
    const raceT = step === 'race' ? t : f.time % RACE.loop;
    [false, true].forEach((fast, k) => {
      const x = L.race.x0 + boatAt(fast, raceT) * L.race.span;
      const boat = boats[k]!;
      boat.position.set(x, L.race.lanes[k]! + Math.sin(f.time * 2 + k) * 1.2, 0.65 + k * 0.01);
      boat.rotation.z = Math.sin(f.time * 1.6 + k * 2) * 0.04;
    });
    worldView.labels['voice-fast'] = step === 'race' ? smoothstep(RACE.fast, RACE.fast + 0.3, t) : 0;
    worldView.labels['voice-slow'] = step === 'race' ? smoothstep(RACE.slow, RACE.slow + 0.3, t) : 0;

    // The pipeline: lamps light as packets reach them; a verdict goes to the scoreboard.
    L.lamps.forEach((_, k) => {
      const lit = lampAt(step, t, k);
      const { lamp, glow } = lampMats[k]!;
      lamp.color.set(mixHex(mixHex(shade, '#565a66', 0.5), LIME, lit));
      glow.opacity = 0.35 * lit;
    });
    const flying = packetsAt(L, step, t);
    packets.forEach((p, i) => {
      const q = flying[i];
      p.mesh.visible = q !== undefined;
      if (!q) return;
      p.mesh.position.set(q.x, q.y, 0.48);
      p.mesh.scale.setScalar(q.kind === 'token' ? 0.55 : q.kind === 'sentence' ? 1.25 : 1);
      p.m.color.set(PACKET_COLOR[q.kind]);
    });
    boardFlash.opacity = step === 'verdict' ? 0.5 * Math.max(0, 1 - Math.abs(t - VERDICT.at - 1.1) * 2) : 0;

    // The screen speaks: a waveform, or the avatar's face in most of the dive.
    const faceOn = step === 'verdict' || step === 'sentences' || step === 'teach' || step === 'stack' || step === 'screen';
    screen.uniforms.uFace.value += ((faceOn ? 1 : 0) - screen.uniforms.uFace.value) * Math.min(1, f.dt * 4);
    // While the verdict is being written the avatar is quiet; it talks once a sentence is spoken.
    const spoken = spokenBy(step, t);
    screen.uniforms.uTalk.value = step === 'verdict' || step === 'sentences' ? (spoken > 0 ? 1 : 0.05) : 1;
    lanternUniforms.uCount.value = step === 'verdict' || step === 'sentences' ? spoken : -1;

    // Screen sharing: frames go out every second; a repeat stops at the gate.
    const inFlight = step === 'screen' ? framesAt(L, t) : [];
    glassMat.color.set(step === 'screen' ? '#9fd8ff' : mixHex(shade, '#2a2d3a', 0.6));
    frames.forEach((fr, i) => {
      const q = inFlight[i];
      fr.mesh.visible = q !== undefined;
      if (!q) return;
      fr.mesh.position.set(q.x, q.y, 0.49);
      fr.m.color.set(q.dup ? '#8d92a0' : '#9fd8ff');
      fr.m.opacity = q.alpha;
      fr.edge.color.set(q.dup ? '#5a5f6c' : LIME);
      fr.edge.opacity = q.alpha;
    });
    const atGate = inFlight.find((q) => Math.abs(q.x - L.gate.x) < 4);
    gateLight.color.set(atGate?.dup ? '#ffb547' : LIME);
    gateLight.opacity = atGate ? 1 : step === 'screen' ? 0.25 : 0;
  };
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

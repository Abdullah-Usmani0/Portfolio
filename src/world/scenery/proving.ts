import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { flatMaterial, silhouette } from '../gl/flat.ts';
import { registerAnchors, type Anchor } from '../anchors.ts';
import { worldView } from '../view.ts';
import { peopleMaterial } from '../gl/sprites.ts';
import { bandGeometry, mistMaterial, waterfallMaterial } from '../gl/water.ts';
import { blameShown, BRIDGE_FIX, bridgeAt, cohortPose, gorgeLayout, graderStamp, LOOPS, managerBubble, PERSONAS, provingLayout, SCALE, type Bubble, type ProvingStep } from './provingLayout.ts';
import { renderedStructures } from './renderedStructures.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { riverTop } from './valley.ts';

const LIME = '#b9ef2e';
const AMBER = '#ffb547';
const INK = '#16131c';

/** A small picture painted once on a canvas: badges, bubbles, chips, a document. */
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

/** Glyphs drawn as paths, so no font has to carry them. */
const glyph = {
  check(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy);
    ctx.lineTo(cx - s * 0.12, cy + s * 0.38);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.4);
    ctx.stroke();
  },
  loop(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, back = false) {
    // An arc with an arrowhead: around again (or, mirrored, undo).
    const a0 = back ? Math.PI * 1.15 : -Math.PI * 0.15;
    const a1 = back ? Math.PI * -0.35 : Math.PI * 1.35;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1, back);
    ctx.stroke();
    const ex = cx + Math.cos(a1) * r;
    const ey = cy + Math.sin(a1) * r;
    const dir = a1 + (back ? -Math.PI / 2 : Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(dir + 0.5) * r * 0.55, ey + Math.sin(dir + 0.5) * r * 0.55);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + Math.cos(dir - 1.1) * r * 0.55, ey + Math.sin(dir - 1.1) * r * 0.55);
    ctx.stroke();
  },
};

const disc = (color: string, mark: (ctx: CanvasRenderingContext2D) => void) =>
  painted(128, 128, (ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    mark(ctx);
  });

const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) => {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
};

/** A speech bubble with a tail, its words in the middle: `w` wide, 160 tall (a square one for a single mark). */
const speech = (lines: readonly string[], w = 160) =>
  painted(w, 160, (ctx) => {
    ctx.fillStyle = '#f6f1ea';
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, 112, 28);
    ctx.moveTo(40, 118);
    ctx.lineTo(28, 152);
    ctx.lineTo(72, 118);
    ctx.fill();
    ctx.fillStyle = INK;
    lines.forEach((l, i) => text(ctx, l, w / 2, 64 + (i - (lines.length - 1) / 2) * 36, lines.length > 1 ? 28 : 60));
  });

/** A thought: a cloud with two small puffs trailing down to the thinker. */
const thought = (mark: string, fill: string) =>
  painted(160, 160, (ctx) => {
    ctx.fillStyle = fill;
    for (const [x, y, r] of [
      [80, 62, 50],
      [46, 74, 30],
      [114, 74, 30],
      [44, 132, 11],
      [30, 152, 7],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    text(ctx, mark, 80, 66, 64);
  });

const chip = (label: string, color: string) =>
  painted(256, 72, (ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 64, 32);
    ctx.fill();
    ctx.fillStyle = INK;
    text(ctx, label, 128, 38, 30);
  });

/**
 * The proving grounds: simulated learners gather at the trailhead to read the stage, ask
 * the manager, hand their work in at the grader, then cross a bridge over a gorge with
 * planks missing. The first stumbles, the owl flags it, the bridge is mended and they all
 * cross. In the dive, each step slows one of those moments down.
 */
/** Where each rendered piece lies among the painted ones (by id, without its number). */
const RENDER_Z: Readonly<Record<string, number>> = {
  wall: 0.4005,
  shoulders: 0.4605,
  bridge: 0.5005,
  'bridge-fix': 0.501,
  owl: 0.5005,
  desk: 0.5305,
  lamp: 0.4705,
  flag: 0.4805,
};

export function provingGrounds(group: THREE.Group, half = false) {
  const L = provingLayout();
  const { cx, bx, span, left, right, deckY, deck, trail } = L;

  // The gorge: a dark back wall with the cascade pouring through it, framed by two rocky
  // shoulders the trail runs over.
  const G = gorgeLayout(L);
  const rock = flatMaterial({ y0: riverTop(bx) - 10, y1: deckY + 40 });
  const backWall = flatMaterial({ y0: riverTop(bx) - 10, y1: deckY + 70 });
  const wallXs: number[] = [];
  const wallYs: number[] = [];
  for (let x = G.wall.from; x <= G.wall.to; x += 6) {
    wallXs.push(x);
    wallYs.push(G.wall.top(x));
  }
  const wall = new THREE.Mesh(silhouette(wallXs, wallYs, G.bottom), backWall);
  wall.position.z = 0.4;
  group.add(wall);

  const cascade = waterfallMaterial();
  const fallTop = G.fall.top;
  const fallBottom = G.fall.bottom;
  const cascadeMesh = new THREE.Mesh(bandGeometry([bx - 30, bx + 30], [fallTop, fallTop], [fallBottom, fallBottom]), cascade.material);
  (cascadeMesh.geometry.getAttribute('uv') as THREE.BufferAttribute).set([0, 0, 0, 1, 1, 0, 1, 1]);
  cascadeMesh.position.z = 0.41;
  group.add(cascadeMesh);

  const shoulders = G.shoulders.map((sh) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = sh.from; x <= sh.to; x += 4) {
      xs.push(x);
      ys.push(sh.top(x));
    }
    const shoulder = new THREE.Mesh(silhouette(xs, ys, G.bottom), rock);
    shoulder.position.z = 0.46;
    group.add(shoulder);
    return shoulder;
  });

  const spray = mistMaterial([bx - 120, bx + 120]);
  const sprayMesh = new THREE.Mesh(bandGeometry([bx - 120, bx + 120], [fallBottom + 46, fallBottom + 46], [fallBottom - 14, fallBottom - 14]), spray.material);
  sprayMesh.position.z = 0.47;
  group.add(sprayMesh);

  // The bridge: planks on a gentle arch, the middle two missing until it is mended.
  const wood = new THREE.MeshBasicMaterial();
  const planks: THREE.Mesh[] = [];
  const ghostMat = new THREE.MeshBasicMaterial({ color: LIME, transparent: true, depthWrite: false });
  const ghosts: THREE.Mesh[] = [];
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8;
    const px = left + t * span;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(span / 8 - 2, 4 * SCALE), wood);
    m.position.set(px, deck(px), 0.5);
    m.rotation.z = Math.cos(Math.PI * t) * 0.18;
    group.add(m);
    planks.push(m);
    if (k === 3 || k === 4) {
      // The fix, previewed: the planks it would lay, drawn as a ghost first.
      const g = m.clone();
      g.material = ghostMat;
      g.position.z = 0.505;
      group.add(g);
      ghosts.push(g);
    }
  }
  const bridgeParts: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.PlaneGeometry(3 * SCALE, 20 * SCALE), wood);
    post.position.set(bx + (side * span) / 2, deckY + 8 * SCALE, 0.5);
    group.add(post);
    bridgeParts.push(post);
  }
  // A hand rail following the arch, with balusters down to the deck.
  const railXs = Array.from({ length: 25 }, (_, i) => left + (i / 24) * span);
  const rail = new THREE.Mesh(
    bandGeometry(
      railXs,
      railXs.map((x) => deck(x) + 17 * SCALE),
      railXs.map((x) => deck(x) + 14.5 * SCALE),
    ),
    wood,
  );
  rail.position.z = 0.5;
  group.add(rail);
  bridgeParts.push(rail);
  for (let k = 1; k < 8; k++) {
    const x = left + (k / 8) * span;
    const baluster = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * SCALE, 15 * SCALE), wood);
    baluster.position.set(x, deck(x) + 8.5 * SCALE, 0.5);
    group.add(baluster);
    bridgeParts.push(baluster);
  }

  // Stage markers along the trail.
  const flagMat = new THREE.MeshBasicMaterial();
  const flagParts: THREE.Mesh[][] = [];
  for (const x of L.flags) {
    const y = trail(x);
    const post = new THREE.Mesh(new THREE.PlaneGeometry(2.5 * SCALE, 34 * SCALE), wood);
    post.position.set(x, y + 17 * SCALE, 0.48);
    const flag = new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(16, -5), new THREE.Vector2(0, -10)])).scale(SCALE, SCALE, 1),
      flagMat,
    );
    flag.position.set(x + SCALE, y + 34 * SCALE, 0.49);
    group.add(post, flag);
    flagParts.push([post, flag]);
  }

  // The grader's booth, where the work is handed in. The desk stands in front of the grader
  // (and of the cohort), so the grader works behind it; the lamp is at its near end.
  const gx = L.grader.x;
  const gy = trail(gx);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(26 * SCALE, 13 * SCALE), wood);
  desk.position.set(gx + 6, gy + 6.5 * SCALE, 0.53);
  const deskTop = new THREE.Mesh(new THREE.PlaneGeometry(30 * SCALE, 2.4 * SCALE), wood);
  deskTop.position.set(gx + 6, gy + 13.5 * SCALE, 0.531);
  const lampPole = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * SCALE, 22 * SCALE), wood);
  lampPole.position.set(gx - 6, gy + 24 * SCALE, 0.47);
  const lampMat = new THREE.MeshBasicMaterial();
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(3.2 * SCALE, 16), lampMat);
  lamp.position.set(gx - 6, gy + 35 * SCALE, 0.472);
  group.add(desk, deskTop, lampPole, lamp);

  // The owl on its post: it watches every stage and raises a flag when one breaks.
  const owlX = L.owl.x;
  const owlY = trail(owlX);
  const owlBody = new THREE.MeshBasicMaterial();
  const owlFace = new THREE.MeshBasicMaterial();
  const owl = new THREE.Group();
  owl.position.set(owlX, owlY, 0.5);
  owl.scale.setScalar(SCALE);
  const owlPost = new THREE.Mesh(new THREE.PlaneGeometry(4, 40), wood);
  owlPost.position.set(0, 20, 0);
  const body = new THREE.Mesh(new THREE.CircleGeometry(11, 20), owlBody);
  body.scale.set(0.95, 1.2, 1);
  body.position.set(0, 52, 0.01);
  const head = new THREE.Mesh(new THREE.CircleGeometry(9, 20), owlBody);
  head.position.set(0, 68, 0.02);
  const ears = new THREE.Mesh(
    new THREE.ShapeGeometry([
      new THREE.Shape([new THREE.Vector2(-9, 70), new THREE.Vector2(-4, 74), new THREE.Vector2(-8, 81)]),
      new THREE.Shape([new THREE.Vector2(9, 70), new THREE.Vector2(4, 74), new THREE.Vector2(8, 81)]),
    ]),
    owlBody,
  );
  ears.position.z = 0.02;
  const eyes = [-3.6, 3.6].map((ex) => {
    const e = new THREE.Mesh(new THREE.CircleGeometry(2.6, 12), owlFace);
    e.position.set(ex, 69, 0.03);
    return e;
  });
  owl.add(owlPost, body, head, ears, ...eyes);
  group.add(owl);

  // The grounds as rendered in Blender, each piece over its painted self: the rock and the
  // bridge, the owl (its eyes stay the scene's, to blink and glow), the booth and the flags.
  const rendered = renderedStructures(group, 'learners', { z: 0.5, half, zOf: (id) => RENDER_Z[id.replace(/^proving-|\d+$/g, '')] });
  const fadeOf = (id: string) => rendered?.fadeOf(`proving-${id}`) ?? 0;

  // Pictures the scene holds up: badges, bubbles, the owl's blame chips, the undo.
  const tex = {
    flag: disc(AMBER, (ctx) => text(ctx, '!', 64, 70, 76)),
    ok: disc(LIME, (ctx) => glyph.check(ctx, 64, 66, 64)),
    think: thought('?', '#f6f1ea'),
    clear: disc(LIME, (ctx) => glyph.check(ctx, 64, 66, 60)),
    twoway: thought('?!', AMBER),
    ask: speech(['?']),
    typing: speech(['· · ·'], 384),
    reply: speech(['For the sales team.', 'One page is enough.'], 384),
    // A page of real work, carried up to be graded.
    card: painted(128, 128, (ctx) => {
      ctx.fillStyle = '#f6f1ea';
      ctx.beginPath();
      ctx.roundRect(22, 6, 84, 116, 8);
      ctx.fill();
      ctx.fillStyle = '#8c8696';
      for (let k = 0; k < 5; k++) ctx.fillRect(34, 28 + k * 18, k === 4 ? 36 : 60, 7);
    }),
    pass: disc(LIME, (ctx) => glyph.check(ctx, 64, 66, 60)),
    retry: disc(AMBER, (ctx) => glyph.loop(ctx, 64, 66, 30)),
    undo: disc('#f6f1ea', (ctx) => glyph.loop(ctx, 64, 66, 30, true)),
    chips: [chip('CONTENT  4', '#ff8a73'), chip('HARNESS  1', '#6ae8ff'), chip('LEARNER  1', '#cfa6ff')],
  };
  const sprite = (map: THREE.Texture, w: number, h: number, z: number) => {
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.z = z;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, material };
  };
  const signal = sprite(tex.flag, 24 * SCALE, 24 * SCALE, 0.6);
  const signalY = owlY + 104 * SCALE;
  signal.mesh.position.x = owlX;
  const bubbles = PERSONAS.map(() => sprite(tex.think, 15 * SCALE, 15 * SCALE, 0.62));
  const managerSays = sprite(tex.reply, 64 * SCALE, 27 * SCALE, 0.62);
  const stamp = sprite(tex.pass, 18 * SCALE, 18 * SCALE, 0.62);
  const undo = sprite(tex.undo, 15 * SCALE, 15 * SCALE, 0.62);
  const chips = tex.chips.map((t) => sprite(t, 34 * SCALE, 9.5 * SCALE, 0.61));

  // The cohort, then the manager (taller, in lime) and the grader at the booth.
  const count = PERSONAS.length + 2;
  const people = peopleMaterial();
  const geo = new THREE.PlaneGeometry(12 * SCALE, 27 * SCALE);
  geo.translate(0, 13.5 * SCALE, 0);
  const colors = new Float32Array(count * 3);
  [...PERSONAS, LIME, '#9fb3c8'].forEach((hex, i) => {
    const c = new THREE.Color(hex);
    colors.set([c.r, c.g, c.b], i * 3);
  });
  const walk = new Float32Array(count);
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 1));
  const crowd = new THREE.InstancedMesh(geo, people.material, count);
  crowd.position.z = 0.52;
  crowd.frustumCulled = false;
  group.add(crowd);
  const m = new THREE.Matrix4();

  // Where the dive can fly, and what its labels ride on.
  const headY = (x: number) => trail(x) + 30 * SCALE;
  const anchors: Record<string, Anchor> = {
    grounds: { x: cx - 200, y: deckY + 10, w: 1160, h: 300 },
    cohort: { x: (L.lineup[0]! + L.lineup.at(-1)!) / 2, y: headY(L.lineup[0]!), w: 230, h: 130 },
    manager: { x: (L.lineup[2]! + L.manager.x) / 2, y: headY(L.manager.x), w: 280, h: 150 },
    managerHead: { x: L.manager.x, y: headY(L.manager.x) + 10, w: 20, h: 24 },
    grader: { x: gx - 80, y: headY(gx), w: 300, h: 150 },
    graderDesk: { x: gx + 6, y: gy + 8 * SCALE, w: 52, h: 30 },
    // Where the cohort stumbles: the owl with its chips, and the edge of the missing planks.
    gap: { x: (owlX - 90 + bx + 100) / 2, y: deckY + 60, w: bx + 100 - (owlX - 90), h: 260 },
    gapEdge: { x: L.gap, y: headY(L.gap), w: 20, h: 24 },
    owl: { x: owlX - 30, y: owlY + 100, w: 170, h: 250 },
    // The two planks the fix lays, and the bridge they mend.
    mend: { x: bx - 10, y: deckY + 30, w: 300, h: 210 },
    planks: { x: bx, y: deck(bx), w: span / 4, h: 16 },
    bridge: { x: bx - 50, y: deckY + 40, w: 560, h: 270 },
    farside: { x: right + 110, y: headY(right + 110), w: 120, h: 60 },
  };
  L.lineup.forEach((x, i) => (anchors[`persona${i}`] = { x, y: headY(x), w: 20, h: 24 }));
  registerAnchors('learners', group, anchors);

  let playing = 'loop';
  let step: ProvingStep = 'loop';
  let stepStart = 0;
  const STEPS = new Set<string>(['personas', 'cold', 'ask', 'handin', 'stumble', 'fix', 'rerun']);

  return (f: Frame) => {
    const { look } = f;
    const base = tone(look, 0.18, 0.1);
    wood.color.set(mixHex(base, '#7a5233', 0.55));
    flagMat.color.set(mixHex(base, '#e8c95a', 0.7));
    owlBody.color.set(mixHex(base, '#8a6a4f', 0.55));
    owlFace.color.set(mixHex('#fff3c4', '#ffd36b', look.windows));
    lampMat.color.set(mixHex(mixHex(base, '#f6e7c4', 0.6), '#ffd27a', look.windows));
    const stone = tone(look, 0.22, 0.25);
    rock.uniforms.uTop.value.set(mixHex(stone, look.haze, 0.12));
    rock.uniforms.uBottom.value.set(mixHex(stone, look.shade, 0.4));
    backWall.uniforms.uTop.value.set(mixHex(stone, look.shade, 0.45));
    backWall.uniforms.uBottom.value.set(mixHex(stone, look.shade, 0.7));
    cascade.uniforms.uWater.value.set(mixHex(look.water, look.skyHorizon, 0.4));
    cascade.uniforms.uLight.value.set(mixHex(look.snow, '#ffffff', 0.4));
    spray.uniforms.uColor.value.set(mixHex(look.snow, look.skyHorizon, 0.3));
    spray.uniforms.uAmount.value = 0.6;
    people.uniforms.uShade.value.set(tone(look, 0.1));

    // The dive's step decides what the cohort is doing, and each step plays from its start
    // (the overview too, so the cohort walks in from the trailhead as the camera arrives).
    const key = f.dive?.scene === 'learners' ? f.dive.step : 'loop';
    if (key !== playing) {
      playing = key;
      step = STEPS.has(key) ? (key as ProvingStep) : 'loop';
      stepStart = f.time;
    }
    const t = (f.time - stepStart) % LOOPS[step];

    const bridge = bridgeAt(L, step, t);
    // Each painted piece until its render is in.
    rendered?.show(BRIDGE_FIX, bridge.planks === 'fixed' ? 1 : 0);
    rendered?.update(f);
    wall.visible = fadeOf('wall') < 1;
    for (const m of shoulders) m.visible = fadeOf('shoulders') < 1;
    const bridgeIn = fadeOf('bridge') >= 1;
    for (const m of bridgeParts) m.visible = !bridgeIn;
    planks.forEach((p, k) => (p.visible = k === 3 || k === 4 ? bridge.planks === 'fixed' && fadeOf('bridge-fix') < 1 : !bridgeIn));
    const owlIn = fadeOf('owl') >= 1;
    for (const m of [owlPost, body, head, ears]) m.visible = !owlIn;
    desk.visible = deskTop.visible = fadeOf('desk') < 1;
    lampPole.visible = lamp.visible = fadeOf('lamp') < 1;
    flagParts.forEach((parts, k) => parts.forEach((m) => (m.visible = fadeOf(`flag${k}`) < 1)));
    ghosts.forEach((g) => (g.visible = bridge.planks === 'ghost'));
    ghostMat.opacity = 0.35 + 0.25 * Math.sin(f.time * 5);
    // The owl's signal: a flag from the stumble until the fix, then a tick for a while.
    signal.mesh.visible = bridge.signal !== null;
    signal.material.map = bridge.signal === 'ok' ? tex.ok : tex.flag;
    const pop = Math.min(1, Math.max(0, bridge.since) * 4);
    signal.mesh.scale.setScalar(0.6 + 0.4 * pop);
    signal.mesh.position.y = signalY + Math.sin(f.time * 3) * 2;
    eyes.forEach((e) => (e.scale.y = Math.sin(f.time * 1.7) > 0.97 ? 0.15 : 1));
    // Who the stumbles are blamed on, raised one by one beside the owl.
    const shown = blameShown(step, t);
    chips.forEach((c, k) => {
      c.mesh.visible = k < shown;
      c.mesh.position.set(owlX - 30 * SCALE, owlY + (98 - k * 12) * SCALE, 0.61);
    });
    undo.mesh.visible = step === 'fix' && t > 4.5;
    undo.mesh.position.set(bx + 8 * SCALE, deck(bx) + 34 * SCALE + Math.sin(f.time * 2) * 1.5, 0.62);
    // The words that go with the fix: a preview first, then the applied (and revertible) change.
    worldView.labels['learners-preview'] = step === 'fix' ? 1 - smoothstep(2.6, 3, t) : 0;
    worldView.labels['learners-applied'] = step === 'fix' ? smoothstep(3, 3.4, t) : 0;

    for (let i = 0; i < PERSONAS.length; i++) {
      const p = cohortPose(L, step, t, i, f.time);
      walk[i] = p.walk ?? 0;
      m.makeScale(p.visible ? p.face : 0, p.visible ? p.crouch : 0, 1).setPosition(p.x, p.y, 0);
      crowd.setMatrixAt(i, m);
      const b = bubbles[i]!;
      b.mesh.visible = p.visible && p.bubble !== null;
      if (p.bubble) {
        b.material.map = tex[p.bubble as Exclude<Bubble, null>];
        b.mesh.position.set(p.x + 4 * SCALE, p.y + (37 + Math.sin(f.time * 2.4 + i) * 0.8) * SCALE, 0.62);
      }
    }
    // The manager waits by the second flag; the grader works the booth.
    const mx = L.manager.x;
    m.makeScale(-1.12, 1.12, 1).setPosition(mx, trail(mx), 0);
    crowd.setMatrixAt(PERSONAS.length, m);
    m.makeScale(-1, 1, 1).setPosition(gx + 16, gy, 0);
    crowd.setMatrixAt(PERSONAS.length + 1, m);
    const said = managerBubble(step, t);
    managerSays.mesh.visible = said !== null;
    if (said) {
      managerSays.material.map = said === 'reply' ? tex.reply : tex.typing;
      managerSays.mesh.position.set(mx + 14 * SCALE, trail(mx) + 46 * SCALE, 0.62);
    }
    const verdict = graderStamp(step, t);
    stamp.mesh.visible = verdict !== null;
    if (verdict) {
      stamp.material.map = verdict === 'pass' ? tex.pass : tex.retry;
      stamp.mesh.position.set(gx + 6, gy + 50 * SCALE, 0.62);
    }
    (geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    crowd.instanceMatrix.needsUpdate = true;
  };
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

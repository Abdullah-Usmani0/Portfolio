import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { registerAnchors } from '../anchors.ts';
import { peopleMaterial } from '../gl/sprites.ts';
import { bandGeometry, mistMaterial, waterfallMaterial } from '../gl/water.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { riverTop } from './valley.ts';
import { onValley } from './village.ts';

/** A round badge with a glyph, painted once; the owl raises one over its head. */
function badge(glyph: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16131c';
    ctx.font = '700 76px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 64, 70);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** The five learner personas, each in its own scarf colour. */
const PERSONAS = ['#7fb2e8', '#f0a35e', '#b892e0', '#8cc77a', '#e8c95a'];

/** The set piece is drawn closer than the village, so it reads at a glance. */
const SCALE = 1.8;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The proving grounds: simulated learners walk the trail to a bridge over a gorge with
 * planks missing. The first one stumbles, the owl flags it, the bridge is mended and they
 * all cross. A cohort finds the broken step so a real learner never has to.
 */
export function provingGrounds(group: THREE.Group) {
  const cx = onValley('learners', 330);
  const bx = cx + 40;
  const span = 96 * SCALE;
  const left = bx - span / 2;
  const right = bx + span / 2;
  const deckY = riverTop(bx) + 30 * SCALE;
  const ramp = 150;
  registerAnchors('learners', group, { bridge: { x: bx - 50, y: deckY + 40, w: 560, h: 270 } });

  // The trail climbs to the abutments, crosses the deck, and comes back down.
  const deck = (x: number) => deckY + Math.sin(Math.PI * ((x - left) / span)) * 7 * SCALE;
  const trail = (x: number) => {
    if (x > left && x < right) return deck(x) + 2;
    const lift = x <= left ? smooth(left - ramp, left, x) : 1 - smooth(right, right + ramp, x);
    return riverTop(x) + 1 + (deckY - riverTop(x) - 1) * lift;
  };

  // The gorge: a dark back wall with the cascade pouring through it, framed by two rocky
  // shoulders the trail runs over.
  const rough = fbm(57, 3);
  const rock = flatMaterial({ y0: riverTop(bx) - 10, y1: deckY + 40 });
  const backWall = flatMaterial({ y0: riverTop(bx) - 10, y1: deckY + 70 });
  const wallTop = (x: number) => deckY + 50 + 18 * rough(x / 40) - 34 * Math.exp(-(((x - bx) / 36) ** 2));
  const wallXs: number[] = [];
  const wallYs: number[] = [];
  for (let x = left - 20; x <= right + 20; x += 6) {
    wallXs.push(x);
    wallYs.push(wallTop(x));
  }
  const wall = new THREE.Mesh(silhouette(wallXs, wallYs, riverTop(bx) - 4), backWall);
  wall.position.z = 0.4;
  group.add(wall);

  const cascade = waterfallMaterial();
  const fallTop = wallTop(bx) - 3;
  const fallBottom = riverTop(bx) - 6;
  const cascadeMesh = new THREE.Mesh(bandGeometry([bx - 30, bx + 30], [fallTop, fallTop], [fallBottom, fallBottom]), cascade.material);
  (cascadeMesh.geometry.getAttribute('uv') as THREE.BufferAttribute).set([0, 0, 0, 1, 1, 0, 1, 1]);
  cascadeMesh.position.z = 0.41;
  group.add(cascadeMesh);

  for (const side of [-1, 1]) {
    const xs: number[] = [];
    const ys: number[] = [];
    const outer = side < 0 ? left - ramp - 30 : right + ramp + 30;
    const inner = side < 0 ? bx - 26 : bx + 26;
    const from = Math.min(outer, inner);
    const to = Math.max(outer, inner);
    for (let x = from; x <= to; x += 4) {
      // The shoulder follows the trail, then falls away in a cliff face to the cascade.
      const toCliff = side < 0 ? smooth(inner - 34, inner, x) : 1 - smooth(inner, inner + 34, x);
      const ground = trail(Math.min(Math.max(x, from), to)) - 3 + 3 * rough(x / 18);
      xs.push(x);
      ys.push(ground - toCliff * (deckY - riverTop(x) + 6));
    }
    const shoulder = new THREE.Mesh(silhouette(xs, ys, riverTop(bx) - 4), rock);
    shoulder.position.z = 0.46;
    group.add(shoulder);
  }

  const spray = mistMaterial([bx - 120, bx + 120]);
  const sprayMesh = new THREE.Mesh(bandGeometry([bx - 120, bx + 120], [fallBottom + 46, fallBottom + 46], [fallBottom - 14, fallBottom - 14]), spray.material);
  sprayMesh.position.z = 0.47;
  group.add(sprayMesh);

  // The bridge: planks on a gentle arch, the middle two missing until it is mended.
  const wood = new THREE.MeshBasicMaterial();
  const planks: THREE.Mesh[] = [];
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8;
    const px = left + t * span;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(span / 8 - 2, 4 * SCALE), wood);
    m.position.set(px, deck(px), 0.5);
    m.rotation.z = Math.cos(Math.PI * t) * 0.18;
    group.add(m);
    planks.push(m);
  }
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.PlaneGeometry(3 * SCALE, 20 * SCALE), wood);
    post.position.set(bx + (side * span) / 2, deckY + 8 * SCALE, 0.5);
    group.add(post);
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
  for (let k = 1; k < 8; k++) {
    const x = left + (k / 8) * span;
    const baluster = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * SCALE, 15 * SCALE), wood);
    baluster.position.set(x, deck(x) + 8.5 * SCALE, 0.5);
    group.add(baluster);
  }

  // Stage markers along the trail.
  const flagMat = new THREE.MeshBasicMaterial();
  for (const dx of [-470, -300, 330, 480]) {
    const x = cx + dx;
    const y = trail(x);
    const post = new THREE.Mesh(new THREE.PlaneGeometry(2.5 * SCALE, 34 * SCALE), wood);
    post.position.set(x, y + 17 * SCALE, 0.48);
    const flag = new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(16, -5), new THREE.Vector2(0, -10)])).scale(SCALE, SCALE, 1),
      flagMat,
    );
    flag.position.set(x + SCALE, y + 34 * SCALE, 0.49);
    group.add(post, flag);
  }

  // The owl on its post: it watches every stage and raises a flag when one breaks.
  const owlX = left - 70;
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
  const flagTex = badge('!', '#ffb547');
  const okTex = badge('✓', '#b9ef2e');
  const signalMat = new THREE.MeshBasicMaterial({ map: flagTex, transparent: true, depthWrite: false });
  const signalSize = 24 * SCALE;
  const signal = new THREE.Mesh(new THREE.PlaneGeometry(signalSize, signalSize), signalMat);
  const signalY = owlY + 104 * SCALE;
  signal.position.set(owlX, signalY, 0.6);
  group.add(signal);

  // The cohort.
  const count = PERSONAS.length;
  const people = peopleMaterial();
  const geo = new THREE.PlaneGeometry(12 * SCALE, 27 * SCALE);
  geo.translate(0, 13.5 * SCALE, 0);
  const colors = new Float32Array(count * 3);
  PERSONAS.forEach((hex, i) => {
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

  const PERIOD = 26;
  const SPEED = 74;
  const SPACING = 30 * SCALE;
  const START = cx - 700;
  const GAP = bx - 0.18 * span;
  const ARRIVE = (GAP - START) / SPEED;
  const FIXED = ARRIVE + 3.4;

  return (f: Frame) => {
    const { look } = f;
    const base = tone(look, 0.18, 0.1);
    wood.color.set(mixHex(base, '#7a5233', 0.55));
    flagMat.color.set(mixHex(base, '#e8c95a', 0.7));
    owlBody.color.set(mixHex(base, '#8a6a4f', 0.55));
    owlFace.color.set(mixHex('#fff3c4', '#ffd36b', look.windows));
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

    const T = f.time % PERIOD;
    const broken = T < FIXED;
    planks[3]!.visible = !broken;
    planks[4]!.visible = !broken;

    // The owl's signal: a flag from the first stumble until the fix, then a tick for a while.
    const flagged = T > ARRIVE && broken;
    const mended = !broken && T < FIXED + 3;
    signal.visible = flagged || mended;
    signalMat.map = flagged ? flagTex : okTex;
    const pop = flagged ? Math.min(1, (T - ARRIVE) * 4) : mended ? Math.min(1, (T - FIXED) * 4) : 0;
    signal.scale.setScalar(0.6 + 0.4 * pop);
    signal.position.y = signalY + Math.sin(f.time * 3) * 2;
    eyes.forEach((e) => (e.scale.y = Math.sin(f.time * 1.7) > 0.97 ? 0.15 : 1));

    for (let i = 0; i < count; i++) {
      let x = START - i * SPACING + T * SPEED;
      let crouch = 1;
      const stop = GAP - i * SPACING;
      const waiting = broken && x > stop;
      if (waiting) {
        x = stop;
        // The first to arrive stumbles at the edge, then waits with the others.
        if (i === 0) crouch = T - ARRIVE < 1.4 ? 0.72 + 0.28 * Math.abs(Math.sin((T - ARRIVE) * 6)) : 0.92;
      }
      walk[i] = waiting ? 0 : f.time * 7 + i;
      const visible = x > cx - 900 && x < cx + 700;
      const y = trail(x) + (waiting ? 0 : Math.abs(Math.sin(f.time * 7 + i)) * 1.2);
      m.makeScale(visible ? 1 : 0, visible ? crouch : 0, 1).setPosition(x, y, 0);
      crowd.setMatrixAt(i, m);
    }
    (geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    crowd.instanceMatrix.needsUpdate = true;
  };
}

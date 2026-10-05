import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { peopleMaterial } from '../gl/sprites.ts';
import { bandGeometry, waterfallMaterial } from '../gl/water.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { riverTop } from './valley.ts';
import { onValley } from './village.ts';

/** A round badge with a glyph, painted once; the owl raises one over its head. */
function badge(glyph: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(48, 48, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16131c';
    ctx.font = '700 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 48, 52);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** The five learner personas, each in its own scarf colour. */
const PERSONAS = ['#7fb2e8', '#f0a35e', '#b892e0', '#8cc77a', '#e8c95a'];

/**
 * The proving grounds: simulated learners walk the trail to a bridge with planks missing.
 * The first one stumbles, the owl flags it, the bridge is mended and they all cross. A cohort
 * finds the broken step so a real learner never has to.
 */
export function provingGrounds(group: THREE.Group) {
  const cx = onValley('learners', 330);
  const bx = cx + 40;
  const deckY = riverTop(bx) + 16;

  // A small cascade coming down the bank under the bridge.
  const cascade = waterfallMaterial();
  const top = riverTop(bx) + 74;
  const cascadeMesh = new THREE.Mesh(bandGeometry([bx - 14, bx + 14], [top, top], [riverTop(bx) - 4, riverTop(bx) - 4]), cascade.material);
  const uv = cascadeMesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
  uv.set([0, 0, 0, 1, 1, 0, 1, 1]);
  cascadeMesh.position.z = 0.42;
  group.add(cascadeMesh);

  // The bridge: planks on a gentle arch, the middle two missing until it is mended.
  const wood = new THREE.MeshBasicMaterial();
  const planks: THREE.Mesh[] = [];
  const span = 96;
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8;
    const px = bx - span / 2 + t * span;
    const py = deckY + Math.sin(Math.PI * t) * 7;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(span / 8 - 1.5, 4), wood);
    m.position.set(px, py, 0.5);
    m.rotation.z = Math.cos(Math.PI * t) * 0.18;
    group.add(m);
    planks.push(m);
  }
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.PlaneGeometry(3, 18), wood);
    post.position.set(bx + (side * span) / 2, deckY + 8, 0.5);
    group.add(post);
  }
  const rail = new THREE.Mesh(new THREE.PlaneGeometry(span, 2), wood);
  rail.position.set(bx, deckY + 16, 0.5);
  group.add(rail);

  // Stage markers along the trail.
  const flagMat = new THREE.MeshBasicMaterial();
  for (const [k, dx] of [-460, -280, 300, 470].entries()) {
    const x = cx + dx;
    const y = riverTop(x) + 1;
    const post = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 34), wood);
    post.position.set(x, y + 17, 0.48);
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(16, -5), new THREE.Vector2(0, -10)])), flagMat);
    flag.position.set(x + 1, y + 34, 0.49);
    flag.userData.phase = k;
    group.add(post, flag);
  }

  // The owl on its post: it watches every stage and raises a flag when one breaks.
  const owlX = bx - 92;
  const owlY = riverTop(owlX) + 1;
  const owlBody = new THREE.MeshBasicMaterial();
  const owlFace = new THREE.MeshBasicMaterial();
  const owl = new THREE.Group();
  owl.position.set(owlX, owlY, 0.5);
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
  const signal = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), signalMat);
  signal.position.set(owlX, owlY + 100, 0.6);
  group.add(signal);

  // The cohort.
  const count = PERSONAS.length;
  const people = peopleMaterial();
  const geo = new THREE.PlaneGeometry(12, 27);
  geo.translate(0, 13.5, 0);
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

  const PERIOD = 27;
  const SPEED = 58;
  const START = cx - 640;
  const GAP = bx - 12;
  const ARRIVE = (GAP - START) / SPEED;
  const FIXED = ARRIVE + 3.4;
  const deck = (x: number) => {
    const t = (x - (bx - span / 2)) / span;
    return t > 0 && t < 1 ? deckY + Math.sin(Math.PI * t) * 7 + 2 : riverTop(x) + 1;
  };

  return (f: Frame) => {
    const { look } = f;
    const base = tone(look, 0.18, 0.1);
    wood.color.set(mixHex(base, '#7a5233', 0.55));
    flagMat.color.set(mixHex(base, '#e8c95a', 0.7));
    owlBody.color.set(mixHex(base, '#8a6a4f', 0.55));
    owlFace.color.set(mixHex('#fff3c4', '#ffd36b', look.windows));
    cascade.uniforms.uWater.value.set(mixHex(look.water, look.skyHorizon, 0.4));
    cascade.uniforms.uLight.value.set(mixHex(look.snow, '#ffffff', 0.4));
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
    signal.position.y = owlY + 100 + Math.sin(f.time * 3) * 2;
    eyes.forEach((e) => (e.scale.y = Math.sin(f.time * 1.7) > 0.97 ? 0.15 : 1));

    for (let i = 0; i < count; i++) {
      let x = START - i * 64 + T * SPEED;
      let crouch = 1;
      if (broken) {
        const stop = GAP - i * 18;
        if (x > stop) {
          x = stop;
          // The first to arrive stumbles at the edge, then waits with the others.
          if (i === 0) crouch = T - ARRIVE < 1.4 ? 0.72 + 0.28 * Math.abs(Math.sin((T - ARRIVE) * 6)) : 0.92;
        }
      }
      const moving = !broken || x < GAP - i * 18;
      walk[i] = moving ? f.time * 9 + i : 0;
      const visible = x > cx - 900 && x < cx + 660;
      const y = deck(x) + (moving ? Math.abs(Math.sin(f.time * 9 + i)) * 0.8 : 0);
      m.makeScale(visible ? 1 : 0, visible ? crouch : 0, 1).setPosition(x, y, 0);
      crowd.setMatrixAt(i, m);
    }
    (geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    crowd.instanceMatrix.needsUpdate = true;
  };
}

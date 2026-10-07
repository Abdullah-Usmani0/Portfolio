import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { registerAnchors, type Anchor } from '../anchors.ts';
import { peopleMaterial, smoke } from '../gl/sprites.ts';
import { seeded, tone, type Frame } from './types.ts';
import { BELL, bellRinging, flashAt, LOOPS, managerAt, roundLength, STYLES, SURFACES, talkerSays, villageLayout, type HouseKind, type Surface, type VillageStep } from './villageLayout.ts';

const LIME = '#b9ef2e';
const INK = '#16131c';
const PAPER = '#f6f1ea';

function quad(out: number[], x0: number, y0: number, x1: number, y1: number) {
  out.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
}

/** A small picture painted once on a canvas: signs, bubbles, a portrait. */
function painted(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** The picture on each surface's sign and in the manager's bubble at its door, drawn in a 64 × 64 box. */
const ICONS: Record<Surface | 'studio' | 'voice', (ctx: CanvasRenderingContext2D) => void> = {
  chat(ctx) {
    ctx.beginPath();
    ctx.roundRect(10, 14, 44, 28, 9);
    ctx.moveTo(20, 42);
    ctx.lineTo(16, 52);
    ctx.lineTo(30, 42);
    ctx.stroke();
    for (const x of [22, 32, 42]) {
      ctx.beginPath();
      ctx.arc(x, 28, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  plan(ctx) {
    ctx.strokeRect(16, 12, 32, 42);
    ctx.fillRect(25, 8, 14, 7);
    for (const y of [24, 34, 44]) {
      ctx.beginPath();
      ctx.moveTo(21, y);
      ctx.lineTo(24, y + 3);
      ctx.lineTo(29, y - 3);
      ctx.moveTo(33, y);
      ctx.lineTo(43, y);
      ctx.stroke();
    }
  },
  review(ctx) {
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 33);
    ctx.lineTo(29, 40);
    ctx.lineTo(43, 25);
    ctx.stroke();
  },
  kickoff(ctx) {
    // A megaphone: the kickoff is where the manager welcomes the team.
    ctx.beginPath();
    ctx.moveTo(14, 26);
    ctx.lineTo(24, 26);
    ctx.lineTo(46, 14);
    ctx.lineTo(46, 50);
    ctx.lineTo(24, 38);
    ctx.lineTo(14, 38);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 38);
    ctx.lineTo(25, 50);
    ctx.stroke();
  },
  post(ctx) {
    ctx.strokeRect(12, 18, 40, 28);
    ctx.beginPath();
    ctx.moveTo(12, 18);
    ctx.lineTo(32, 34);
    ctx.lineTo(52, 18);
    ctx.stroke();
  },
  studio(ctx) {
    ctx.beginPath();
    ctx.roundRect(10, 20, 44, 30, 5);
    ctx.stroke();
    ctx.strokeRect(24, 14, 16, 6);
    ctx.beginPath();
    ctx.arc(32, 35, 9, 0, Math.PI * 2);
    ctx.stroke();
  },
  voice(ctx) {
    [8, 16, 26, 18, 10, 20, 12].forEach((h, k) => {
      ctx.beginPath();
      ctx.moveTo(14 + k * 6, 32 - h / 2);
      ctx.lineTo(14 + k * 6, 32 + h / 2);
      ctx.stroke();
    });
  },
};

/** A sign: the icon on a light board. */
const sign = (icon: (ctx: CanvasRenderingContext2D) => void) =>
  painted(64, 64, (ctx) => {
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.roundRect(2, 2, 60, 60, 12);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 4;
    icon(ctx);
  });

/** A speech bubble with a tail, holding an icon or a word or two. */
const bubble = (inner: (ctx: CanvasRenderingContext2D) => void, fill = PAPER) =>
  painted(128, 128, (ctx) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(6, 6, 116, 92, 24);
    ctx.moveTo(30, 96);
    ctx.lineTo(22, 122);
    ctx.lineTo(56, 96);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 5;
    ctx.save();
    ctx.translate(32, 20);
    ctx.scale(0.9, 0.9);
    inner(ctx);
    ctx.restore();
  });

const words = (s: string, size: number) => (ctx: CanvasRenderingContext2D) => {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 32, 32);
};

/** What the four villagers in the square say: the same thought in four voices. */
const SAID = [words('k.', 52), words('YES!!', 34), words('hmm…', 36), words('Thanks.', 28)];

/** The manager's portrait on the studio's easel. */
const portrait = () =>
  painted(96, 112, (ctx) => {
    ctx.fillStyle = '#2a2433';
    ctx.fillRect(0, 0, 96, 112);
    ctx.fillStyle = LIME;
    ctx.beginPath();
    ctx.ellipse(48, 108, 38, 30, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#efd9c3';
    ctx.beginPath();
    ctx.arc(48, 50, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3428';
    ctx.beginPath();
    ctx.arc(48, 44, 23, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.fillStyle = INK;
    for (const x of [40, 56]) {
      ctx.beginPath();
      ctx.arc(x, 52, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(48, 58, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();
  });

/**
 * The village of AI coworkers on the far bank. Each house is a place the same manager
 * works: chat, plan mode, the review of submitted work, the kickoff hall and the post
 * office that sends check-ins. The studio gives characters their faces and voices, and in
 * the square four villagers talk, each in their own way. Windows light up at dusk.
 */
export function village(group: THREE.Group) {
  const L = villageLayout();
  const rnd = seeded(42);
  const walls: number[] = [];
  const roofs: number[] = [];
  const windows: number[] = [];
  const doors: number[] = [];
  const chimneys: [number, number][] = [];
  for (const h of L.houses) {
    const { x0, w, base } = h;
    const hall = h.kind === 'kickoff';
    quad(walls, x0, base, x0 + w, base + h.h);
    roofs.push(x0 - 6, base + h.h, 0, x0 + w + 6, base + h.h, 0, x0 + w / 2, base + h.h + h.roof, 0);
    if (h.kind === 'home' || rnd() > 0.4) {
      const chx = x0 + w * (0.68 + rnd() * 0.12);
      quad(roofs, chx, base + h.h + h.roof * 0.3, chx + 7, base + h.h + h.roof * 0.95);
      chimneys.push([chx + 3.5, base + h.h + h.roof]);
    }
    const dw = hall ? 9 : 4.5;
    quad(doors, h.door - dw, base, h.door + dw, base + (hall ? 22 : 15));
    // Windows either side of the door; the studio has one big window above it instead.
    if (h.kind === 'studio') quad(windows, h.door - 20, base + 20, h.door + 20, base + 38);
    else
      for (const k of w > 50 ? [0.2, 0.8] : [0.22]) {
        const wx = x0 + w * k - 5;
        quad(windows, wx, base + h.h * 0.42, wx + 10, base + h.h * 0.42 + (hall ? 14 : 11));
      }
  }
  const mesh = (data: number[], z: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
    const m = new THREE.MeshBasicMaterial();
    const o = new THREE.Mesh(g, m);
    o.position.z = z;
    group.add(o);
    return m;
  };
  const wallMat = mesh(walls, 0.5);
  const roofMat = mesh(roofs, 0.51);
  const winMat = mesh(windows, 0.52);
  const doorMat = mesh(doors, 0.521);

  const chimneySmoke = smoke(chimneys);
  chimneySmoke.points.position.z = 0.53;
  group.add(chimneySmoke.points);

  // A sign over each door: what the manager does in there.
  const signMat = (kind: Surface | 'studio') => new THREE.MeshBasicMaterial({ map: sign(ICONS[kind]), transparent: true, depthWrite: false });
  const signs: THREE.MeshBasicMaterial[] = [];
  for (const h of L.houses) {
    if (h.kind === 'home') continue;
    const material = signMat(h.kind);
    signs.push(material);
    const size = h.kind === 'kickoff' ? 15 : 12;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    // The studio's sign hangs in its gable, above the big window.
    s.position.set(h.door, h.kind === 'studio' ? h.base + h.h + h.roof * 0.36 : h.base + (h.kind === 'kickoff' ? 34 : 24), 0.525);
    group.add(s);
  }

  // The kickoff hall flies a lime pennant: it is where every scenario begins.
  const hall = L.house('kickoff');
  const pole = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 16), new THREE.MeshBasicMaterial({ color: '#3a3038' }));
  pole.position.set(hall.door, hall.base + hall.h + hall.roof + 7, 0.51);
  const pennantMat = new THREE.MeshBasicMaterial({ color: LIME, side: THREE.DoubleSide });
  const pennant = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(13, -3.5), new THREE.Vector2(0, -7)])), pennantMat);
  pennant.position.set(hall.door + 0.7, hall.base + hall.h + hall.roof + 15, 0.511);
  group.add(pole, pennant);

  // The post office: a mailbox by the door and a bell under the eaves that rings for a check-in.
  const post = L.house('post');
  const metal = new THREE.MeshBasicMaterial();
  const mailbox = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), new THREE.MeshBasicMaterial({ color: '#c9513f' }));
  mailbox.position.set(post.x0 + post.w + 6, post.base + 11, 0.54);
  const mailPost = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), metal);
  mailPost.position.set(post.x0 + post.w + 6, post.base + 4, 0.539);
  const bell = new THREE.Group();
  bell.position.set(post.x0 + post.w - 6, post.base + post.h - 1, 0.54);
  const bellBody = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#e8c95a' }));
  bellBody.rotation.z = Math.PI;
  bellBody.position.y = -3;
  const bellArm = new THREE.Mesh(new THREE.PlaneGeometry(1, 3), metal);
  bellArm.position.y = -1.5;
  bell.add(bellArm, bellBody);
  group.add(mailbox, mailPost, bell);

  // The studio: a flash in the big window, and an easel where the portrait appears.
  const studio = L.house('studio');
  const flashMat = new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(46, 24), flashMat);
  flash.position.set(studio.door, studio.base + 29, 0.523);
  const easelX = studio.x0 + studio.w - 12;
  const easelLegs = new THREE.Mesh(
    new THREE.ShapeGeometry([
      new THREE.Shape([new THREE.Vector2(-6, 0), new THREE.Vector2(-4.8, 0), new THREE.Vector2(0.6, 24), new THREE.Vector2(-0.6, 24)]),
      new THREE.Shape([new THREE.Vector2(6, 0), new THREE.Vector2(4.8, 0), new THREE.Vector2(-0.6, 24), new THREE.Vector2(0.6, 24)]),
    ]),
    metal,
  );
  easelLegs.position.set(easelX, studio.base, 0.54);
  const canvasMat = new THREE.MeshBasicMaterial({ map: portrait(), transparent: true, opacity: 0 });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(13, 15), canvasMat);
  canvas.position.set(easelX, studio.base + 16, 0.541);
  group.add(flash, easelLegs, canvas);

  // Speech: the manager's bubble at each door, the four voices in the square, an envelope
  // when the bell rings, a voice taking shape in the studio, and a ring over the one manager.
  const sprite = (map: THREE.Texture, w: number, h: number) => {
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.z = 0.6;
    m.visible = false;
    group.add(m);
    return { mesh: m, material };
  };
  const doorBubbles = {} as Record<Surface, THREE.Texture>;
  for (const s of SURFACES) doorBubbles[s] = bubble(ICONS[s]);
  const said = sprite(doorBubbles.chat, 17, 17);
  const talking = SAID.map((s) => sprite(bubble(s), 19, 19));
  const letter = sprite(doorBubbles.post, 17, 17);
  const voice = sprite(bubble(ICONS.voice, LIME), 17, 17);
  const ring = new THREE.Mesh(new THREE.RingGeometry(6, 7.4, 28), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, depthWrite: false }));
  ring.scale.y = 0.42;
  ring.position.z = 0.6;
  group.add(ring);

  // The villagers: six who walk about, four who talk in the square, and the manager.
  const WALKERS = 6;
  const MANAGER = WALKERS + STYLES.length;
  const count = MANAGER + 1;
  const people = peopleMaterial();
  const geo = new THREE.PlaneGeometry(12, 27);
  geo.translate(0, 13.5, 0);
  const colors = new Float32Array(count * 3);
  const walk = new Float32Array(count);
  const palette = ['#e2a46b', '#7fa9d6', '#c97b8e', '#8fbf7a', '#e9d27a', '#b59ad6'];
  // Half walk the lanes left of the square and half right of it, so the square is left to
  // the four who talk there.
  const lanes = [
    [L.houses[0]!.x0, L.square.x0 - 8],
    [L.square.x1 + 8, L.houses.at(-1)!.x0 + L.houses.at(-1)!.w],
  ] as const;
  const walkers = Array.from({ length: WALKERS }, (_, i) => {
    const [min, max] = lanes[i % 2]!;
    return { x: min + rnd() * (max - min), min, max, speed: 7 + rnd() * 8, dir: rnd() > 0.5 ? 1 : -1, phase: rnd() * 6 };
  });
  for (let i = 0; i < count; i++) {
    const c = new THREE.Color(i === MANAGER ? LIME : palette[i % palette.length]);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 1));
  const crowd = new THREE.InstancedMesh(geo, people.material, count);
  crowd.position.z = 0.55;
  crowd.frustumCulled = false;
  group.add(crowd);
  const m = new THREE.Matrix4();

  // Where the dive can fly, and what its labels ride on. The manager's anchor walks with them.
  const around = (kind: HouseKind): Anchor => {
    const h = L.house(kind);
    return { x: h.door, y: h.base + (h.h + h.roof) / 2, w: h.w + 34, h: h.h + h.roof + 24 };
  };
  const ground = L.ground(L.cx);
  // The manager's anchor sits at their feet: their name goes below them, their words above.
  const managerAnchor: Anchor = { x: L.doors[0]!, y: ground - 4, w: 14, h: 10 };
  const anchors: Record<string, Anchor> = {
    village: { x: L.cx - 20, y: ground + 44, w: 930, h: 150 },
    chat: around('chat'),
    plan: around('plan'),
    review: around('review'),
    kickoff: around('kickoff'),
    post: around('post'),
    studio: around('studio'),
    square: { x: (L.square.x0 + L.square.x1) / 2, y: ground + 26, w: L.square.x1 - L.square.x0 + 40, h: 96 },
    easel: { x: easelX, y: studio.base + 16, w: 14, h: 16 },
    bell: { x: bell.position.x, y: bell.position.y - 3, w: 8, h: 8 },
    manager: managerAnchor,
  };
  // The square's villagers stand close together, so every other one's name hangs a row lower.
  L.talkers.forEach((x, i) => (anchors[`talker${i}`] = { x, y: L.ground(x) + (i % 2 ? -10 : 12), w: 14, h: 24 }));
  registerAnchors('npcs', group, anchors);

  const STEPS = new Set<string>(['everywhere', 'styles', 'disposition', 'onemanager', 'checkins', 'faces']);
  let playing = 'loop';
  let step: VillageStep = 'loop';
  let stepStart = 0;

  return (f: Frame) => {
    const base = tone(f.look, 0.2, 0.2);
    wallMat.color.set(mixHex(base, '#f0e3cf', 0.6));
    roofMat.color.set(mixHex(base, '#7d3d33', 0.45));
    winMat.color.set(mixHex(mixHex(base, '#2a2433', 0.5), '#ffd08a', f.look.windows));
    doorMat.color.set(mixHex(base, '#3a2a26', 0.6));
    metal.color.set(mixHex(base, '#3a3038', 0.6));
    const signTint = mixHex(base, '#ffffff', 0.75);
    for (const s of signs) s.color.set(signTint);
    chimneySmoke.uniforms.uColor.value.set(mixHex(f.look.skyHorizon, '#ffffff', 0.4));
    chimneySmoke.uniforms.uAlpha.value = 0.42;
    people.uniforms.uShade.value.set(tone(f.look, 0.1));
    pennant.scale.y = 1 + 0.12 * Math.sin(f.time * 4);

    // The dive's step decides what the village does, and each step plays from its start.
    const key = f.dive?.scene === 'npcs' ? f.dive.step : 'loop';
    if (key !== playing) {
      playing = key;
      step = STEPS.has(key) ? (key as VillageStep) : 'loop';
      stepStart = f.time;
    }
    const loop = LOOPS[step] || roundLength(L);
    const t = (f.time - stepStart) % loop;

    walkers.forEach((w, i) => {
      w.x += w.dir * w.speed * f.dt;
      if (w.x > w.max) w.dir = -1;
      if (w.x < w.min) w.dir = 1;
      w.phase += f.dt * w.speed * 0.55;
      walk[i] = w.phase;
      m.makeScale(w.dir, 1, 1).setPosition(w.x, L.ground(w.x) + Math.abs(Math.sin(w.phase)) * 0.8, 0);
      crowd.setMatrixAt(i, m);
    });
    L.talkers.forEach((x, k) => {
      const i = WALKERS + k;
      const speaking = talkerSays(step, t, k);
      // A speaker bobs a little as they talk.
      walk[i] = 0;
      m.makeScale(k % 2 ? -1 : 1, 1, 1).setPosition(x, L.ground(x) + (speaking ? Math.abs(Math.sin(f.time * 6 + k)) * 0.7 : 0), 0);
      crowd.setMatrixAt(i, m);
      const b = talking[k]!;
      b.mesh.visible = speaking;
      b.mesh.position.set(x + 6, L.ground(x) + 39 + Math.sin(f.time * 2 + k) * 0.6, 0.6);
    });

    const pose = managerAt(L, step, t);
    const my = L.ground(pose.x);
    walk[MANAGER] = pose.walking ? f.time * 6 : 0;
    m.makeScale(1.12 * pose.face, 1.12, 1).setPosition(pose.x, my + (pose.walking ? Math.abs(Math.sin(f.time * 6)) * 0.8 : 0), 0);
    crowd.setMatrixAt(MANAGER, m);
    managerAnchor.x = pose.x;
    managerAnchor.y = my - 4;
    // At each door on the round the manager says something in that place's way; in the
    // chat step, the chat bubble stays up.
    const atDoor = pose.at && (step === 'loop' || step === 'everywhere' || step === 'disposition') ? pose.at : null;
    said.mesh.visible = atDoor !== null && pose.since > 0.15;
    if (atDoor) said.material.map = doorBubbles[atDoor];
    said.mesh.position.set(pose.x + 7, my + 42 + Math.sin(f.time * 2.4) * 0.6, 0.6);
    // The one manager of a scenario wears a ring over their head.
    ring.visible = step === 'onemanager' && t > 0.8;
    ring.position.set(pose.x, my + 38 + Math.sin(f.time * 2) * 0.8, 0.6);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * Math.sin(f.time * 3);

    // The bell swings while it rings; a letter goes out.
    const ringing = bellRinging(step, t);
    bell.rotation.z = ringing ? Math.sin(f.time * 28) * 0.5 * (1 - (t - BELL.at) / BELL.for) : 0;
    letter.mesh.visible = step === 'checkins' && t > BELL.at + 0.2 && t < BELL.at + 3;
    letter.mesh.position.set(post.door + 6, post.base + post.h + post.roof + 10 + (t - BELL.at) * 3, 0.6);

    // The studio's flash, the portrait on the easel, and a voice taking shape.
    flashMat.opacity = 0.85 * flashAt(step, t);
    canvasMat.opacity = step === 'faces' ? Math.min(1, Math.max(0, (t - 1.4) * 2)) : 0;
    voice.mesh.visible = step === 'faces' && t > 4.4 && t < 8;
    voice.mesh.position.set(pose.x + 7, my + 42, 0.6);

    (geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    crowd.instanceMatrix.needsUpdate = true;
  };
}

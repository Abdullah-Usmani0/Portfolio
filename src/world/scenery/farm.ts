import * as THREE from 'three';
import { mixHex, smootherstep } from '@/motion/color.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { registerAnchors, type Anchor } from '../anchors.ts';
import { peopleMaterial } from '../gl/sprites.ts';
import { bandGeometry } from '../gl/water.ts';
import { Painter, anchorOfBox, cutUniform, paletteMaterial } from './cutaway.ts';
import { barnInterior, millInterior, siloInterior, type FarmInterior } from './farmInteriors.ts';
import { CART, CRATE, ROWS, crateAt, farmLayout } from './farmLayout.ts';
import { interiorKit } from './interiors.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { groundY, riverBottom } from './valley.ts';

/**
 * The farm, where scenarios are grown. Striped fields over a rolling hill (each row a
 * category of a focus, ranked by impact), farmers working them and a scarecrow with a
 * clipboard (the critic); a cart bringing cards to the barn, where they are assembled into
 * scenarios and crated; a chute down to the dock, where an inspector stamps every crate:
 * passed ones float downstream to the learners, the rest go back up or are set aside. The
 * windmill never stops (the work queues) and the silo keeps what was made (reuse). In a
 * dive, the barn, silo and windmill open up.
 */

const S = {
  barn: 0,
  barnShade: 1,
  roof: 2,
  trim: 3,
  silo: 4,
  siloBand: 5,
  mill: 6,
  millCap: 7,
  wood: 8,
  woodDark: 9,
  sail: 10,
  straw: 11,
  coat: 12,
  dark: 13,
} as const;
const SLOTS = 14;

/** Which building each dive step opens. */
const OPENS: Readonly<Record<string, number>> = { barn: 0, wgll: 0, silo: 1, machinery: 2 };
const BUILDINGS = 3;

const CROPS = ['#d8b45b', '#7d9d4b', '#c99a4a', '#93ad59', '#e0c27a', '#6f8f45', '#c4a456'];

export function farm(group: THREE.Group) {
  const L = farmLayout();
  const { cx, x0, x1, hillTop } = L;

  // The hill.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = x0; x <= x1; x += 6) {
    xs.push(x);
    ys.push(hillTop(x));
  }
  const hill = flatMaterial({ y0: -300, y1: -150 });
  const hillMesh = new THREE.Mesh(silhouette(xs, ys, -305), hill);
  hillMesh.position.z = 0.3;
  group.add(hillMesh);

  // Field rows following the hill's curve: one per category, the most impactful on top.
  const rows = CROPS.slice(0, ROWS).map((crop, k) => {
    const a = 9 + k * 16;
    const b = a + 10;
    const top = xs.map((x, i) => Math.max(groundY(x), ys[i]! - a));
    const bot = xs.map((x, i) => Math.max(groundY(x), ys[i]! - b));
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(bandGeometry(xs, top, bot), mat);
    mesh.position.z = 0.31;
    group.add(mesh);
    return { mat, crop };
  });
  const furrow = fbm(7, 2);

  // Buildings, the scarecrow and the chute, painted in one mesh.
  const body = new Painter((s) => s === S.barn || s === S.silo || s === S.mill);
  const { barn: b, silo: s, mill: m, scarecrow: sc } = L;

  body.begin(0);
  {
    const { x, y, w, h } = b;
    body.rect(x, y, x + w, y + h, S.barn);
    // A gambrel roof.
    const ridge: [number, number][] = [
      [x - 6, y + h],
      [x + 20, y + h + 30],
      [x + w / 2, y + h + 50],
      [x + w - 20, y + h + 30],
      [x + w + 6, y + h],
    ];
    for (let k = 0; k < ridge.length - 1; k++) body.tri(x + w / 2, y + h, ridge[k]![0], ridge[k]![1], ridge[k + 1]![0], ridge[k + 1]![1], S.roof);
    for (let k = 0; k < ridge.length - 1; k++) body.bar(ridge[k]![0], ridge[k]![1], ridge[k + 1]![0], ridge[k + 1]![1], 3.2, S.trim, false);
    body.rect(x + w / 2 - 9, y + h + 6, x + w / 2 + 9, y + h + 26, S.dark);
    // Corner boards and the big doors, X-braced.
    body.rect(x, y, x + 4, y + h, S.trim, true);
    body.rect(x + w - 4, y, x + w, y + h, S.trim, true);
    const dx = x + w / 2;
    body.rect(dx - 29, y, dx + 29, y + 52, S.trim, true);
    for (const [a, c] of [
      [dx - 27, dx - 1.2],
      [dx + 1.2, dx + 27],
    ] as const) {
      body.rect(a, y, c, y + 50, S.barnShade, true);
      body.bar(a + 1.5, y + 1.5, c - 1.5, y + 48.5, 2.2, S.trim, true);
      body.bar(a + 1.5, y + 48.5, c - 1.5, y + 1.5, 2.2, S.trim, true);
    }
    // The hatch the crates leave by.
    body.rect(x + w - 10, y + 12, x + w - 1, y + 30, S.dark, true);
  }
  body.begin(1);
  {
    const { x, y, w, h } = s;
    body.rect(x, y, x + w, y + h, S.silo);
    for (let yy = y + 20; yy < y + h; yy += 20) body.rect(x, yy, x + w, yy + 2, S.siloBand, true);
    body.dome(x + w / 2, y + h, w / 2 + 2, S.roof);
    // A ladder up the side.
    body.bar(x - 7, y, x - 7, y + h, 1.5, S.woodDark);
    body.bar(x - 2, y, x - 2, y + h, 1.5, S.woodDark);
    for (let yy = y + 6; yy < y + h; yy += 7) body.rect(x - 7, yy, x - 2, yy + 1.1, S.woodDark);
  }
  body.begin(2);
  {
    const { x, base, h, half, top } = m;
    body.quadPoints(x - half, base, x + half, base, x + top, base + h, x - top, base + h, S.mill);
    body.rect(x - 6, base, x + 6, base + 19, S.dark, true);
    body.rect(x - 4, base + 58, x + 4, base + 68, S.dark, true);
    body.rect(x - 3, base + 98, x + 3, base + 107, S.dark, true);
    body.rect(x - top - 5, base + h - 4, x + top + 5, base + h, S.woodDark);
    body.tri(x - top - 8, base + h, x + top + 8, base + h, x, base + h + 26, S.millCap);
    // The sails sweep this far: frame them too.
    const box = body.boxes[2]!;
    box.x0 = Math.min(box.x0, x - m.sail);
    box.x1 = Math.max(box.x1, x + m.sail);
    box.y1 = Math.max(box.y1, base + h + 6 + m.sail);
  }
  body.end();
  {
    // The scarecrow, keeping notes on the rows: the critic.
    const { x, base } = sc;
    const k = 1.3;
    body.bar(x, base, x, base + 46 * k, 2.8, S.woodDark);
    body.bar(x - 16 * k, base + 34 * k, x + 16 * k, base + 34 * k, 2.4, S.woodDark);
    body.quadPoints(x - 9 * k, base + 16 * k, x + 9 * k, base + 16 * k, x + 7 * k, base + 36 * k, x - 7 * k, base + 36 * k, S.coat);
    body.bar(x - 15 * k, base + 33 * k, x - 6 * k, base + 34 * k, 5, S.coat);
    body.bar(x + 6 * k, base + 34 * k, x + 15 * k, base + 33 * k, 5, S.coat);
    body.disc(x, base + 42 * k, 6.5, S.straw);
    body.tri(x - 8, base + 45 * k, x + 8, base + 45 * k, x, base + 57 * k, S.dark);
    body.bar(x - 12, base + 45 * k, x + 12, base + 45 * k, 2, S.dark);
    body.rect(x + 17, base + 30, x + 26, base + 43, S.trim);
  }
  {
    // The chute: a trough on posts, from the barn down to the dock.
    const c = L.chute;
    for (let k = 0; k < c.length - 1; k++) {
      const [ax, ay] = c[k]!;
      const [bx, by] = c[k + 1]!;
      body.bar(ax, ay - 3.5, bx, by - 3.5, 7, S.wood);
      body.bar(ax, ay, bx, by, 2, S.woodDark);
    }
    for (let k = 4; k < c.length - 1; k += 5) {
      const [px, py] = c[k]!;
      const ground = px <= x1 ? hillTop(px) : groundY(px);
      body.bar(px, py - 6, px, ground - 2, 2, S.woodDark);
    }
  }
  const cut = cutUniform(BUILDINGS);
  const palette = paletteMaterial(cut, SLOTS);
  const bodyMesh = body.mesh(palette.material);
  bodyMesh.position.z = 0.45;
  group.add(bodyMesh);

  // The sails, turning; they fade with the windmill's wall, so its gears show in a dive.
  const sailPaint = new Painter(() => true);
  sailPaint.begin(2);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const p = (r: number, off: number): [number, number] => [ca * r - sa * off, sa * r + ca * off];
    const [ax, ay] = p(16, 2.5);
    const [bx, by] = p(m.sail, 2.5);
    const [cx2, cy2] = p(m.sail, 20);
    const [dx2, dy2] = p(22, 17);
    sailPaint.quadPoints(ax, ay, bx, by, cx2, cy2, dx2, dy2, S.sail);
    // The lattice over the cloth.
    for (let r = 26; r < m.sail; r += 12) {
      const [lx0, ly0] = p(r, 2.5);
      const [lx1, ly1] = p(r, 19);
      sailPaint.bar(lx0, ly0, lx1, ly1, 1.2, S.woodDark);
    }
    sailPaint.bar(...p(16, 19.5), ...p(m.sail, 19.5), 1.4, S.woodDark);
    sailPaint.bar(0, 0, ca * m.sail, sa * m.sail, 4, S.woodDark);
  }
  sailPaint.disc(0, 0, 6.5, S.woodDark);
  const sails = sailPaint.mesh(palette.material);
  sails.position.set(m.x, m.base + m.h + 6, 0.46);
  group.add(sails);

  // Inside the barn, the silo and the windmill.
  const kit = interiorKit();
  const interiors: FarmInterior[] = [barnInterior(kit, b), siloInterior(kit, s), millInterior(kit, m)];
  for (const room of interiors) group.add(room.group);
  const opening = interiors.map(() => 0);

  // The dock, out over the water.
  const dockPaint = new Painter(() => false);
  {
    const { x0: d0, x1: d1, top } = L.dock;
    for (const px of [d0 + 6, d0 + 40, d0 + 74, d1 - 6]) dockPaint.rect(px - 1.6, top - 24, px + 1.6, top - 11, S.woodDark);
    dockPaint.rect(d0, top - 12, d1, top + 1, S.wood);
    for (let px = d0 + 9; px < d1; px += 9) dockPaint.bar(px, top - 12, px, top + 1, 0.8, S.woodDark);
    dockPaint.rect(d1 - 11, top + 1, d1 - 6, top + 7, S.woodDark);
  }
  const dockMesh = dockPaint.mesh(palette.material);
  dockMesh.position.z = 0.61;
  group.add(dockMesh);

  // Crates, each with the stamp it got.
  const crateMats = { box: new THREE.MeshBasicMaterial(), lid: new THREE.MeshBasicMaterial() };
  const markMats = { pass: new THREE.MeshBasicMaterial({ color: '#b9ef2e' }), reask: new THREE.MeshBasicMaterial({ color: '#ffc45c' }), reject: new THREE.MeshBasicMaterial({ color: '#ff6a55' }) };
  const crates = Array.from({ length: CRATE.crates }, () => {
    const c = new THREE.Group();
    c.add(new THREE.Mesh(new THREE.PlaneGeometry(19, 14).translate(0, 7, 0), crateMats.box));
    c.add(new THREE.Mesh(new THREE.PlaneGeometry(20.5, 3).translate(0, 14, 0), crateMats.lid));
    c.add(new THREE.Mesh(new THREE.PlaneGeometry(19, 1.4).translate(0, 7, 0.0005), crateMats.lid));
    const mark = new THREE.Mesh(new THREE.CircleGeometry(3.6, 14).translate(0, 7, 0.001), markMats.pass);
    c.add(mark);
    c.position.z = 0.62;
    group.add(c);
    return { c, mark };
  });

  // The inspector's stamp, and its flash.
  const stamp = new THREE.Group();
  stamp.add(new THREE.Mesh(new THREE.PlaneGeometry(2.8, 11).translate(0, 9, 0), crateMats.lid));
  stamp.add(new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6).translate(0, 2.4, 0), crateMats.lid));
  stamp.position.z = 0.64;
  group.add(stamp);
  const flashMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Mesh(new THREE.CircleGeometry(15, 20), flashMat);
  flash.position.z = 0.645;
  group.add(flash);

  // The cart: brings the cards to the barn.
  const cartMats = { wood: new THREE.MeshBasicMaterial(), dark: new THREE.MeshBasicMaterial(), card: new THREE.MeshBasicMaterial() };
  const cart = new THREE.Group();
  cart.add(new THREE.Mesh(new THREE.PlaneGeometry(24, 7).translate(0, 8.5, 0), cartMats.wood));
  cart.add(new THREE.Mesh(new THREE.PlaneGeometry(26, 1.6).translate(0, 12, 0.001), cartMats.dark));
  const handle = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.4).translate(-17, 14, 0), cartMats.dark);
  handle.rotation.z = 0.35;
  cart.add(handle);
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.CircleGeometry(5, 16), cartMats.dark));
  for (let k = 0; k < 2; k++) {
    const spoke = new THREE.Mesh(new THREE.PlaneGeometry(9, 1), cartMats.wood);
    spoke.rotation.z = (k * Math.PI) / 2;
    spoke.position.z = 0.001;
    wheel.add(spoke);
  }
  wheel.position.set(0, 5, 0.002);
  cart.add(wheel);
  const cards = [0, 1, 2].map((k) => {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), cartMats.card);
    card.position.set(-7 + k * 7, 17, 0.003);
    card.rotation.z = (k - 1) * 0.12;
    cart.add(card);
    return card;
  });
  cart.position.z = 0.47;
  cart.scale.setScalar(1.3);
  group.add(cart);

  // People: farmers in the rows, the cart's pusher, a hand at the barn, a climber on the silo.
  const farmers = L.farmers.length;
  const crowdN = farmers + 3;
  const people = peopleMaterial();
  // Bright work clothes, so the farmers read against the striped rows.
  people.uniforms.uMix.value = 0.86;
  const geo = new THREE.PlaneGeometry(14, 31);
  geo.translate(0, 15.5, 0);
  const colors = new Float32Array(crowdN * 3);
  const walk = new Float32Array(crowdN);
  const tints = ['#f4f0e6', '#4f8fd8', '#e0533f', '#f4f0e6', '#e0533f', '#4f8fd8', '#f2b33d', '#f4f0e6', '#e0533f'];
  tints.slice(0, crowdN).forEach((hex, i) => {
    const c = new THREE.Color(hex);
    colors.set([c.r, c.g, c.b], i * 3);
  });
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 1));
  const crowd = new THREE.InstancedMesh(geo, people.material, crowdN);
  crowd.position.z = 0.48;
  crowd.frustumCulled = false;
  group.add(crowd);
  // The inspector stands on the dock, in front of the water.
  const inspGeo = new THREE.PlaneGeometry(14, 31);
  inspGeo.translate(0, 15.5, 0);
  inspGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array([0.73, 0.94, 0.18]), 3));
  const inspWalk = new Float32Array(1);
  inspGeo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(inspWalk, 1));
  const inspector = new THREE.InstancedMesh(inspGeo, people.material, 1);
  inspector.position.z = 0.63;
  inspector.frustumCulled = false;
  group.add(inspector);
  const mtx = new THREE.Matrix4();

  // Where the camera can fly, and what the labels ride on.
  const boxOf = (k: number) => anchorOfBox(body.boxes[k]!);
  const dockTop = L.dock.top;
  const anchors: Record<string, Anchor> = {
    farm: { x: (x0 + L.dock.x1) / 2, y: (riverBottom(cx) + m.base + m.h + m.sail) / 2, w: L.dock.x1 - x0 + 60, h: m.base + m.h + m.sail - riverBottom(cx) + 20 },
    fields: { x: (x0 + s.x - 20) / 2, y: (groundY(cx) + m.base + m.h + m.sail) / 2 - 10, w: s.x - 20 - x0, h: m.base + m.h + m.sail - groundY(cx) + 10 },
    barn: boxOf(0),
    silo: boxOf(1),
    // The tower only: the sails would leave it tiny in the frame.
    windmill: { x: m.x, y: m.base + m.h / 2 + 8, w: m.half * 2 + 24, h: m.h + 30 },
    dock: { x: (L.dock.x0 + L.dock.x1) / 2 - 20, y: dockTop + 14, w: L.dock.x1 - L.dock.x0 + 80, h: 70 },
    critic: { x: sc.x, y: sc.base + 40, w: 52, h: 80 },
    inspector: { x: L.inspectAt + 16, y: dockTop + 34, w: 10, h: 10 },
    downstream: { x: L.downstream.x, y: L.downstream.y, w: 0, h: 0 },
    ...Object.fromEntries(Array.from({ length: ROWS }, (_, k) => [`row${k}`, { x: cx - 300, y: L.rowY(cx - 300, k), w: 0, h: 8 }])),
    ...interiors.reduce<Record<string, Anchor>>((all, room) => ({ ...all, ...room.anchors }), {}),
  };
  registerAnchors('scenarios', group, anchors);

  let rowStart = -1;

  return (f: Frame) => {
    const { look } = f;
    const base = tone(look, 0.25, 0.4);
    hill.uniforms.uTop.value.set(mixHex(base, look.haze, 0.1));
    hill.uniforms.uBottom.value.set(mixHex(base, look.shade, 0.3));

    // In the fields step the rows light up in order, most impactful first.
    const fields = f.dive?.scene === 'scenarios' && f.dive.step === 'fields';
    if (fields && rowStart < 0) rowStart = f.time;
    if (!fields) rowStart = -1;
    rows.forEach((r, k) => {
      let c = mixHex(tone(look, 0.24, 0.1), r.crop, 0.55 - k * 0.03 + 0.03 * furrow(f.time * 0.02 + k));
      if (rowStart >= 0) {
        const lt = (f.time - rowStart - 1) % 7.5;
        const lit = Math.exp(-(((lt - k * 0.55) / 0.3) ** 2));
        c = mixHex(c, '#d6ff6b', 0.75 * lit + (lt > k * 0.55 ? 0.12 : 0) * (f.time - rowStart > 1 ? 1 : 0));
      }
      r.mat.color.set(c);
    });

    const pal = palette.colors;
    const wall = mixHex(tone(look, 0.2), '#efe4d2', 0.6);
    pal[S.barn]!.set(mixHex(tone(look, 0.2), '#a8463a', 0.64));
    pal[S.barnShade]!.set(mixHex(tone(look, 0.2), '#8c3a31', 0.6));
    pal[S.roof]!.set(mixHex(tone(look, 0.2), '#4d4a52', 0.55));
    pal[S.trim]!.set(mixHex(tone(look, 0.2), '#f6efe4', 0.72));
    pal[S.silo]!.set(mixHex(wall, '#d9dde0', 0.3));
    pal[S.siloBand]!.set(mixHex(tone(look, 0.2), '#9aa3ab', 0.5));
    pal[S.mill]!.set(mixHex(tone(look, 0.2), '#7a5b43', 0.66));
    pal[S.millCap]!.set(mixHex(tone(look, 0.2), '#5e2f28', 0.62));
    pal[S.wood]!.set(mixHex(tone(look, 0.2), '#a87a4c', 0.62));
    pal[S.woodDark]!.set(mixHex(tone(look, 0.2), '#4a3220', 0.66));
    pal[S.sail]!.set(mixHex(tone(look, 0.2), '#f3e6cc', 0.74));
    pal[S.straw]!.set(mixHex(tone(look, 0.2), '#e0c27a', 0.7));
    pal[S.coat]!.set(mixHex(tone(look, 0.2), '#6a5a9a', 0.6));
    pal[S.dark]!.set(mixHex(tone(look, 0.2), '#2a2433', 0.6));
    sails.rotation.z = -f.time * 0.6;

    crateMats.box.color.set(mixHex(tone(look, 0.2), '#b88552', 0.66));
    crateMats.lid.color.set(mixHex(tone(look, 0.2), '#5c3f28', 0.62));
    cartMats.wood.color.set(pal[S.wood]!);
    cartMats.dark.color.set(pal[S.woodDark]!);
    cartMats.card.color.set(mixHex(tone(look, 0.2), '#fbf6ec', 0.78));

    // Crates: out of the barn, down the chute, stamped on the dock, then on their way.
    let stampNow = 0;
    let stampMark: keyof typeof markMats = 'pass';
    crates.forEach(({ c, mark }, k) => {
      const st = crateAt(L, f.time, k);
      c.visible = st.visible;
      if (!st.visible) return;
      c.position.set(st.x, st.y, 0.62);
      c.rotation.z = st.tilt;
      mark.visible = st.mark !== null;
      if (st.mark) mark.material = markMats[st.mark];
      if (st.stamp > stampNow) {
        stampNow = st.stamp;
        stampMark = st.mark ?? 'pass';
      }
    });
    stamp.position.set(L.inspectAt, dockTop + 5 + 15 + 12 * (1 - stampNow), 0.64);
    flash.position.set(L.inspectAt, dockTop + 13, 0.645);
    flashMat.color.set(markMats[stampMark].color).multiplyScalar(0.55 * Math.max(0, stampNow * 2 - 1));
    flash.visible = stampNow > 0.5;

    // The cart's round.
    const ct = f.time % CART.period;
    const { a: ca, b: cb } = L.cartPath;
    const goingOut = ct < CART.there;
    const back = ct >= CART.unload && ct < CART.back;
    const cxNow = goingOut ? ca + (cb - ca) * smootherstep(ct / CART.there) : back ? cb + (ca - cb) * smootherstep((ct - CART.unload) / (CART.back - CART.unload)) : ct < CART.unload ? cb : ca;
    const dir = back ? -1 : 1;
    cart.position.set(cxNow, hillTop(cxNow) - 4, 0.47);
    cart.scale.x = dir * 1.3;
    const rolling = goingOut || back;
    wheel.rotation.z = -cxNow / 5;
    cards.forEach((card, k) => {
      if (ct < CART.there) card.visible = true;
      else if (ct < CART.unload) card.visible = ct < CART.there + 0.5 + k * 0.5;
      else if (ct < CART.back) card.visible = false;
      else card.visible = ct > CART.back + 0.6 + k * 1;
    });

    // Farmers pace their rows, crouching now and then to pick.
    people.uniforms.uShade.value.set(tone(look, 0.1));
    L.farmers.forEach((fm, i) => {
      const t = f.time * 0.22 + i * 1.9;
      const x = fm.x + Math.sin(t) * fm.range;
      const vx = Math.cos(t);
      const crouch = (f.time + i * 2.3) % 6 < 1.2 ? 0.74 : 1;
      walk[i] = crouch < 1 ? 0 : f.time * 3 + i;
      mtx.makeScale(vx >= 0 ? 1 : -1, crouch, 1).setPosition(x, L.rowY(x, fm.row) - 9, 0);
      crowd.setMatrixAt(i, mtx);
    });
    // The cart's pusher, behind it.
    const px = cxNow - dir * 28;
    walk[farmers] = rolling ? f.time * 7 : 0;
    mtx.makeScale(dir, 1, 1).setPosition(px, hillTop(px) - 3, 0);
    crowd.setMatrixAt(farmers, mtx);
    // A hand at the barn door.
    walk[farmers + 1] = 0.3 * Math.sin(f.time * 1.4);
    mtx.makeScale(-1, 1, 1).setPosition(b.x + b.w / 2 + 38, b.y - 1, 0);
    crowd.setMatrixAt(farmers + 1, mtx);
    // The silo's climber, up and down the ladder.
    const cl = (f.time * 0.07) % 1;
    const up = cl < 0.5 ? smootherstep(cl * 2) : 1 - smootherstep((cl - 0.5) * 2);
    walk[farmers + 2] = f.time * 6;
    mtx.makeScale(0.82, 0.82, 1).setPosition(s.x - 4.5, s.y + up * (s.h - 30), 0);
    crowd.setMatrixAt(farmers + 2, mtx);
    (geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    crowd.instanceMatrix.needsUpdate = true;
    inspWalk[0] = 0.2 * Math.sin(f.time * 2);
    mtx.makeScale(-1, 1 - 0.05 * stampNow, 1).setPosition(L.inspectAt + 18, dockTop + 1, 0);
    inspector.setMatrixAt(0, mtx);
    (inspGeo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    inspector.instanceMatrix.needsUpdate = true;

    // A dive opens the building its step is about; every other wall closes.
    const open = f.dive?.scene === 'scenarios' ? (OPENS[f.dive.step] ?? -1) : -1;
    const ease = 1 - Math.exp(-4 * f.dt);
    let anyOpen = false;
    opening.forEach((v, k) => {
      const want = k === open ? (f.dive?.t ?? 0) : 0;
      opening[k] = v + (want - v) * ease;
      cut.value[k] = smootherstep(opening[k]! * 1.04);
      const room = interiors[k]!;
      room.group.visible = opening[k]! > 0.003;
      if (room.group.visible) {
        anyOpen = true;
        room.update(f);
      }
    });
    if (anyOpen) kit.update(look);
  };
}

import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { registerAnchors, type Anchor } from '../anchors.ts';
import { fbm, flatMaterial, shared, silhouette } from '../gl/flat.ts';
import { pointScale } from '../gl/sprites.ts';
import { sceneIndex } from '../journey.ts';
import { areteY, CAMPS, CLIMBERS, climberAt, FACE, FACE_RIDGE, FACE_SUMMIT, faceLocal, faceRidgeY, onLedge, ROUTE, type Camp } from './climbLayout.ts';
import { cutUniform, Painter, paletteMaterial } from './cutaway.ts';
import { tone, type Frame, type Layer } from './types.ts';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const S = {
  snow: 0,
  snowShade: 1,
  ice: 2,
  route: 3,
  tentA: 4,
  tentB: 5,
  tentC: 6,
  door: 7,
  wood: 8,
  board: 9,
  lime: 10,
  rock: 11,
} as const;
const TENT_SLOTS = [S.tentA, S.tentB, S.tentC, S.tentA] as const;
const TENT_COLORS = { [S.tentA]: '#f2963a', [S.tentB]: '#f0c64a', [S.tentC]: '#e0573c' } as const;
const PRAYER = ['#3f7fd6', '#f4f1e8', '#d8443a', '#3fa45b', '#f0c43c'] as const;

/** Soft lights: lamps glowing in the tents, and the climbers' headlamps on the ridge. */
function lights(count: number) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const glow = new Float32Array(count);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  const uniforms = { uColor: { value: new THREE.Color() }, uScale: pointScale, uTime: shared.uTime };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aGlow;
      uniform float uScale;
      varying float vGlow;
      void main() {
        vGlow = aGlow;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.09, 0.0, d);
        float halo = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * (core * 1.2 + halo * halo * 0.55) * vGlow, 1.0);
      }`,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  return { points, pos, size, glow, uniforms, geometry: g };
}

/**
 * K2's face at camp level, in the small hours: the Abruzzi ridge climbing from a sea of
 * cloud, with a camp on each ledge (tents lit from inside, a board planted beside them),
 * prayer flags at base camp, climbers' headlamps moving up between the camps, and a lime
 * flag on the summit, which is where the Career dive ends.
 */
export function ascentFace(): Layer {
  const group = new THREE.Group();
  const L = (sx: number, sy: number) => faceLocal(sx, sy);

  // The face: rock under the skyline, broken into steps, flat where the camps stand.
  const rough = fbm(57, 4);
  const ridgeAt = (x: number) => faceRidgeY(x) + (onLedge(x) ? 0 : 6 * rough(x / 22) * smoothstep(-400, -250, x));
  const xs: number[] = [];
  const ys: number[] = [];
  const x0 = FACE_RIDGE[0]![0];
  const x1 = FACE_RIDGE.at(-1)![0];
  for (let x = x0; x <= x1; x += 2) {
    const [lx, ly] = L(x, ridgeAt(x));
    xs.push(lx);
    ys.push(ly);
  }
  const [, low] = L(0, -500);
  const [, high] = L(0, 340);
  const body = flatMaterial({ y0: low, y1: high, transparent: true });
  group.add(new THREE.Mesh(silhouette(xs, ys, low - 1800), body));

  // Snow and ice, all hung from the skyline so none of it can stray into the sky.
  const paint = new Painter(() => false);
  /** A band under the skyline between x0 and x1: `from` and `to` are depths below it. */
  const band = (a: number, b: number, from: (x: number) => number, to: (x: number) => number, slot: number, step = 4) => {
    for (let x = a; x < b; x += step) {
      const xa = x;
      const xb = Math.min(b, x + step);
      const ta = ridgeAt(xa) - from(xa);
      const tb = ridgeAt(xb) - from(xb);
      const ba = ridgeAt(xa) - to(xa);
      const bb = ridgeAt(xb) - to(xb);
      if (to(xa) <= from(xa) && to(xb) <= from(xb)) continue;
      const [p0x, p0y] = L(xa, ta);
      const [p1x, p1y] = L(xb, tb);
      const [p2x, p2y] = L(xb, Math.min(tb, bb));
      const [p3x, p3y] = L(xa, Math.min(ta, ba));
      paint.quadPoints(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, slot);
    }
  };
  const bell = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
  const streak = fbm(71, 3);
  const rnd = (k: number) => {
    const v = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // The face lit by the moon: everything left of the arête that falls from the summit.
  for (let x = x0 + 2; x < 800; x += 3) {
    const xb = Math.min(800, x + 3);
    const top = (u: number) => (u <= FACE_SUMMIT.x ? ridgeAt(u) : Math.min(ridgeAt(u), areteY(u)));
    const [ax, ay] = L(x, top(x));
    const [bx, by] = L(xb, top(xb));
    const [cx, cy] = L(xb, -2400);
    const [dx, dy] = L(x, -2400);
    paint.quadPoints(ax, ay, bx, by, cx, cy, dx, dy, S.rock);
  }
  // Gullies of snow running down from the crest, leaning towards you as they fall.
  for (let k = 0; k < 64; k++) {
    const x = -250 + k * 13 + rnd(k) * 9;
    if (onLedge(x) || x > 760) continue;
    const onLit = x < FACE_SUMMIT.x;
    const top = (onLit ? ridgeAt(x) : Math.min(ridgeAt(x), areteY(x))) - 5 - rnd(k + 9) * 8;
    const len = 26 + rnd(k + 3) * (onLit ? 110 : 70);
    const w = 3.5 + rnd(k + 5) * 6;
    const lean = -0.18 * len;
    const [ax, ay] = L(x - w / 2, top);
    const [bx, by] = L(x + w / 2, top - w * 0.4);
    const [cx, cy] = L(x + lean + w * 0.12, top - len);
    const [dx, dy] = L(x + lean - w * 0.12, top - len + 2);
    paint.quadPoints(ax, ay, bx, by, cx, cy, dx, dy, k % 3 === 0 ? S.snow : S.snowShade);
  }
  // A crust of snow along the whole crest, deepest on the summit.
  band(x0 + 300, FACE_SUMMIT.x, () => 0, (x) => 5 + 3 * streak(x / 30) + 22 * bell(x, FACE_SUMMIT.x - 10, 90), S.snow, 3);
  // Past the summit the crest is in the mountain's own shadow: thin, and dim.
  band(FACE_SUMMIT.x, x1, () => 0, (x) => 4 + 3 * streak(x / 30) + 8 * bell(x, FACE_SUMMIT.x, 40), S.snowShade, 3);
  // The summit snowfield and the Shoulder, the broad snow slope Camp IV stands on.
  // Both on the moonlit side: the arête is where the light stops.
  band(470, FACE_SUMMIT.x, () => 0, (x) => 30 + 34 * bell(x, 548, 60), S.snow);
  band(380, 520, () => 0, (x) => 16 + 24 * bell(x, 455, 50), S.snow);
  // The serac band under the summit: an ice cliff hanging over the Bottleneck.
  band(500, FACE_SUMMIT.x - 4, (x) => 58 + 5 * Math.abs(Math.sin(x * 0.4)), (x) => 74 + 4 * Math.sin(x * 0.23), S.ice, 3);
  // The glacier at the foot, base camp on its moraine.
  band(-210, 250, (x) => Math.max(0, faceRidgeY(x) + 248 + 6 * Math.sin(x * 0.02)), (x) => faceRidgeY(x) + 304, S.snow, 6);

  // The route: a faint dotted line of fixed ropes from camp to camp.
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [ax, ay] = ROUTE[i]!;
    const [bx, by] = ROUTE[i + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < len - 2; d += 7) {
      const u0 = d / len;
      const u1 = Math.min(1, (d + 3.2) / len);
      const [qa, qb] = L(ax + (bx - ax) * u0, ay + (by - ay) * u0);
      const [qc, qd] = L(ax + (bx - ax) * u1, ay + (by - ay) * u1);
      paint.bar(qa, qb, qc, qd, 1.3, S.route);
    }
  }

  // The camps: tents along each ledge, a board planted beside them.
  const tents: { x: number; y: number; camp: number }[] = [];
  CAMPS.forEach((c: Camp, ci) => {
    const n = c.tents;
    const span = c.half * 1.3;
    for (let i = 0; i < n; i++) {
      const tx = n === 1 ? c.x : c.x - span / 2 + (span * i) / (n - 1);
      const w = 17 + ((i * 5 + ci * 3) % 4);
      const h = 12.5 + ((i + ci) % 3);
      const [ax, ay] = L(tx - w / 2, c.y);
      const [bx, by] = L(tx + w / 2, c.y);
      const [px, py] = L(tx, c.y + h);
      paint.tri(ax, ay, bx, by, px, py, TENT_SLOTS[(i + ci) % TENT_SLOTS.length]!);
      const [da, db] = L(tx - w * 0.16, c.y);
      const [dc, dd] = L(tx + w * 0.16, c.y);
      const [dp, dq] = L(tx, c.y + h * 0.55);
      paint.tri(da, db, dc, dd, dp, dq, S.door);
      tents.push({ x: tx, y: c.y + h * 0.4, camp: ci });
    }
    // The board: a post and a plank at the end of the ledge, what the dive reads from.
    const bxp = c.x + c.half - 3;
    const [p0, p1] = L(bxp, c.y);
    const [p2, p3] = L(bxp, c.y + 15);
    paint.bar(p0, p1, p2, p3, 1.6, S.wood);
    const [r0, r1] = L(bxp - 7, c.y + 10);
    const [r2, r3] = L(bxp + 7, c.y + 19);
    paint.rect(r0, r1, r2, r3, S.wood);
    const [i0, i1] = L(bxp - 5.6, c.y + 11.2);
    const [i2, i3] = L(bxp + 5.6, c.y + 17.8);
    paint.rect(i0, i1, i2, i3, S.board);
  });

  // The summit: a small lime flag where the dive ends.
  const [fx, fy] = L(FACE_SUMMIT.x, FACE_SUMMIT.y);
  paint.bar(fx, fy - 1, fx, fy + 15, 1.1, S.wood);
  paint.tri(fx, fy + 15, fx + 9, fy + 12.5, fx, fy + 10, S.lime);

  const palette = paletteMaterial(cutUniform(1), 12);
  const details = paint.mesh(palette.material);
  details.position.z = 0.3;
  group.add(details);

  // Prayer flags strung across base camp, fluttering.
  const base = CAMPS[0]!;
  const strings = [
    { a: base.x - base.half + 2, b: base.x + base.half - 14, ha: 26, hb: 20, sag: 7 },
    { a: base.x - base.half + 10, b: base.x + 10, ha: 18, hb: 24, sag: 4 },
  ];
  const flagsPer = 14;
  const nFlags = strings.length * flagsPer;
  const fpos = new Float32Array(nFlags * 6 * 3);
  const fcol = new Float32Array(nFlags * 6 * 3);
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const fmat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const prayer = new THREE.Mesh(fgeo, fmat);
  prayer.frustumCulled = false;
  prayer.position.z = 0.32;
  group.add(prayer);
  const tint = new THREE.Color();
  const shadeColor = new THREE.Color();

  // Lamps in the tents, then headlamps on the route.
  const glow = lights(tents.length + CLIMBERS.count);
  tents.forEach((t, i) => {
    const [x, y] = L(t.x, t.y);
    glow.pos.set([x, y, 0], i * 3);
    glow.size[i] = 46;
  });
  glow.points.position.z = 0.35;
  group.add(glow.points);

  // Where the dive can fly: the whole route, each camp, the summit.
  const anchor = (sx: number, sy: number, w: number, h: number): Anchor => {
    const [x, y] = L(sx, sy);
    return { x, y, w, h };
  };
  const anchors: Record<string, Anchor> = {
    route: anchor(150, 20, 1000, 620),
    summit: anchor(FACE_SUMMIT.x - 6, FACE_SUMMIT.y - 18, 150, 110),
  };
  for (const c of CAMPS) anchors[c.id] = anchor(c.x, c.y + 12, c.half * 2 + 46, 64);
  registerAnchors('ascent', group, anchors);

  const ASCENT = sceneIndex('ascent');
  const campIds = CAMPS.map((c) => c.id as string);
  const pulse = new Float32Array(CAMPS.length);

  return {
    group,
    p: FACE.p,
    py: FACE.p,
    sink: FACE.sink,
    update: (f: Frame) => {
      const { look, time } = f;
      // It arrives as the camera climbs out of the valley, never as a cut edge in the sky.
      const fade = smoothstep(ASCENT - 0.55, ASCENT - 0.25, f.s);
      group.visible = fade > 0.002;
      if (!group.visible) return;
      // The body is the face in shadow; the lit face is painted over it.
      body.uniforms.uTop.value.set(mixHex(tone(look, 0.4), look.shade, 0.15));
      body.uniforms.uBottom.value.set(mixHex(tone(look, 0.46), look.shade, 0.35));
      body.uniforms.uOpacity.value = fade;
      const c = palette.colors;
      c[S.snow]!.set(mixHex(mixHex(look.snow, look.haze, 0.18), look.sun, 0.08));
      c[S.snowShade]!.set(mixHex(look.snow, tone(look, 0.36), 0.55));
      c[S.ice]!.set(mixHex(mixHex(look.snow, '#c6ecff', 0.35), look.haze, 0.15));
      c[S.route]!.set(mixHex(look.snow, look.haze, 0.45));
      const lamp = look.windows;
      for (const slot of [S.tentA, S.tentB, S.tentC] as const) c[slot]!.set(mixHex(mixHex(TENT_COLORS[slot], look.shade, 0.45 * (1 - lamp)), '#ffe1a6', 0.38 * lamp));
      c[S.door]!.set(mixHex('#5a2a1a', '#ffd27a', 0.65 * lamp));
      c[S.wood]!.set(mixHex('#6b4a30', look.shade, 0.45));
      c[S.board]!.set(mixHex('#d9c39a', look.shade, 0.35));
      c[S.lime]!.set('#b9ef2e');
      c[S.rock]!.set(mixHex(mixHex(tone(look, 0.34), look.snow, 0.2), look.sun, 0.06));
      palette.material.uniforms.uOpacity!.value = fade;

      // The camp the dive is looking at glows brighter, its lamps turned up.
      const active = f.dive && f.dive.scene === 'ascent' ? campIds.indexOf(f.dive.step) : -1;
      for (let k = 0; k < CAMPS.length; k++) pulse[k] = pulse[k]! + ((k === active ? 1 : 0) - pulse[k]!) * Math.min(1, f.dt * 3);
      tents.forEach((t, i) => {
        const flicker = 0.85 + 0.15 * Math.sin(time * (2.3 + (i % 3)) + i * 1.7);
        glow.glow[i] = (0.32 + 0.5 * pulse[t.camp]!) * lamp * flicker * fade;
        glow.size[i] = 46 + 30 * pulse[t.camp]!;
      });
      for (let k = 0; k < CLIMBERS.count; k++) {
        const p = climberAt(time, k);
        const [x, y] = L(p.x, p.y + 4);
        const i = tents.length + k;
        glow.pos.set([x, y, 0], i * 3);
        glow.size[i] = 16;
        glow.glow[i] = p.on * (0.35 + 0.65 * look.stars) * fade;
      }
      glow.uniforms.uColor.value.set(mixHex('#ffcf85', look.sun, 0.15));
      glow.geometry.getAttribute('position').needsUpdate = true;
      glow.geometry.getAttribute('aSize').needsUpdate = true;
      glow.geometry.getAttribute('aGlow').needsUpdate = true;

      // Prayer flags: each a small square hung from its string, lifting in the wind.
      shadeColor.set(look.shade);
      let k = 0;
      for (const s of strings) {
        for (let j = 0; j < flagsPer; j++) {
          const u = (j + 0.5) / flagsPer;
          const x = s.a + (s.b - s.a) * u;
          const y = base.y + s.ha + (s.hb - s.ha) * u - s.sag * 4 * u * (1 - u);
          const lift = Math.sin(time * 4.2 + j * 0.9 + s.a) * 1.4;
          const [ax, ay] = L(x - 1.6, y);
          const [bx, by] = L(x + 1.6, y);
          const [cx, cy] = L(x + 1.6 + lift * 0.6, y - 3.4);
          const [dx, dy] = L(x - 1.6 + lift * 0.6, y - 3.6);
          fpos.set([ax, ay, 0, bx, by, 0, cx, cy, 0, ax, ay, 0, cx, cy, 0, dx, dy, 0], k * 18);
          tint.set(PRAYER[j % PRAYER.length]!).lerp(shadeColor, 0.55 - 0.25 * look.windows);
          for (let v = 0; v < 6; v++) fcol.set([tint.r, tint.g, tint.b], k * 18 + v * 3);
          k++;
        }
      }
      fgeo.getAttribute('position').needsUpdate = true;
      fgeo.getAttribute('color').needsUpdate = true;
      fmat.opacity = fade;
    },
  };
}

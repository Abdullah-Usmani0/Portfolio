import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { shared } from '../gl/flat.ts';
import { peopleMaterial } from '../gl/sprites.ts';
import type { WorldLook } from '../palette.ts';
import type { Frame } from './types.ts';
import { seeded, tone } from './types.ts';

/**
 * Inside the council buildings: what a dive sees when a facade falls away. Each council's
 * room shows its work (shelves and a telescope, drafting tables, a conveyor, a checklist,
 * a classroom, a studio) and the people doing it. Built once, drawn only while open.
 */

export const Z = { wall: 0.44, slab: 0.4405, back: 0.441, mid: 0.442, people: 0.443, front: 0.444, top: 0.445 } as const;

/** Monitors: lines of text scrolling up, each screen on its own beat. */
function screenMaterial() {
  const uniforms = { uScreen: { value: new THREE.Color('#8fe3ff') }, uBezel: { value: new THREE.Color() }, uTime: shared.uTime };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec2 vUv;
      varying float vSeed;
      void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uScreen;
      uniform vec3 uBezel;
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        vec2 p = vUv;
        float inside = step(0.08, p.x) * step(p.x, 0.92) * step(0.12, p.y) * step(p.y, 0.88);
        float y = p.y * 5.0 + uTime * (0.5 + h(vSeed) * 0.9);
        float len = 0.25 + 0.6 * h(floor(y) * 7.1 + vSeed);
        float line = step(0.35, fract(y)) * step(fract(y), 0.72) * step(0.16, p.x) * step(p.x, 0.16 + len * 0.7);
        vec3 col = uScreen * (0.32 + 0.55 * line);
        gl_FragColor = vec4(mix(uBezel, col, inside), 1.0);
      }`,
  });
  return { material, uniforms };
}

/** Book spines on the research shelves. */
const SPINES = ['#c96f5a', '#5d84a8', '#d8b45b', '#6e9b6a', '#9a6fb0', '#e0d2b8'];

/** The materials every interior shares, re-tinted by the hour. */
export function interiorKit() {
  const mats = {
    room: new THREE.MeshBasicMaterial(),
    roomDeep: new THREE.MeshBasicMaterial(),
    slab: new THREE.MeshBasicMaterial(),
    wood: new THREE.MeshBasicMaterial(),
    metal: new THREE.MeshBasicMaterial(),
    paper: new THREE.MeshBasicMaterial(),
    ink: new THREE.MeshBasicMaterial(),
    lime: new THREE.MeshBasicMaterial({ color: '#b9ef2e' }),
    alert: new THREE.MeshBasicMaterial({ color: '#ff6a55' }),
    amber: new THREE.MeshBasicMaterial({ color: '#ffc45c' }),
    glow: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  const spines = SPINES.map(() => new THREE.MeshBasicMaterial());
  const screens = screenMaterial();
  const people = peopleMaterial();
  people.uniforms.uMix.value = 0.62;
  return {
    mats,
    spines,
    screens,
    people,
    update(look: WorldLook) {
      const base = tone(look, 0.2, 0.1);
      spines.forEach((m, i) => m.color.set(mixHex(base, SPINES[i]!, 0.72)));
      mats.room.color.set(mixHex(mixHex(base, '#f1e2c6', 0.6), '#ffe2ae', look.windows * 0.6));
      mats.roomDeep.color.set(mixHex(mixHex(base, '#d8c6a6', 0.5), '#e6c58c', look.windows * 0.5));
      mats.slab.color.set(mixHex(base, look.shade, 0.3));
      mats.wood.color.set(mixHex(base, '#8a5a35', 0.62));
      mats.metal.color.set(mixHex(base, '#3f4757', 0.65));
      mats.paper.color.set(mixHex(base, '#fbf6ec', 0.78));
      mats.ink.color.set(mixHex(base, '#2f4060', 0.7));
      mats.glow.color.set(mixHex('#000000', '#ffe7b0', 0.24));
      screens.uniforms.uBezel.value.set(mixHex(base, '#1a2030', 0.85));
      people.uniforms.uShade.value.set(tone(look, 0.1));
    },
  };
}
export type InteriorKit = ReturnType<typeof interiorKit>;

/** Rectangles and triangles merged into one mesh per material. */
export class Flat {
  private parts = new Map<THREE.Material, number[]>();
  constructor(
    private group: THREE.Group,
    private z: number,
  ) {}
  tri(m: THREE.Material, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
    const a = this.parts.get(m) ?? [];
    // Wind every triangle anticlockwise, so it faces the camera whichever way it was given.
    const flip = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0;
    if (flip) a.push(ax, ay, 0, cx, cy, 0, bx, by, 0);
    else a.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
    this.parts.set(m, a);
  }
  rect(m: THREE.Material, x0: number, y0: number, x1: number, y1: number) {
    this.tri(m, x0, y0, x1, y0, x1, y1);
    this.tri(m, x0, y0, x1, y1, x0, y1);
  }
  /** A thin bar from a to b. */
  bar(m: THREE.Material, ax: number, ay: number, bx: number, by: number, w: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * (w / 2);
    const ny = (dx / l) * (w / 2);
    this.tri(m, ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny);
    this.tri(m, ax + nx, ay + ny, bx - nx, by - ny, ax - nx, ay - ny);
  }
  disc(m: THREE.Material, cx: number, cy: number, r: number, n = 14) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.tri(m, cx, cy, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
  }
  build() {
    for (const [m, pos] of this.parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const mesh = new THREE.Mesh(g, m);
      mesh.position.z = this.z;
      this.group.add(mesh);
    }
  }
}

/** Monitors as one mesh. */
export function monitors(group: THREE.Group, kit: InteriorKit, boxes: readonly [number, number, number, number][], z: number = Z.top) {
  const pos: number[] = [];
  const uv: number[] = [];
  const seed: number[] = [];
  boxes.forEach(([x0, y0, x1, y1], i) => {
    for (const [px, py, u, v] of [
      [x0, y0, 0, 0],
      [x1, y0, 1, 0],
      [x1, y1, 1, 1],
      [x0, y0, 0, 0],
      [x1, y1, 1, 1],
      [x0, y1, 0, 1],
    ] as const) {
      pos.push(px, py, 0);
      uv.push(u, v);
      seed.push(i * 3.7 + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const mesh = new THREE.Mesh(g, kit.screens.material);
  mesh.position.z = z;
  group.add(mesh);
}

export type Pose = 'sit' | 'stand' | 'walk' | 'climb';
export interface Person {
  x: number;
  y: number;
  pose: Pose;
  color: string;
  /** For walkers: the range they pace, and their speed. */
  range?: [number, number];
  speed?: number;
  /** Faces left. */
  flip?: boolean;
  /** For climbers: the path they follow, looping. */
  path?: readonly [number, number][];
  /** A standing person this much taller or shorter. */
  scale?: number;
}

/** People at work: typing, standing at a bench, pacing or climbing. */
export function crew(group: THREE.Group, kit: InteriorKit, people: readonly Person[]) {
  const n = people.length;
  const geo = new THREE.PlaneGeometry(12, 27);
  geo.translate(0, 13.5, 0);
  const colors = new Float32Array(n * 3);
  people.forEach((p, i) => {
    const c = new THREE.Color(p.color);
    colors.set([c.r, c.g, c.b], i * 3);
  });
  const walk = new Float32Array(n);
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 1));
  const mesh = new THREE.InstancedMesh(geo, kit.people.material, n);
  mesh.position.z = Z.people;
  mesh.frustumCulled = false;
  group.add(mesh);
  const m = new THREE.Matrix4();
  return (time: number) => {
    people.forEach((p, i) => {
      const s = p.scale ?? 1;
      let x = p.x;
      let y = p.y;
      let dir = p.flip ? -1 : 1;
      let sy = s;
      if (p.pose === 'sit') {
        sy = s * 0.72;
        y += Math.sin(time * 9 + i * 1.7) * 0.25;
        walk[i] = 0;
      } else if (p.pose === 'stand') {
        y += Math.abs(Math.sin(time * 2.2 + i)) * 0.6;
        walk[i] = 0.4 * Math.sin(time * 1.5 + i);
      } else if (p.pose === 'walk' && p.range) {
        const [a, b] = p.range;
        const span = b - a;
        const t = (time * (p.speed ?? 14) + i * 37) % (span * 2);
        x = a + (t < span ? t : span * 2 - t);
        dir = t < span ? 1 : -1;
        walk[i] = time * 8 + i;
        y += Math.abs(Math.sin(time * 8 + i)) * 0.5;
      } else if (p.pose === 'climb' && p.path && p.path.length > 1) {
        const lens = p.path.slice(1).map((q, k) => Math.hypot(q[0] - p.path![k]![0], q[1] - p.path![k]![1]));
        const total = lens.reduce((a, b) => a + b, 0);
        let d = (time * (p.speed ?? 16)) % total;
        let k = 0;
        while (k < lens.length - 1 && d > lens[k]!) d -= lens[k++]!;
        const a = p.path[k]!;
        const b = p.path[k + 1]!;
        const u = d / (lens[k] || 1);
        x = a[0] + (b[0] - a[0]) * u;
        y = a[1] + (b[1] - a[1]) * u;
        dir = b[0] >= a[0] ? 1 : -1;
        walk[i] = time * 9 + i;
      }
      m.makeScale(dir * s, sy, 1).setPosition(x, y, 0);
      mesh.setMatrixAt(i, m);
    });
    (geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
  };
}

/** A desk seen from the front, with a monitor on it: the desk hides a sitter's legs. */
export function desk(flat: Flat, front: Flat, kit: InteriorKit, x: number, y: number, w = 26): [number, number, number, number] {
  front.rect(kit.mats.wood, x, y, x + w, y + 11);
  front.rect(kit.mats.slab, x + 2, y, x + 4, y + 9);
  flat.rect(kit.mats.metal, x + w * 0.6, y + 11, x + w * 0.66, y + 14);
  return [x + w * 0.5, y + 14, x + w * 0.96, y + 26];
}

/** The back wall and floors of a plain room. */
export function room(group: THREE.Group, kit: InteriorKit, x0: number, y0: number, x1: number, y1: number, floors: readonly number[] = []) {
  const wall = new Flat(group, Z.wall);
  wall.rect(kit.mats.room, x0, y0, x1, y1);
  // A soft band of deeper colour near the floor of each storey, so rooms read as lit from above.
  for (const fy of [y0, ...floors]) wall.rect(kit.mats.roomDeep, x0, fy, x1, fy + 6);
  wall.build();
  const slab = new Flat(group, Z.slab);
  for (const fy of floors) slab.rect(kit.mats.slab, x0, fy - 2.5, x1, fy + 1);
  slab.build();
}

export interface Interior {
  group: THREE.Group;
  update: (f: Frame) => void;
}

export function interior(build: (g: THREE.Group, later: ((f: Frame) => void)[]) => void): Interior {
  const group = new THREE.Group();
  group.visible = false;
  const later: ((f: Frame) => void)[] = [];
  build(group, later);
  return { group, update: (f) => later.forEach((u) => u(f)) };
}


/** Research: shelves of sources, a market chart that rises as postings are counted, a telescope in the dome. */
export function researchInterior(kit: InteriorKit, b: { x: number; y: number; w: number; h: number; dome: { cx: number; cy: number; r: number } }): Interior {
  return interior((g, later) => {
    const { x, y, w, h } = b;
    room(g, kit, x, y, x + w, y + h, [y + 40]);
    const back = new Flat(g, Z.back);
    const front = new Flat(g, Z.front);
    // Shelves on the mezzanine.
    const rnd = seeded(11);
    for (let row = 0; row < 2; row++) {
      const sy = y + 44 + row * 13;
      back.rect(kit.mats.wood, x + 6, sy, x + 46, sy + 1.6);
      for (let sx = x + 8; sx < x + 44; ) {
        const bw = 2.2 + rnd() * 2;
        back.rect(kit.spines[Math.floor(rnd() * kit.spines.length)]!, sx, sy + 1.6, sx + bw, sy + 8 + rnd() * 3);
        sx += bw + 0.6;
      }
    }
    // The market chart: bars that keep re-counting.
    back.rect(kit.mats.paper, x + 56, y + 46, x + w - 6, y + h - 6);
    back.build();
    const bars: THREE.Mesh[] = [];
    for (let k = 0; k < 6; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1).translate(0, 0.5, 0), k === 3 ? kit.mats.lime : kit.mats.ink);
      bar.position.set(x + 61 + k * 5.6, y + 49, Z.mid);
      g.add(bar);
      bars.push(bar);
    }
    // Analysts at their screens.
    const screens = [desk(back, front, kit, x + 6, y + 2, 28), desk(back, front, kit, x + 52, y + 2, 28)];
    monitors(g, kit, screens);
    front.build();
    const move = crew(g, kit, [
      { x: x + 13, y: y + 3, pose: 'sit', color: '#6fa39d' },
      { x: x + 59, y: y + 3, pose: 'sit', color: '#d8b45b' },
      { x: x + 30, y: y + 41, pose: 'walk', range: [x + 10, x + 40], speed: 8, color: '#c96f5a' },
    ]);
    // The telescope through the dome's slit, sweeping the sky.
    const scope = new THREE.Group();
    scope.position.set(b.dome.cx, b.dome.cy + 4, 0.452);
    const tube = new THREE.Mesh(new THREE.PlaneGeometry(9, b.dome.r * 1.15).translate(0, b.dome.r * 0.5, 0), kit.mats.metal);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(11, 4).translate(0, b.dome.r * 1.08, 0), kit.mats.ink);
    scope.add(tube, lens);
    g.add(scope);
    later.push((f) => {
      move(f.time);
      bars.forEach((bar, k) => (bar.scale.y = 8 + 14 * (0.5 + 0.5 * Math.sin(f.time * 0.9 + k * 1.3)) * (k === 3 ? 1.25 : 1)));
      scope.rotation.z = -0.45 + Math.sin(f.time * 0.3) * 0.16;
    });
  });
}

/** Design: drafting tables where maps are drawn, a wall board of the focus map, a critic reviewing. */
export function designInterior(kit: InteriorKit, tiers: readonly { x0: number; x1: number; y0: number; y1: number }[]): Interior {
  return interior((g, later) => {
    const [t0, t1, t2] = tiers as [(typeof tiers)[0], (typeof tiers)[0], (typeof tiers)[0]];
    for (const t of tiers) room(g, kit, t.x0, t.y0, t.x1, t.y1);
    const back = new Flat(g, Z.back);
    const front = new Flat(g, Z.front);
    // Ground floor: two drafting tables, a map half drawn on each.
    const drawing: THREE.Mesh[] = [];
    [t0.x0 + 12, t0.x0 + 66].forEach((tx, k) => {
      front.bar(kit.mats.wood, tx + 4, t0.y0, tx + 8, t0.y0 + 16, 2);
      front.bar(kit.mats.wood, tx + 34, t0.y0, tx + 30, t0.y0 + 16, 2);
      front.tri(kit.mats.paper, tx, t0.y0 + 16, tx + 40, t0.y0 + 16, tx + 40, t0.y0 + 30);
      front.tri(kit.mats.paper, tx, t0.y0 + 16, tx + 40, t0.y0 + 30, tx, t0.y0 + 24);
      // The map: a little tree whose branches are drawn in, line by line.
      for (let j = 0; j < 4; j++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4).translate(0.5, 0, 0), j === 0 ? kit.mats.lime : kit.mats.ink);
        line.position.set(tx + 5 + j * 2, t0.y0 + 19.5 + j * 2.4, Z.top);
        line.userData = { len: 28 - j * 5, delay: k * 1.7 + j * 0.6 };
        g.add(line);
        drawing.push(line);
      }
    });
    // First floor: the focus map on the wall, nodes lighting up as it is laid out.
    back.rect(kit.mats.paper, t1.x0 + 8, t1.y0 + 12, t1.x1 - 8, t1.y1 - 8);
    const cxm = (t1.x0 + t1.x1) / 2;
    const top = t1.y1 - 14;
    const nodes: [number, number][] = [
      [cxm, top],
      [cxm - 24, top - 13],
      [cxm, top - 13],
      [cxm + 24, top - 13],
      [cxm - 30, top - 26],
      [cxm - 18, top - 26],
      [cxm + 6, top - 26],
      [cxm + 30, top - 26],
    ];
    const edges: [number, number][] = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    for (const [a, c] of edges) back.bar(kit.mats.ink, nodes[a]![0], nodes[a]![1], nodes[c]![0], nodes[c]![1], 0.8);
    back.build();
    const dots = nodes.map(([nx, ny], k) => {
      const d = new THREE.Mesh(new THREE.CircleGeometry(2.4, 12), k === 0 ? kit.mats.lime : kit.mats.ink);
      d.position.set(nx, ny, Z.mid);
      g.add(d);
      return d;
    });
    // Top floor: the critic at a screen.
    const screens = [desk(back, front, kit, t2.x0 + 14, t2.y0 + 2, 28)];
    monitors(g, kit, screens);
    front.build();
    const move = crew(g, kit, [
      { x: t0.x0 + 24, y: t0.y0 + 2, pose: 'stand', color: '#c7765a' },
      { x: t0.x0 + 80, y: t0.y0 + 2, pose: 'stand', color: '#7fb2e8', flip: true },
      { x: t1.x0 + 20, y: t1.y0 + 2, pose: 'walk', range: [t1.x0 + 14, t1.x1 - 18], speed: 9, color: '#e8c95a' },
      { x: t2.x0 + 21, y: t2.y0 + 3, pose: 'sit', color: '#b892e0' },
    ]);
    later.push((f) => {
      move(f.time);
      for (const line of drawing) {
        const { len, delay } = line.userData as { len: number; delay: number };
        const t = ((f.time - delay) % 6) / 6;
        line.scale.x = Math.max(0.01, len * Math.min(1, Math.max(0, t * 1.6)));
      }
      const lit = Math.floor((f.time * 1.4) % (dots.length + 4));
      dots.forEach((d, k) => d.scale.setScalar(k <= lit ? 1 : 0.45));
    });
  });
}

/** Implementation: a conveyor of crates (scenarios being assembled) and builders along it. */
export function workshopInterior(kit: InteriorKit, b: { x: number; y: number; w: number; h: number }): Interior {
  return interior((g, later) => {
    const { x, y, w, h } = b;
    room(g, kit, x, y, x + w, y + h, [y + 38]);
    const back = new Flat(g, Z.back);
    const front = new Flat(g, Z.front);
    // A gallery of screens upstairs: every job's progress.
    const screens: [number, number, number, number][] = [];
    for (let k = 0; k < 6; k++) screens.push([x + 10 + k * 26, y + 46, x + 30 + k * 26, y + 60]);
    monitors(g, kit, screens, Z.mid);
    // The belt.
    front.rect(kit.mats.metal, x + 4, y + 12, x + w - 4, y + 15);
    for (let lx = x + 10; lx < x + w - 6; lx += 22) front.rect(kit.mats.metal, lx, y, lx + 2.5, y + 12);
    back.build();
    front.build();
    const crates = Array.from({ length: 7 }, (_, k) => {
      const c = new THREE.Group();
      const box = new THREE.Mesh(new THREE.PlaneGeometry(13, 10).translate(0, 5, 0), kit.mats.wood);
      const lid = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2).translate(0, 10, 0), kit.mats.ink);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(4, 3).translate(0, 5, 0), k % 3 === 0 ? kit.mats.lime : kit.mats.paper);
      tag.position.z = 0.0004;
      c.add(box, lid, tag);
      c.position.set(0, y + 15, Z.top);
      c.userData.offset = k / 7;
      g.add(c);
      return c;
    });
    const move = crew(g, kit, [
      { x: x + 30, y: y + 2, pose: 'stand', color: '#6c7d9a' },
      { x: x + 70, y: y + 2, pose: 'stand', color: '#f0a35e', flip: true },
      { x: x + 112, y: y + 2, pose: 'stand', color: '#8cc77a' },
      { x: x + 150, y: y + 2, pose: 'stand', color: '#b892e0', flip: true },
      { x: x + 40, y: y + 39, pose: 'walk', range: [x + 14, x + w - 20], speed: 11, color: '#e8c95a' },
    ]);
    later.push((f) => {
      move(f.time);
      crates.forEach((c) => {
        const t = (f.time * 0.06 + (c.userData.offset as number)) % 1;
        c.position.x = x + 8 + t * (w - 16);
        c.visible = t > 0.02 && t < 0.98;
      });
    });
  });
}

/** Audit: a stair to the lamp, an inspector on it, and a checklist ticking itself off. */
export function lighthouseInterior(kit: InteriorKit, b: { cx: number; y: number; h: number; halfBottom: number; halfTop: number }): Interior {
  return interior((g, later) => {
    const { cx, y, h, halfBottom, halfTop } = b;
    const half = (yy: number) => halfBottom + ((halfTop - halfBottom) * (yy - y)) / h - 3;
    const wall = new Flat(g, Z.wall);
    wall.tri(kit.mats.room, cx - half(y), y, cx + half(y), y, cx + half(y + h), y + h);
    wall.tri(kit.mats.room, cx - half(y), y, cx + half(y + h), y + h, cx - half(y + h), y + h);
    wall.build();
    // A zigzag stair up the tower.
    const back = new Flat(g, Z.back);
    const path: [number, number][] = [];
    const flights = 5;
    for (let k = 0; k <= flights; k++) {
      const yy = y + 4 + (k * (h - 16)) / flights;
      const side = k % 2 ? 1 : -1;
      path.push([cx + side * (half(yy) - 6), yy]);
    }
    for (let k = 0; k < path.length - 1; k++) back.bar(kit.mats.wood, path[k]![0], path[k]![1] - 1, path[k + 1]![0], path[k + 1]![1] - 1, 2.4);
    // The checklist board halfway up.
    const bx = cx - 9;
    const by = y + h * 0.42;
    back.rect(kit.mats.paper, bx, by, bx + 18, by + 34);
    for (let r = 0; r < 5; r++) back.rect(kit.mats.ink, bx + 7, by + 29 - r * 6, bx + 16, by + 30 - r * 6);
    back.build();
    const marks = Array.from({ length: 5 }, (_, r) => {
      const mk = new THREE.Mesh(new THREE.CircleGeometry(1.8, 10), r === 3 ? kit.mats.alert : kit.mats.lime);
      mk.position.set(bx + 4, by + 29.5 - r * 6, Z.mid);
      g.add(mk);
      return mk;
    });
    const move = crew(g, kit, [{ x: cx, y, pose: 'climb', path, speed: 14, color: '#b8473d', scale: 0.8 }]);
    later.push((f) => {
      move(f.time);
      const t = (f.time % 8) / 8;
      marks.forEach((mk, r) => (mk.visible = t > 0.12 + r * 0.14));
    });
  });
}

/** Training: a lesson on the projector, a teacher beside it, learners watching. */
export function academyInterior(kit: InteriorKit, b: { x: number; y: number; w: number; h: number }): Interior {
  return interior((g, later) => {
    const { x, y, w, h } = b;
    room(g, kit, x, y, x + w, y + h);
    const back = new Flat(g, Z.back);
    // The projector screen and its lesson: three slides of a diagram building up.
    const sx0 = x + 10;
    const sx1 = x + 74;
    const sy0 = y + 26;
    const sy1 = y + h - 8;
    back.rect(kit.mats.metal, sx0 - 2, sy0 - 2, sx1 + 2, sy1 + 2);
    back.rect(kit.mats.paper, sx0, sy0, sx1, sy1);
    back.build();
    const slide = [0, 1, 2].map((k) => {
      const box = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), k === 2 ? kit.mats.lime : kit.mats.ink);
      box.position.set(sx0 + 12 + k * 20, (sy0 + sy1) / 2 + (k === 1 ? 6 : -3), Z.mid);
      g.add(box);
      return box;
    });
    const arrows = [0, 1].map((k) => {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.4), kit.mats.ink);
      a.position.set(sx0 + 22 + k * 20, (sy0 + sy1) / 2 + 1.5, Z.mid);
      g.add(a);
      return a;
    });
    // Rows of learners, raked towards the back.
    const learners: Person[] = [];
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 5; k++) {
        learners.push({ x: x + 100 + k * 15 + row * 4, y: y + 2 + row * 9, pose: 'sit', color: ['#7fb2e8', '#f0a35e', '#b892e0', '#8cc77a', '#e8c95a'][(k + row) % 5]!, flip: true });
      }
    }
    const front = new Flat(g, Z.front);
    front.rect(kit.mats.wood, x + 94, y, x + w - 4, y + 7);
    front.build();
    const move = crew(g, kit, [{ x: x + 84, y: y + 2, pose: 'stand', color: '#c9a14b', flip: true }, ...learners]);
    later.push((f) => {
      move(f.time);
      const t = (f.time % 7.5) / 7.5;
      slide.forEach((s, k) => (s.visible = t > k * 0.22));
      arrows.forEach((a, k) => (a.visible = t > k * 0.22 + 0.11));
    });
  });
}

/** Media: a character on set under a light, a camera rolling, a control room upstairs. */
export function studioInterior(kit: InteriorKit, b: { x: number; y: number; w: number; h: number }): Interior {
  return interior((g, later) => {
    const { x, y, w, h } = b;
    room(g, kit, x, y, x + w, y + h, [y + 52]);
    const back = new Flat(g, Z.back);
    const front = new Flat(g, Z.front);
    // The set: a backdrop, a stool.
    back.rect(kit.mats.roomDeep, x + 6, y + 2, x + 50, y + 46);
    front.rect(kit.mats.wood, x + 22, y + 9, x + 36, y + 11);
    front.bar(kit.mats.wood, x + 24, y, x + 26, y + 9, 1.6);
    front.bar(kit.mats.wood, x + 34, y, x + 32, y + 9, 1.6);
    // The camera on its tripod, pointing at the set.
    const camX = x + 80;
    front.bar(kit.mats.metal, camX, y, camX + 5, y + 22, 1.6);
    front.bar(kit.mats.metal, camX + 10, y, camX + 5, y + 22, 1.6);
    front.rect(kit.mats.metal, camX - 4, y + 22, camX + 14, y + 32);
    front.rect(kit.mats.ink, camX - 9, y + 24, camX - 4, y + 30);
    // Upstairs: the control room's screens.
    monitors(g, kit, [
      [x + 12, y + 60, x + 40, y + 78],
      [x + 46, y + 60, x + 74, y + 78],
    ]);
    back.build();
    front.build();
    const tally = new THREE.Mesh(new THREE.CircleGeometry(1.6, 10), kit.mats.alert);
    tally.position.set(camX + 11, y + 34, Z.top);
    const lightGeo = new THREE.BufferGeometry();
    lightGeo.setAttribute('position', new THREE.Float32BufferAttribute([x + 30, y + 50, 0, x + 12, y + 2, 0, x + 48, y + 2, 0], 3));
    const cone = new THREE.Mesh(lightGeo, kit.mats.glow);
    cone.position.z = Z.top;
    g.add(tally, cone);
    const move = crew(g, kit, [
      { x: x + 29, y: y + 9, pose: 'sit', color: '#8b6fb3' },
      { x: camX + 18, y: y + 2, pose: 'stand', color: '#7fb2e8', flip: true },
      { x: x + 60, y: y + 53, pose: 'sit', color: '#e8c95a' },
    ]);
    later.push((f) => {
      move(f.time);
      tally.visible = Math.sin(f.time * 4) > -0.3;
      kit.mats.glow.opacity = 1;
    });
  });
}

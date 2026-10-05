import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { shared } from '../gl/flat.ts';
import { peopleMaterial } from '../gl/sprites.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { riverTop } from './valley.ts';
import { onValley } from './village.ts';

/**
 * The council town: six buildings for the six councils of agents, each with its own shape,
 * and workers moving behind every lit window. Colours come from a small palette of slots
 * that the time of day re-tints each frame.
 */

const SLOTS = {
  wall: 0,
  wallShade: 1,
  roof: 2,
  research: 3,
  design: 4,
  build: 5,
  audit: 6,
  training: 7,
  media: 8,
  lamp: 9,
  beacon: 10,
  dark: 11,
} as const;
type Slot = (typeof SLOTS)[keyof typeof SLOTS];

const ACCENTS: Record<number, string> = {
  [SLOTS.research]: '#6fa39d',
  [SLOTS.design]: '#c7765a',
  [SLOTS.build]: '#6c7d9a',
  [SLOTS.audit]: '#b8473d',
  [SLOTS.training]: '#c9a14b',
  [SLOTS.media]: '#8b6fb3',
};

class Painter {
  pos: number[] = [];
  slot: number[] = [];
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, s: Slot) {
    this.pos.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
    this.slot.push(s, s, s);
  }
  rect(x0: number, y0: number, x1: number, y1: number, s: Slot) {
    this.tri(x0, y0, x1, y0, x1, y1, s);
    this.tri(x0, y0, x1, y1, x0, y1, s);
  }
  /** A half-disc (dome) sitting on y. */
  dome(cx: number, y: number, r: number, s: Slot) {
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a0 = (Math.PI * i) / n;
      const a1 = (Math.PI * (i + 1)) / n;
      this.tri(cx, y, cx + Math.cos(a0) * r, y + Math.sin(a0) * r, cx + Math.cos(a1) * r, y + Math.sin(a1) * r, s);
    }
  }
  quadPoints(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, s: Slot) {
    this.tri(ax, ay, bx, by, cx, cy, s);
    this.tri(ax, ay, cx, cy, dx, dy, s);
  }
  mesh(material: THREE.ShaderMaterial) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aSlot', new THREE.Float32BufferAttribute(this.slot, 1));
    return new THREE.Mesh(g, material);
  }
}

class Windows {
  pos: number[] = [];
  uv: number[] = [];
  seed: number[] = [];
  add(x: number, y: number, w: number, h: number, seed: number) {
    const v = [
      [x, y, 0, 0],
      [x + w, y, 1, 0],
      [x + w, y + h, 1, 1],
      [x, y, 0, 0],
      [x + w, y + h, 1, 1],
      [x, y + h, 0, 1],
    ] as const;
    for (const [px, py, u, t] of v) {
      this.pos.push(px, py, 0);
      this.uv.push(u, t);
      this.seed.push(seed);
    }
  }
  grid(x0: number, x1: number, y0: number, y1: number, cols: number, rows: number, seed: number) {
    const gw = (x1 - x0) / cols;
    const gh = (y1 - y0) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        this.add(x0 + c * gw + gw * 0.18, y0 + r * gh + gh * 0.16, gw * 0.64, gh * 0.68, seed + c * 7.13 + r * 3.71);
      }
    }
  }
}

function paletteMaterial() {
  const colors = Array.from({ length: 12 }, () => new THREE.Color());
  const material = new THREE.ShaderMaterial({
    uniforms: { uColors: { value: colors } },
    vertexShader: /* glsl */ `
      attribute float aSlot;
      uniform vec3 uColors[12];
      varying vec3 vColor;
      void main() {
        vColor = uColors[int(aSlot + 0.5)];
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, 1.0); }`,
  });
  return { material, colors };
}

/** Lit windows with someone at work behind each: walking past, or bent over a glowing screen. */
function windowMaterial() {
  const uniforms = {
    uDark: { value: new THREE.Color() },
    uLight: { value: new THREE.Color() },
    uScreen: { value: new THREE.Color('#8fe3ff') },
    uFrame: { value: new THREE.Color() },
    uGlow: { value: 0 },
    uTime: shared.uTime,
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec2 vUv;
      varying float vSeed;
      void main() {
        vUv = uv;
        vSeed = aSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDark;
      uniform vec3 uLight;
      uniform vec3 uScreen;
      uniform vec3 uFrame;
      uniform float uGlow;
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      void main() {
        float r1 = fract(sin(vSeed * 12.9898) * 43758.5453);
        float r2 = fract(sin(vSeed * 78.233) * 12345.6789);
        float on = step(0.12, r1); // most rooms are busy
        vec3 room = mix(uDark, uLight, on * (0.55 + 0.45 * uGlow));
        vec2 p = vUv;
        float d;
        float typing = step(0.55, r2);
        if (typing > 0.5) {
          // Seated at a desk, leaning in, the screen lighting their face.
          float bob = 0.015 * sin(uTime * 9.0 + vSeed * 13.0);
          float head = length(p - vec2(0.4, 0.5 + bob)) - 0.12;
          float body = box(p - vec2(0.38, 0.2), vec2(0.15, 0.18)) - 0.03;
          d = min(head, body);
          float screen = box(p - vec2(0.7, 0.36), vec2(0.13, 0.1));
          room = mix(room, mix(room, uScreen, 0.85), smoothstep(0.02, -0.02, screen) * on);
          room += uScreen * 0.18 * on * smoothstep(0.5, 0.0, length(p - vec2(0.62, 0.38)));
        } else {
          // Walking across the room and back.
          float t = uTime * (0.25 + r2 * 0.4) + vSeed * 9.0;
          float x = 0.5 + 0.34 * sin(t);
          float step6 = abs(sin(t * 7.0)) * 0.02;
          float head = length(p - vec2(x, 0.62 + step6)) - 0.11;
          float body = box(p - vec2(x, 0.25 + step6), vec2(0.13, 0.24)) - 0.04;
          d = min(head, body);
        }
        room = mix(room, uDark * 0.55, smoothstep(0.02, -0.02, d) * on);
        float inside = step(0.07, p.x) * step(p.x, 0.93) * step(0.07, p.y) * step(p.y, 0.93);
        gl_FragColor = vec4(mix(uFrame, room, inside), 1.0);
      }`,
  });
  return { material, uniforms };
}

export function councils(group: THREE.Group) {
  const body = new Painter();
  const win = new Windows();
  const cx = onValley('councils', 330);
  const at = (x: number) => riverTop(x) + 1;

  // Research: an observatory under a verdigris dome.
  {
    const x = cx - 470;
    const y = at(x + 50);
    body.rect(x, y, x + 100, y + 74, SLOTS.wall);
    body.rect(x + 100, y, x + 112, y + 74, SLOTS.wallShade);
    body.rect(x - 4, y + 74, x + 116, y + 80, SLOTS.roof);
    body.dome(x + 56, y + 80, 46, SLOTS.research);
    body.quadPoints(x + 58, y + 84, x + 66, y + 84, x + 76, y + 118, x + 68, y + 120, SLOTS.dark);
    win.grid(x + 8, x + 96, y + 10, y + 66, 3, 2, 1);
  }
  // Design: a terraced drafting tower.
  {
    const x = cx - 320;
    const y = at(x + 60);
    const tiers = [
      [0, 120, 70],
      [16, 104, 56],
      [32, 88, 46],
    ] as const;
    let top = y;
    tiers.forEach(([inset, right, h], k) => {
      body.rect(x + inset, top, x + right, top + h, SLOTS.wall);
      body.rect(x + inset - 4, top + h, x + right + 4, top + h + 6, SLOTS.design);
      win.grid(x + inset + 6, x + right - 6, top + 8, top + h - 6, Math.max(2, Math.round((right - inset) / 26)), k === 0 ? 2 : 1, 40 + k * 9);
      top += h + 6;
    });
    body.tri(x + 40, top, x + 80, top, x + 60, top + 26, SLOTS.design);
  }
  // Implementation: a long workshop with a sawtooth roof.
  {
    const x = cx - 160;
    const y = at(x + 80);
    body.rect(x, y, x + 168, y + 66, SLOTS.wall);
    for (let k = 0; k < 6; k++) {
      const sx = x + k * 28;
      body.tri(sx, y + 66, sx + 28, y + 66, sx + 28, y + 92, SLOTS.build);
      body.tri(sx + 22, y + 66, sx + 28, y + 66, sx + 28, y + 92, SLOTS.roof);
    }
    win.grid(x + 8, x + 160, y + 10, y + 58, 6, 2, 80);
  }
  // Audit: a lighthouse, the tallest thing in town, watching everything.
  const lanternY = (() => {
    const x = cx + 40;
    const y = at(x + 27);
    const h = 200;
    const stripes = 5;
    for (let k = 0; k < stripes; k++) {
      const y0 = y + (h * k) / stripes;
      const y1 = y + (h * (k + 1)) / stripes;
      const i0 = 27 - (k / stripes) * 9;
      const i1 = 27 - ((k + 1) / stripes) * 9;
      body.quadPoints(x + 27 - i0, y0, x + 27 + i0, y0, x + 27 + i1, y1, x + 27 - i1, y1, k % 2 ? SLOTS.audit : SLOTS.wall);
    }
    body.rect(x + 4, y + h, x + 50, y + h + 6, SLOTS.roof);
    body.rect(x + 12, y + h + 6, x + 42, y + h + 30, SLOTS.lamp);
    body.tri(x + 8, y + h + 30, x + 46, y + h + 30, x + 27, y + h + 50, SLOTS.audit);
    for (let k = 0; k < 4; k++) win.add(x + 21, y + 26 + k * 40, 12, 16, 120 + k);
    return y + h + 18;
  })();
  // Training: an academy with a colonnade and a pediment.
  {
    const x = cx + 120;
    const y = at(x + 90);
    body.rect(x, y, x + 180, y + 72, SLOTS.wall);
    body.rect(x - 6, y + 72, x + 186, y + 80, SLOTS.training);
    body.tri(x - 6, y + 80, x + 186, y + 80, x + 90, y + 114, SLOTS.training);
    body.tri(x + 14, y + 84, x + 166, y + 84, x + 90, y + 106, SLOTS.wall);
    win.grid(x + 10, x + 170, y + 8, y + 64, 6, 2, 160);
  }
  // Media: a studio with a radio mast.
  const mast = (() => {
    const x = cx + 330;
    const y = at(x + 55);
    body.rect(x, y, x + 110, y + 88, SLOTS.wall);
    body.rect(x - 4, y + 88, x + 114, y + 96, SLOTS.media);
    body.rect(x + 74, y + 96, x + 78, y + 230, SLOTS.roof);
    body.tri(x + 64, y + 96, x + 76, y + 200, x + 76, y + 96, SLOTS.roof);
    body.tri(x + 88, y + 96, x + 76, y + 200, x + 76, y + 96, SLOTS.roof);
    win.grid(x + 8, x + 102, y + 10, y + 80, 4, 3, 200);
    return new THREE.Vector2(x + 76, y + 232);
  })();

  const palette = paletteMaterial();
  const bodyMesh = body.mesh(palette.material);
  bodyMesh.position.z = 0.45;
  group.add(bodyMesh);

  const windows = windowMaterial();
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(win.pos, 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(win.uv, 2));
  wg.setAttribute('aSeed', new THREE.Float32BufferAttribute(win.seed, 1));
  const winMesh = new THREE.Mesh(wg, windows.material);
  winMesh.position.z = 0.46;
  group.add(winMesh);

  // The lighthouse beam: a soft wedge of light that sweeps the valley at dusk.
  const beamMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 700, 60, 0, 700, -60, 0], 3));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(cx + 67, lanternY, 0.47);
  group.add(beam);

  // The mast's warning light.
  const blinkMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const blink = new THREE.Mesh(new THREE.CircleGeometry(4, 12), blinkMat);
  blink.position.set(mast.x, mast.y, 0.47);
  group.add(blink);

  // Messengers walking between the councils along the bank.
  const count = 8;
  const people = peopleMaterial();
  const geo = new THREE.PlaneGeometry(10, 22);
  geo.translate(0, 11, 0);
  const colors = new Float32Array(count * 3);
  const walk = new Float32Array(count);
  const tints = ['#b9ef2e', '#8fe3ff', '#ffd08a', '#c97b8e'];
  const walkers = Array.from({ length: count }, (_, i) => {
    const c = new THREE.Color(tints[i % tints.length]);
    colors.set([c.r, c.g, c.b], i * 3);
    const min = cx - 480 + i * 90;
    return { x: min + 40, min, max: min + 300, speed: 10 + (i % 3) * 4, dir: i % 2 ? 1 : -1, phase: i };
  });
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 1));
  const crowd = new THREE.InstancedMesh(geo, people.material, count);
  crowd.position.z = 0.55;
  crowd.frustumCulled = false;
  group.add(crowd);
  const m = new THREE.Matrix4();

  return (f: Frame) => {
    const { look } = f;
    const base = tone(look, 0.2, 0.1);
    const stone = mixHex(base, '#efe4d2', 0.62);
    const c = palette.colors;
    c[SLOTS.wall]!.set(stone);
    c[SLOTS.wallShade]!.set(mixHex(stone, look.shade, 0.3));
    c[SLOTS.roof]!.set(mixHex(base, look.shade, 0.35));
    for (const [slot, hex] of Object.entries(ACCENTS)) c[Number(slot)]!.set(mixHex(base, hex, 0.62));
    c[SLOTS.lamp]!.set(mixHex(mixHex(base, '#fff1c8', 0.5), '#fff6dc', look.windows));
    c[SLOTS.beacon]!.set('#ff5a4a');
    c[SLOTS.dark]!.set(mixHex(base, look.shade, 0.6));

    windows.uniforms.uDark.value.set(mixHex(base, look.shade, 0.55));
    windows.uniforms.uLight.value.set(mixHex(mixHex(base, '#ffe2a8', 0.55), '#ffd28a', look.windows));
    windows.uniforms.uFrame.value.set(mixHex(stone, look.shade, 0.22));
    windows.uniforms.uGlow.value = look.windows;

    beam.rotation.z = Math.sin(f.time * 0.35) * 0.55 + 0.1;
    beamMat.color.set(mixHex('#000000', '#ffe9b8', 0.32 * Math.max(0.15, look.windows)));
    blinkMat.color.set('#ff5a4a');
    blinkMat.opacity = 0.35 + 0.65 * (Math.sin(f.time * 3.2) > 0.6 ? 1 : 0);

    people.uniforms.uShade.value.set(tone(look, 0.1));
    walkers.forEach((w, i) => {
      w.x += w.dir * w.speed * f.dt;
      if (w.x > w.max) w.dir = -1;
      if (w.x < w.min) w.dir = 1;
      w.phase += f.dt * w.speed * 0.5;
      walk[i] = w.phase;
      m.makeScale(w.dir, 1, 1).setPosition(w.x, riverTop(w.x) + 1 + Math.abs(Math.sin(w.phase)) * 0.8, 0);
      crowd.setMatrixAt(i, m);
    });
    (geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute).needsUpdate = true;
    crowd.instanceMatrix.needsUpdate = true;
  };
}

import * as THREE from 'three';
import { mixHex, smootherstep } from '@/motion/color.ts';
import { ANCHOR_IDS } from '../anchorIds.ts';
import { registerAnchors, type Anchor } from '../anchors.ts';
import { BUILDINGS, councilsLayout, type Pane } from './councilsLayout.ts';
import { Painter, anchorOfBox, cutGlsl, cutUniform, paletteMaterial } from './cutaway.ts';
import { renderedStructures } from './renderedStructures.ts';
import { shared } from '../gl/flat.ts';
import { peopleMaterial } from '../gl/sprites.ts';
import {
  academyInterior,
  designInterior,
  interiorKit,
  lighthouseInterior,
  researchInterior,
  studioInterior,
  workshopInterior,
  type Interior,
} from './interiors.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { riverTop } from './valley.ts';

/**
 * The council town: six buildings for the six councils of agents, each with its own shape,
 * and workers moving behind every lit window. Colours come from a small palette of slots
 * that the time of day re-tints each frame. In a dive, a building's front wall falls away
 * to show the room behind it and the people at work there.
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

const ACCENTS: Record<number, string> = {
  [SLOTS.research]: '#6fa39d',
  [SLOTS.design]: '#c7765a',
  [SLOTS.build]: '#6c7d9a',
  [SLOTS.audit]: '#b8473d',
  [SLOTS.training]: '#c9a14b',
  [SLOTS.media]: '#8b6fb3',
};

class Windows {
  pos: number[] = [];
  uv: number[] = [];
  seed: number[] = [];
  cut: number[] = [];
  /** The building being glazed (index + 1). */
  building = 0;
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
      this.cut.push(this.building);
    }
  }
}

/**
 * Lit windows with someone at work behind each: walking past, or bent over a glowing screen.
 * `rendered` says, per building, how far its Blender render is in: its painted frame gives
 * way to the render's own frame and glass round the room.
 */
function windowMaterial(cut: { value: number[] }, rendered: { value: number[] }) {
  const uniforms = {
    uCut: cut,
    uRendered: rendered,
    uDark: { value: new THREE.Color() },
    uLight: { value: new THREE.Color() },
    uScreen: { value: new THREE.Color('#8fe3ff') },
    uFrame: { value: new THREE.Color() },
    uGlow: { value: 0 },
    uTime: shared.uTime,
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      ${cutGlsl(BUILDINGS.length)}
      uniform float uRendered[${BUILDINGS.length}];
      varying vec2 vUv;
      varying float vSeed;
      varying float vAlpha;
      varying float vFrame;
      void main() {
        vUv = uv;
        vSeed = aSeed;
        vAlpha = 1.0 - openness();
        vFrame = 1.0 - uRendered[int(aCut - 0.5)];
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
      varying float vAlpha;
      varying float vFrame;
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
        gl_FragColor = vec4(mix(uFrame, room, inside), vAlpha * mix(vFrame, 1.0, inside));
      }`,
  });
  return { material, uniforms };
}

export function councils(group: THREE.Group, half = false) {
  const L = councilsLayout();
  const body = new Painter((slot) => slot === SLOTS.wall);
  const win = new Windows();
  const panes = (list: readonly Pane[]) => {
    for (const [x, y, w, h, seed] of list) win.add(x, y, w, h, seed);
  };

  const kit = interiorKit();
  const interiors: Interior[] = [];

  // Research: an observatory under a verdigris dome.
  {
    const { x, y, w, h, dome } = L.research;
    body.begin(0);
    win.building = 1;
    body.rect(x, y, x + w, y + h, SLOTS.wall);
    body.rect(x + w, y, x + w + 12, y + h, SLOTS.wallShade);
    body.rect(x - 4, y + h, x + w + 16, y + h + 6, SLOTS.roof);
    body.dome(dome.cx, dome.cy, dome.r, SLOTS.research);
    body.quadPoints(x + 58, y + 84, x + 66, y + 84, x + 76, y + 118, x + 68, y + 120, SLOTS.dark);
    panes(L.research.windows);
    interiors.push(researchInterior(kit, { x, y, w, h, dome: { cx: dome.cx, cy: dome.cy, r: dome.r } }));
  }
  // Design: a terraced drafting tower.
  {
    const { tiers, spire } = L.design;
    body.begin(1);
    win.building = 2;
    for (const t of tiers) {
      body.rect(t.x0, t.y0, t.x1, t.y1, SLOTS.wall);
      body.rect(t.x0 - 4, t.y1, t.x1 + 4, t.y1 + t.ledge, SLOTS.design);
    }
    body.tri(spire.x0, spire.y, spire.x1, spire.y, (spire.x0 + spire.x1) / 2, spire.apex, SLOTS.design);
    panes(L.design.windows);
    interiors.push(designInterior(kit, tiers));
  }
  // Implementation: a long workshop with a sawtooth roof.
  {
    const { x, y, w, h, teeth, tooth, rise } = L.implementation;
    body.begin(2);
    win.building = 3;
    body.rect(x, y, x + w, y + h, SLOTS.wall);
    for (let k = 0; k < teeth; k++) {
      const sx = x + k * tooth;
      body.tri(sx, y + h, sx + tooth, y + h, sx + tooth, y + h + rise, SLOTS.build);
      body.tri(sx + tooth - 6, y + h, sx + tooth, y + h, sx + tooth, y + h + rise, SLOTS.roof);
    }
    panes(L.implementation.windows);
    interiors.push(workshopInterior(kit, { x, y, w, h }));
  }
  // Audit: a lighthouse, the tallest thing in town, watching everything.
  {
    const { x, y, h, stripes, halfBottom, halfTop, cx } = L.audit;
    body.begin(3);
    win.building = 4;
    for (let k = 0; k < stripes; k++) {
      const y0 = y + (h * k) / stripes;
      const y1 = y + (h * (k + 1)) / stripes;
      const i0 = halfBottom - (k / stripes) * (halfBottom - halfTop);
      const i1 = halfBottom - ((k + 1) / stripes) * (halfBottom - halfTop);
      body.quadPoints(cx - i0, y0, cx + i0, y0, cx + i1, y1, cx - i1, y1, k % 2 ? SLOTS.audit : SLOTS.wall, true);
    }
    body.rect(x + 4, y + h, x + 50, y + h + 6, SLOTS.roof);
    body.rect(x + 12, y + h + 6, x + 42, y + h + 30, SLOTS.lamp);
    body.tri(x + 8, y + h + 30, x + 46, y + h + 30, cx, y + h + 50, SLOTS.audit);
    panes(L.audit.windows);
    interiors.push(lighthouseInterior(kit, { cx, y, h, halfBottom, halfTop }));
  }
  // Training: an academy with a colonnade and a pediment.
  {
    const { x, y, w, h } = L.training;
    body.begin(4);
    win.building = 5;
    body.rect(x, y, x + w, y + h, SLOTS.wall);
    body.rect(x - 6, y + h, x + w + 6, y + h + 8, SLOTS.training);
    body.tri(x - 6, y + h + 8, x + w + 6, y + h + 8, x + w / 2, y + h + 42, SLOTS.training);
    body.tri(x + 14, y + h + 12, x + w - 14, y + h + 12, x + w / 2, y + h + 34, SLOTS.wall);
    panes(L.training.windows);
    interiors.push(academyInterior(kit, { x, y, w, h }));
  }
  // Media: a studio with a radio mast.
  {
    const { x, y, w, h, mast } = L.media;
    body.begin(5);
    win.building = 6;
    body.rect(x, y, x + w, y + h, SLOTS.wall);
    body.rect(x - 4, y + h, x + w + 4, y + h + 8, SLOTS.media);
    body.framing = false;
    body.rect(mast.x - 2, mast.y0, mast.x + 2, mast.y1, SLOTS.roof);
    body.tri(mast.x - 12, mast.y0, mast.x, mast.y0 + 104, mast.x, mast.y0, SLOTS.roof);
    body.tri(mast.x + 12, mast.y0, mast.x, mast.y0 + 104, mast.x, mast.y0, SLOTS.roof);
    body.framing = true;
    panes(L.media.windows);
    interiors.push(studioInterior(kit, { x, y, w, h }));
  }
  const lanternY = L.audit.lantern;
  const mast = new THREE.Vector2(L.media.mast.x, L.media.mast.y1 + 2);
  const cx = L.cx;

  const cut = cutUniform(BUILDINGS.length);
  // Per building (after the first entry, for what belongs to none): whether its painted
  // self is drawn; and how far its render is in.
  const painted = { value: [1, ...BUILDINGS.map(() => 1)] };
  const inRender = { value: BUILDINGS.map(() => 0) };
  const palette = paletteMaterial(cut, 12, painted);
  const bodyMesh = body.mesh(palette.material);
  bodyMesh.position.z = 0.45;
  group.add(bodyMesh);
  for (const room of interiors) group.add(room.group);

  // Where the camera can fly: each building, and the whole town.
  const anchor = anchorOfBox;
  const town = body.boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const anchors: Record<(typeof ANCHOR_IDS.councils)[number], Anchor> = {
    town: anchor(town),
    ...(Object.fromEntries(BUILDINGS.map((id, k) => [id, anchor(body.boxes[k]!)])) as Record<(typeof BUILDINGS)[number], Anchor>),
  };
  registerAnchors('councils', group, anchors);
  const opening = BUILDINGS.map(() => 0);

  const windows = windowMaterial(cut, inRender);
  // The buildings as rendered in Blender: over their painted selves, under the windows'
  // rooms (which land exactly in their windows).
  const rendered = renderedStructures(group, 'councils', { z: 0.455, half });
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(win.pos, 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(win.uv, 2));
  wg.setAttribute('aSeed', new THREE.Float32BufferAttribute(win.seed, 1));
  wg.setAttribute('aCut', new THREE.Float32BufferAttribute(win.cut, 1));
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

    // A dive into one building opens its front wall; every other wall closes.
    const open = f.dive?.scene === 'councils' ? BUILDINGS.indexOf(f.dive.step as (typeof BUILDINGS)[number]) : -1;
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
      // The render gives way to the painted building as its wall falls away.
      const keep = 1 - Math.min(1, opening[k]! / 0.35);
      rendered?.show(k, keep * keep * (3 - 2 * keep));
      const done = rendered?.shownOf(k) ?? 0;
      painted.value[k + 1] = done < 1 || opening[k]! > 0.001 ? 1 : 0;
      inRender.value[k] = done * keep;
    });
    if (anyOpen) kit.update(look);
    rendered?.update(f);
    bodyMesh.visible = painted.value.slice(1).some((v) => v > 0);

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

import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { sceneX } from '../journey.ts';
import { peopleMaterial, smoke } from '../gl/sprites.ts';
import { riverTop, VALLEY_P } from './valley.ts';
import { seeded, tone, type Frame } from './types.ts';

interface Walker {
  x: number;
  min: number;
  max: number;
  speed: number;
  dir: number;
  phase: number;
}

/** Where a scene's set piece sits on the valley floor, so it is centred on its screen. */
export const onValley = (sceneId: string, dx = 0) => sceneX(sceneId) * VALLEY_P + dx;

function quad(out: number[], x0: number, y0: number, x1: number, y1: number) {
  out.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
}

/**
 * The village of humanoid NPCs on the far bank: houses with smoking chimneys and windows
 * that light up at dusk, and villagers walking between them.
 */
export function village(group: THREE.Group) {
  const rnd = seeded(42);
  const walls: number[] = [];
  const roofs: number[] = [];
  const windows: number[] = [];
  const chimneys: [number, number][] = [];
  const cx = onValley('npcs', 60);
  let x = cx - 360;
  while (x < cx + 420) {
    const w = 44 + rnd() * 30;
    const h = 30 + rnd() * 20;
    const base = riverTop(x + w / 2) + 1;
    quad(walls, x, base, x + w, base + h);
    const rh = 18 + rnd() * 14;
    roofs.push(x - 6, base + h, 0, x + w + 6, base + h, 0, x + w / 2, base + h + rh, 0);
    const chx = x + w * (0.65 + rnd() * 0.15);
    quad(roofs, chx, base + h + rh * 0.3, chx + 7, base + h + rh * 0.95);
    chimneys.push([chx + 3.5, base + h + rh]);
    const nWin = w > 58 ? 2 : 1;
    for (let k = 0; k < nWin; k++) {
      const wx = x + ((k + 1) * w) / (nWin + 1) - 5;
      quad(windows, wx, base + h * 0.34, wx + 10, base + h * 0.34 + 12);
    }
    x += w + 14 + rnd() * 40;
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

  const chimneySmoke = smoke(chimneys);
  chimneySmoke.points.position.z = 0.53;
  group.add(chimneySmoke.points);

  // Villagers.
  const count = 11;
  const people = peopleMaterial();
  const geo = new THREE.PlaneGeometry(12, 27);
  geo.translate(0, 13.5, 0);
  const colors = new Float32Array(count * 3);
  const walk = new Float32Array(count);
  const palette = ['#e2a46b', '#7fa9d6', '#c97b8e', '#8fbf7a', '#e9d27a', '#b59ad6'];
  const walkers: Walker[] = [];
  for (let i = 0; i < count; i++) {
    const c = new THREE.Color(palette[i % palette.length]);
    colors.set([c.r, c.g, c.b], i * 3);
    const min = cx - 320 + rnd() * 200;
    walkers.push({ x: min + rnd() * 300, min, max: min + 220 + rnd() * 260, speed: 7 + rnd() * 8, dir: rnd() > 0.5 ? 1 : -1, phase: rnd() * 6 });
  }
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 1));
  const crowd = new THREE.InstancedMesh(geo, people.material, count);
  crowd.position.z = 0.55;
  crowd.frustumCulled = false;
  group.add(crowd);
  const m = new THREE.Matrix4();

  return (f: Frame) => {
    const base = tone(f.look, 0.2, 0.2);
    wallMat.color.set(mixHex(base, '#f0e3cf', 0.6));
    roofMat.color.set(mixHex(base, '#7d3d33', 0.45));
    winMat.color.set(mixHex(mixHex(base, '#2a2433', 0.5), '#ffd08a', f.look.windows));
    chimneySmoke.uniforms.uColor.value.set(mixHex(f.look.skyHorizon, '#ffffff', 0.4));
    chimneySmoke.uniforms.uAlpha.value = 0.42;
    people.uniforms.uShade.value.set(tone(f.look, 0.1));
    const attr = geo.getAttribute('aWalk') as THREE.InstancedBufferAttribute;
    walkers.forEach((w, i) => {
      w.x += w.dir * w.speed * f.dt;
      if (w.x > w.max) w.dir = -1;
      if (w.x < w.min) w.dir = 1;
      w.phase += f.dt * w.speed * 0.55;
      walk[i] = w.phase;
      const y = riverTop(w.x) + 1 + Math.abs(Math.sin(w.phase)) * 0.8;
      m.makeScale(w.dir, 1, 1).setPosition(w.x, y, 0);
      crowd.setMatrixAt(i, m);
    });
    attr.needsUpdate = true;
    crowd.instanceMatrix.needsUpdate = true;
  };
}

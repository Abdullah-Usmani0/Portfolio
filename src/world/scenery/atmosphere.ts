import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { bandGeometry, mistMaterial } from '../gl/water.ts';
import { seeded, type Frame, type Layer } from './types.ts';

/** A drifting band of valley mist at one depth. */
export function mist(o: { p: number; y0: number; y1: number; x0: number; x1: number; amount: number }): Layer {
  const m = mistMaterial();
  const mesh = new THREE.Mesh(bandGeometry([o.x0, o.x1], [o.y1, o.y1], [o.y0, o.y0]), m.material);
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    p: o.p,
    py: o.p,
    update: ({ look }) => {
      m.uniforms.uColor.value.set(mixHex(look.haze, look.skyHorizon, 0.45));
      m.uniforms.uAmount.value = look.mist * o.amount;
    },
  };
}

/** A soft cloud texture, painted once on a canvas from overlapping puffs. */
function cloudTexture(seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext('2d');
  const rnd = seeded(seed);
  if (ctx) {
    for (let i = 0; i < 22; i++) {
      const x = 80 + rnd() * 352;
      const y = 110 - Math.sin(((x - 80) / 352) * Math.PI) * 40 + rnd() * 24;
      const r = 26 + rnd() * 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** A few clouds high in the sky, drifting with the wind. */
export function clouds(): Layer {
  const group = new THREE.Group();
  const rnd = seeded(7);
  const items: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; speed: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: cloudTexture(100 + i), transparent: true, depthWrite: false });
    const w = 360 + rnd() * 420;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), mat);
    mesh.position.set(-2400 + i * 640 + rnd() * 300, 140 + rnd() * 250, 0);
    group.add(mesh);
    items.push({ mesh, mat, speed: 4 + rnd() * 6 });
  }
  return {
    group,
    p: 0.012,
    py: 0.012,
    update: (f: Frame) => {
      const night = f.look.stars;
      const tint = mixHex(mixHex(f.look.skyHorizon, '#ffffff', 0.55), f.look.skyTop, night * 0.6);
      for (const it of items) {
        it.mesh.position.x += it.speed * f.dt;
        if (it.mesh.position.x > 3600) it.mesh.position.x -= 6400;
        it.mat.color.set(tint);
        it.mat.opacity = 0.9 - night * 0.6;
      }
    },
  };
}

/** A small flock that crosses the sky now and then, wings beating. */
export function birds(): Layer {
  const n = 7;
  const pos = new Float32Array(n * 4 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ transparent: true });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  const group = new THREE.Group();
  group.add(lines);
  const offsets = Array.from({ length: n }, (_, i) => [i * 26 - (i % 2) * 12, -Math.abs(i - 3) * 14, i * 0.7] as const);
  return {
    group,
    p: 0.08,
    py: 0.08,
    update: (f: Frame) => {
      const period = 34;
      const t = (f.time % period) / period;
      const leadX = -1500 + t * 3200 + f.camX * 0.08;
      const leadY = 210 + Math.sin(t * Math.PI * 2) * 30;
      offsets.forEach(([ox, oy, ph], i) => {
        const x = leadX - ox;
        const y = leadY + oy;
        const flap = Math.sin(f.time * 9 + ph) * 4;
        pos.set([x - 7, y + flap, 0, x, y, 0, x, y, 0, x + 7, y + flap, 0], i * 12);
      });
      geo.getAttribute('position').needsUpdate = true;
      mat.color.set(mixHex(f.look.shade, f.look.haze, 0.35));
      mat.opacity = 0.85 * (1 - f.look.stars);
    },
  };
}

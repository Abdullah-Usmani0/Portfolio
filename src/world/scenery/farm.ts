import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { bandGeometry } from '../gl/water.ts';
import type { Frame } from './types.ts';
import { tone } from './types.ts';
import { groundY, riverBottom, riverTop } from './valley.ts';
import { onValley } from './village.ts';

/**
 * The farm, where scenarios are grown: striped fields over a rolling hill (each row a
 * category of a focus), a windmill that never stops (the durable queue), a barn and a silo
 * (the reuse cache), and harvest crates floating downstream to the proving grounds.
 */
export function farm(group: THREE.Group) {
  const cx = onValley('scenarios', 300);
  const x0 = cx - 620;
  const x1 = cx + 640;
  const roll = fbm(91, 3);
  const hillTop = (x: number) => {
    const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
    const body = Math.sin(Math.PI * t) ** 0.7;
    return groundY(x) + body * (96 + 26 * roll(x / 260)) ;
  };

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

  // Field rows following the hill's curve, alternating crops.
  const rows: { mat: THREE.MeshBasicMaterial; crop: string }[] = [];
  const crops = ['#d8b45b', '#7d9d4b', '#c99a4a', '#93ad59', '#e0c27a', '#6f8f45'];
  for (let k = 0; k < 7; k++) {
    const a = 8 + k * 13;
    const b = a + 8;
    const top = xs.map((x, i) => Math.max(groundY(x), ys[i]! - a));
    const bot = xs.map((x, i) => Math.max(groundY(x), ys[i]! - b));
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(bandGeometry(xs, top, bot), mat);
    mesh.position.z = 0.31;
    group.add(mesh);
    rows.push({ mat, crop: crops[k % crops.length]! });
  }

  // Barn and silo on the crest, the windmill on the shoulder.
  const solid = new THREE.MeshBasicMaterial();
  const accent = new THREE.MeshBasicMaterial();
  const trim = new THREE.MeshBasicMaterial();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0.33) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const shape = (pts: [number, number][]) => new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));

  const barnX = cx + 170;
  const barnY = hillTop(barnX + 40) - 4;
  add(shape([[0, 0], [86, 0], [86, 46], [43, 74], [0, 46]]), accent, barnX, barnY);
  add(shape([[34, 0], [52, 0], [52, 26], [34, 26]]), trim, barnX, barnY, 0.34);
  add(shape([[-4, 44], [43, 76], [90, 44], [86, 40], [43, 70], [0, 40]]), trim, barnX, barnY, 0.34);
  const siloX = barnX + 96;
  const siloY = hillTop(siloX + 16) - 4;
  add(new THREE.PlaneGeometry(30, 92).translate(15, 46, 0), solid, siloX, siloY);
  add(new THREE.CircleGeometry(15, 20, 0, Math.PI).translate(15, 92, 0), trim, siloX, siloY);

  const millX = cx - 300;
  const millY = hillTop(millX) - 4;
  add(shape([[-16, 0], [16, 0], [9, 98], [-9, 98]]), solid, millX, millY);
  add(shape([[-12, 98], [12, 98], [0, 114]]), accent, millX, millY, 0.34);
  const sails = new THREE.Group();
  sails.position.set(millX, millY + 98, 0.35);
  for (let k = 0; k < 4; k++) {
    const blade = new THREE.Mesh(shape([[-3, 6], [3, 6], [3, 64], [-3, 64]]), trim);
    const cloth = new THREE.Mesh(shape([[3, 18], [15, 22], [15, 64], [3, 64]]), solid);
    const arm = new THREE.Group();
    arm.add(blade, cloth);
    arm.rotation.z = (k * Math.PI) / 2;
    sails.add(arm);
  }
  group.add(sails);
  add(new THREE.CircleGeometry(5, 12), accent, millX, millY + 98, 0.36);

  // Harvest crates riding the current downstream.
  const crates = Array.from({ length: 6 }, (_, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), trim);
    group.add(m);
    return { mesh: m, offset: k / 6 };
  });
  const lid = new THREE.MeshBasicMaterial();
  const lids = crates.map((c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), lid);
    group.add(m);
    return { mesh: m, crate: c };
  });

  return (f: Frame) => {
    const { look } = f;
    const base = tone(look, 0.25, 0.4);
    hill.uniforms.uTop.value.set(mixHex(base, look.haze, 0.1));
    hill.uniforms.uBottom.value.set(mixHex(base, look.shade, 0.3));
    rows.forEach((r, k) => r.mat.color.set(mixHex(tone(look, 0.24, 0.1), r.crop, 0.55 - k * 0.03)));
    solid.color.set(mixHex(tone(look, 0.2), '#efe4d2', 0.6));
    accent.color.set(mixHex(tone(look, 0.2), '#a8463a', 0.62));
    trim.color.set(mixHex(tone(look, 0.2), '#f6efe4', 0.7));
    lid.color.set(mixHex(tone(look, 0.2), '#8a5a35', 0.6));
    sails.rotation.z = -f.time * 0.6;

    // A crate floats from far upstream of the farm to well past it, then starts again.
    const span = 1800;
    crates.forEach((c, k) => {
      const t = (f.time * 0.018 + c.offset) % 1;
      const x = cx - span / 2 + t * span;
      const y = (riverTop(x) + riverBottom(x)) / 2 + Math.sin(f.time * 2 + k) * 1.5;
      c.mesh.position.set(x, y, 0.62);
      c.mesh.rotation.z = Math.sin(f.time * 1.3 + k) * 0.06;
      const l = lids[k]!;
      l.mesh.position.set(x, y + 5, 0.63);
      l.mesh.rotation.z = c.mesh.rotation.z;
    });
  };
}

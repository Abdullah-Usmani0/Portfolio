import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { fbm, flatMaterial, silhouette } from '../gl/flat.ts';
import { bandGeometry, mistMaterial, riverMaterial, waterfallMaterial } from '../gl/water.ts';
import { forestLine } from './ridges.ts';
import { tone, type Layer } from './types.ts';

/** The valley floor travels at this share of the camera's speed. */
export const VALLEY_P = 0.55;
/** The glacier waterfall: where the river is born, beside K2 on the first screen. */
export const FALLS_X = 470;
const X0 = -2600;
const X1 = 15000;
const STEP = 8;

const groundNoise = fbm(11, 3);
const riverNoise = fbm(23, 3);

/** The ground line of the valley floor. */
export const groundY = (x: number) => -262 + 7 * groundNoise(x / 520);
/** The river's far bank (top edge) and near bank (bottom edge). */
export const riverTop = (x: number) => -287 + 5 * Math.sin(x * 0.0021) + 3 * riverNoise(x / 300);
export const riverBottom = (x: number) => {
  const start = Math.min(1, Math.max(0, (x - FALLS_X) / 260));
  return riverTop(x) - (10 + start * (26 + 6 * Math.sin(x * 0.0013 + 1)));
};

/**
 * The cliff wall the falls pour down: it rises from the valley floor, runs along the far
 * bank with pines on its rim and a notch where the water spills, then steps back down.
 */
function cliffLine() {
  const x0 = FALLS_X - 190;
  const x1 = FALLS_X + 640;
  const line = forestLine({
    seed: 61,
    x0,
    x1,
    baseY: -48,
    amp: 10,
    wave: 160,
    treeH: 34,
    treeW: 16,
    gap: 0.6,
    step: 2,
    shape: (x) => {
      const rise = Math.min(1, Math.max(0, (x - x0) / 70));
      const fall = Math.min(1, Math.max(0, (x1 - x) / 160));
      const notch = -18 * Math.exp(-(((x - (FALLS_X + 16)) / 26) ** 2));
      return notch - (1 - Math.min(rise ** 0.6, fall ** 0.8)) * 230;
    },
    clear: (x) => Math.abs(x - (FALLS_X + 16)) < 50,
  });
  return { xs: Array.from(line.xs), ys: Array.from(line.ys).map((y, i) => Math.max(y, groundY(line.xs[i]!))) };
}

/** Where the water leaves the rock. */
const lipY = () => {
  const { xs, ys } = cliffLine();
  const i = xs.findIndex((x) => x >= FALLS_X + 16);
  return (ys[Math.max(0, i)] ?? 0) - 4;
};

export function valley(): Layer {
  const group = new THREE.Group();

  // Ground.
  const gx: number[] = [];
  const gy: number[] = [];
  for (let x = X0; x <= X1; x += STEP) {
    gx.push(x);
    gy.push(groundY(x));
  }
  const ground = flatMaterial({ y0: -460, y1: -258 });
  group.add(new THREE.Mesh(silhouette(gx, gy, -1600), ground));

  // The rock the falls spill over.
  const c = cliffLine();
  const cliff = flatMaterial({ y0: -280, y1: -50 });
  const cliffMesh = new THREE.Mesh(silhouette(c.xs, c.ys, -1600), cliff);
  cliffMesh.position.z = 0.4;
  group.add(cliffMesh);

  // The river, from the foot of the falls downstream.
  const rx: number[] = [];
  const rt: number[] = [];
  const rb: number[] = [];
  for (let x = FALLS_X - 30; x <= X1; x += STEP) {
    rx.push(x);
    rt.push(riverTop(x));
    rb.push(riverBottom(x));
  }
  const river = riverMaterial();
  const riverMesh = new THREE.Mesh(bandGeometry(rx, rt, rb), river.material);
  riverMesh.position.z = 0.6;
  group.add(riverMesh);

  // The falls: a sheet of water down the cliff face, with spray at its foot.
  const fallTop = lipY();
  const fallBottom = riverTop(FALLS_X + 20) - 8;
  const falls = waterfallMaterial();
  const fallMesh = new THREE.Mesh(bandGeometry([FALLS_X - 4, FALLS_X + 36], [fallTop, fallTop], [fallBottom, fallBottom]), falls.material);
  // bandGeometry's uv runs along x; the falls want it across, so rebuild the uvs.
  const uv = fallMesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
  uv.set([0, 0, 0, 1, 1, 0, 1, 1]);
  fallMesh.position.z = 0.8;
  group.add(fallMesh);

  const spray = mistMaterial([FALLS_X - 110, FALLS_X + 170]);
  const sprayMesh = new THREE.Mesh(
    bandGeometry([FALLS_X - 110, FALLS_X + 170], [fallBottom + 70, fallBottom + 70], [fallBottom - 24, fallBottom - 24]),
    spray.material,
  );
  sprayMesh.position.z = 0.9;
  group.add(sprayMesh);

  return {
    group,
    p: VALLEY_P,
    py: VALLEY_P,
    update: ({ look }) => {
      const base = tone(look, 0.24, 0.55);
      ground.uniforms.uTop.value.set(mixHex(base, look.haze, 0.12));
      ground.uniforms.uBottom.value.set(mixHex(base, look.shade, 0.35));
      const rock = tone(look, 0.3, 0.1);
      cliff.uniforms.uTop.value.set(tone(look, 0.27, 0.5));
      cliff.uniforms.uBottom.value.set(mixHex(rock, look.shade, 0.25));
      river.uniforms.uWater.value.set(look.water);
      river.uniforms.uSkyTop.value.set(look.skyTop);
      river.uniforms.uSkyHorizon.value.set(look.skyHorizon);
      river.uniforms.uBank.value.set(mixHex(base, look.snow, 0.25));
      falls.uniforms.uWater.value.set(mixHex(look.water, look.skyHorizon, 0.4));
      falls.uniforms.uLight.value.set(mixHex(look.snow, '#ffffff', 0.4));
      spray.uniforms.uColor.value.set(mixHex(look.snow, look.skyHorizon, 0.3));
      spray.uniforms.uAmount.value = 0.55;
    },
  };
}

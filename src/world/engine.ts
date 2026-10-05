import * as THREE from 'three';
import { shared } from './gl/flat.ts';
import { createSky } from './gl/sky.ts';
import { pointScale } from './gl/sprites.ts';
import type { Shot } from './journey.ts';
import { birds, clouds, mist } from './scenery/atmosphere.ts';
import { foreground } from './scenery/foreground.ts';
import { mountains } from './scenery/mountains.ts';
import { forestLayer } from './scenery/ridges.ts';
import type { Frame, Layer } from './scenery/types.ts';
import { valley } from './scenery/valley.ts';
import { councils } from './scenery/councils.ts';
import { village } from './scenery/village.ts';

/** The view is this many world units tall on a landscape screen; portrait screens see more. */
const VIEW_H = 1000;
const LAST_X = 22000;

export interface World {
  resize: (width: number, height: number) => void;
  render: (shot: Shot, time: number, dt: number) => void;
  dispose: () => void;
}

/**
 * The illustrated valley: flat painted layers at different depths under one sky, lit by
 * the page's hour. An orthographic camera slides along; each layer slides by its own
 * share of that, which is the whole of the parallax.
 */
export function createWorld(canvas: HTMLCanvasElement, maxDpr: number): World {
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.z = 500;
  const sky = createSky();
  scene.add(sky.mesh);

  const valleyLayer = valley();
  const updateVillage = village(valleyLayer.group);
  const updateCouncils = councils(valleyLayer.group);

  // Far to near; each gets its own depth slot in z.
  const layers: Layer[] = [
    clouds(),
    ...mountains(),
    mist({ p: 0.07, y0: -250, y1: -60, x0: -4000, x1: 6000, amount: 0.95 }),
    birds(),
    forestLayer({ seed: 31, x0: -3500, x1: LAST_X * 0.15 + 3500, baseY: -206, amp: 36, wave: 900, treeH: 26, treeW: 14, gap: 0.35, step: 2, p: 0.15, depth: 0.44, leaf: 0.35, sway: 0.6 }),
    mist({ p: 0.2, y0: -290, y1: -170, x0: -4000, x1: LAST_X * 0.2 + 4000, amount: 0.7 }),
    forestLayer({ seed: 47, x0: -3500, x1: LAST_X * 0.28 + 3500, baseY: -240, amp: 30, wave: 700, treeH: 40, treeW: 20, gap: 0.3, step: 2, p: 0.28, depth: 0.33, leaf: 0.45, sway: 1 }),
    mist({ p: 0.42, y0: -320, y1: -236, x0: -4000, x1: LAST_X * 0.42 + 4000, amount: 0.45 }),
    {
      ...valleyLayer,
      update: (f) => {
        valleyLayer.update?.(f);
        updateVillage(f);
        updateCouncils(f);
      },
    },
    foreground(),
  ];
  layers.forEach((l, i) => {
    l.group.position.z = i * 2;
    scene.add(l.group);
  });

  let viewW = VIEW_H;
  let viewH = VIEW_H;

  return {
    resize(width, height) {
      renderer.setSize(width, height, false);
      const aspect = width / Math.max(1, height);
      viewH = aspect >= 1.2 ? VIEW_H : VIEW_H * Math.sqrt(1.2 / aspect);
      viewW = viewH * aspect;
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      sky.uniforms.uAspect.value = aspect;
      pointScale.value = (height / viewH) * renderer.getPixelRatio();
    },
    render(shot, time, dt) {
      shared.uTime.value = time;
      // Portrait screens see more sky and ground; keep the horizon a little above centre.
      const camY = shot.y - (viewH - VIEW_H) * 0.18;
      camera.position.x = shot.x;
      camera.position.y = camY;
      const frame: Frame = { look: shot.look, time, dt, camX: shot.x, camY };
      for (const l of layers) {
        l.group.position.x = shot.x * (1 - l.p);
        l.group.position.y = camY * (1 - l.py);
        l.update?.(frame);
      }
      const { look } = shot;
      sky.uniforms.uTop.value.set(look.skyTop);
      sky.uniforms.uHorizon.value.set(look.skyHorizon);
      sky.uniforms.uSun.value.set(look.sun);
      sky.uniforms.uSunPos.value.set(look.sunX, 0.3 + look.sunY * 0.62);
      sky.uniforms.uStars.value = look.stars;
      renderer.render(scene, camera);
    },
    dispose() {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((mm) => mm.dispose());
      });
      renderer.dispose();
    },
  };
}

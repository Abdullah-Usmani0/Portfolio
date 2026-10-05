import * as THREE from 'three';
import { dollyOrigin, dollyScale, dollyShift } from './dolly.ts';
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
import { farm } from './scenery/farm.ts';
import { lake } from './scenery/lake.ts';
import { mind } from './scenery/mind.ts';
import { provingGrounds } from './scenery/proving.ts';
import { village } from './scenery/village.ts';

/** The view is this many world units tall on a landscape screen; portrait screens see more. */
const VIEW_H = 1000;
const LAST_X = 22000;
/** On a phone the foreground sinks this far, so the set piece shows above it. */
const NARROW_DROP = 70;
/** In a dive the foreground sinks this far out of the way (it carries the page's text, not the dive's). */
const DIVE_DROP = 900;

/** A dive in progress: the camera dollies towards one point of one layer. */
export interface DiveView {
  /** The target layer's group, and the point in it, in its own units. */
  group: THREE.Object3D;
  x: number;
  y: number;
  /** How much the target layer has grown so far. */
  zoom: number;
  /** 0 → 1: how far the target has moved from where it was to `aim`. */
  t: number;
  /** Where on screen the target ends up, in world units from the centre. */
  aimX: number;
  aimY: number;
  scene: string;
  step: string;
}

export interface World {
  resize: (width: number, height: number) => void;
  render: (shot: Shot, time: number, dt: number, dive?: DiveView) => void;
  /** Where a point of a layer is on screen right now, in CSS pixels; null if the layer is hidden. */
  project: (group: THREE.Object3D, x: number, y: number) => { x: number; y: number } | null;
  /** The view's size in world units, after the last resize. */
  size: () => { viewW: number; viewH: number };
  dispose: () => void;
}

/**
 * The illustrated valley: flat painted layers at different depths under one sky, lit by
 * the page's hour. An orthographic camera slides along; each layer slides by its own
 * share of that, which is the whole of the parallax.
 */
export function createWorld(canvas: HTMLCanvasElement, maxDpr: number, fireflies: number): World {
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
  const updateFarm = farm(valleyLayer.group);
  const updateProving = provingGrounds(valleyLayer.group);
  const updateLake = lake(valleyLayer.group);

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
        updateFarm(f);
        updateProving(f);
        updateLake(f);
      },
    },
    mind(fireflies),
    foreground(),
  ];
  layers.forEach((l, i) => {
    l.group.position.z = i * 2;
    scene.add(l.group);
  });

  let viewW = VIEW_H;
  let viewH = VIEW_H;
  /** 0 on landscape screens, 1 on a phone held upright. */
  let narrow = 0;
  let cssW = 1;
  let cssH = 1;
  let basePointScale = 1;

  return {
    resize(width, height) {
      renderer.setSize(width, height, false);
      cssW = Math.max(1, width);
      cssH = Math.max(1, height);
      const aspect = width / Math.max(1, height);
      viewH = aspect >= 1.2 ? VIEW_H : VIEW_H * Math.sqrt(1.2 / aspect);
      viewW = viewH * aspect;
      narrow = Math.min(1, Math.max(0, (1.2 - aspect) / 0.6));
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      sky.uniforms.uAspect.value = aspect;
      basePointScale = (height / viewH) * renderer.getPixelRatio();
      pointScale.value = basePointScale;
    },
    render(shot, time, dt, dive) {
      shared.uTime.value = time;
      // Portrait screens see more sky and ground; keep the horizon a little above centre.
      const camY = shot.y - (viewH - VIEW_H) * 0.18;
      // On a narrow screen the camera slides to frame the set piece; the foreground under
      // the text stays where it is.
      const camX = shot.x + shot.pan * narrow;
      camera.position.x = camX;
      camera.position.y = camY;
      const diving = dive && dive.t > 0 ? dive : undefined;
      const frame: Frame = {
        look: shot.look,
        time,
        dt,
        camX,
        camY,
        s: shot.s,
        dive: diving ? { scene: diving.scene, step: diving.step, t: diving.t } : null,
      };
      // Where each layer sits on the journey, before any dive.
      const origin = (l: Layer) => ({
        x: camX - (l.fixed ? shot.x : camX) * l.p,
        y: camY * (1 - l.py) - (l.fixed ? NARROW_DROP * narrow : 0),
      });
      const target = diving ? layers.find((l) => l.group === diving.group) : undefined;
      // How far the camera has slid, in the target layer's units, to bring the target to its aim.
      const shift =
        target && diving
          ? {
              x: dollyShift(diving.x + origin(target).x - camX, diving.aimX, diving.t, diving.zoom),
              y: dollyShift(diving.y + origin(target).y - camY, diving.aimY, diving.t, diving.zoom),
            }
          : null;
      for (const l of layers) {
        const o = origin(l);
        let s: number | null = 1;
        if (target && shift && diving) {
          s = dollyScale(l.p, target.p, diving.zoom);
          if (s !== null) {
            o.x = dollyOrigin(o.x, camX, l.p, target.p, shift.x, s);
            o.y = dollyOrigin(o.y, camY, l.py, target.py, shift.y, s);
          }
        }
        // A layer the camera has flown past is behind it.
        l.group.visible = s !== null;
        if (s === null) continue;
        if (l.fixed && diving) o.y -= DIVE_DROP * diving.t;
        l.group.scale.set(s, s, 1);
        l.group.position.x = o.x;
        l.group.position.y = o.y;
        l.update?.(frame);
      }
      // Sprites (smoke, lanterns, fireflies) grow with the layer the camera is diving into.
      pointScale.value = basePointScale * (target && diving ? diving.zoom : 1);
      const { look } = shot;
      sky.uniforms.uTop.value.set(look.skyTop);
      sky.uniforms.uHorizon.value.set(look.skyHorizon);
      sky.uniforms.uSun.value.set(look.sun);
      sky.uniforms.uSunPos.value.set(look.sunX, 0.3 + look.sunY * 0.62);
      sky.uniforms.uStars.value = look.stars;
      renderer.render(scene, camera);
    },
    project(group, x, y) {
      const l = layers.find((layer) => layer.group === group);
      if (!l || !l.group.visible) return null;
      const sx = l.group.position.x + x * l.group.scale.x - camera.position.x;
      const sy = l.group.position.y + y * l.group.scale.y - camera.position.y;
      return { x: cssW / 2 + sx * (cssW / viewW), y: cssH / 2 - sy * (cssH / viewH) };
    },
    size: () => ({ viewW, viewH }),
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

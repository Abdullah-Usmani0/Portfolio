import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import k2 from '../data/k2.json';
import k2RenderJson from '../data/k2Render.json';
import { fbm, flatMaterial, silhouette, splitLine } from '../gl/flat.ts';
import { fogBank } from '../gl/fog.ts';
import { renderedMaterial } from '../gl/rendered.ts';
import type { WorldLook } from '../palette.ts';
import { relight, type Relight } from './relight.ts';
import { tone, type Layer } from './types.ts';

/** Horizontal and vertical world units per degree of view: a touch taller than life. */
export const DEG_X = 21;
export const DEG_Y = 26;
/** Where eye level (0°) sits in world units. */
export const HORIZON_Y = -148;

// K2 itself barely moves, so it stays on the horizon for the whole journey; the valley
// walls in front of it move more and give way to ranges drawn to match them.
const PARALLAX = [0.012, 0.026, 0.04, 0.055, 0.07];
/**
 * How fast each band falls away as the camera climbs above the valley: by camp level the
 * valley walls are under the clouds, and from the summit every range is below you.
 */
const SINK = [0.85, 0.66, 0.66, 0.85, 0.3];
/** How far past the measured panorama each band is continued, in world units. */
const CONTINUE = 3200;
const DEPTH = [1, 0.86, 0.74, 0.63, 0.53];
const SNOW = [0.92, 0.55, 0.3, 0.14, 0.06];

/** What blender/k2_render.py rendered: each layer's arc and rows, in degrees from the eye. */
interface RenderIndex {
  pxPerDeg: number;
  /** The light textures hold sqrt(light / lightScale). */
  lightScale: number;
  /** Rows between the three images stacked in each texture. */
  pad: number;
  bands: { near_km: number; far_km: number; lon: number[]; top_deg: number; bottom_deg: number; size: number[] }[];
}
const k2Render = k2RenderJson as RenderIndex;

/** The rendered layers' textures (blender/k2_render.py), by path. */
const TEXTURES = import.meta.glob('../textures/k2-*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Seconds the rendered mountains take to fade in over the painted ones, once loaded. */
const FADE = 0.9;
/** The renders run this far below each layer's lowest skyline (blender/k2_render.py: BELOW_DEG). */
const BELOW_DEG = 7;
/** Fog at each rendered layer's foot, far first: how thick. The nearest layer has the valley mist. */
const FOG = [0.85, 0.75, 0.65, 0.5, 0];

/** The hour's light, worked out once a frame for all five layers. */
let litLook: WorldLook | null = null;
let lit: Relight | null = null;
const lightFor = (look: WorldLook) => {
  if (look !== litLook || !lit) {
    lit = relight(look);
    litLook = look;
  }
  return lit;
};

/**
 * Band `i` as rendered in Blender, relit for the hour (see gl/rendered.ts), or null if it was
 * not rendered. It fades in once its two textures have loaded; until then, and wherever it
 * does not reach, the painted band shows.
 */
function renderedBand(i: number, half: boolean) {
  const band = k2Render.bands[i];
  const size = half ? '-half' : '';
  const lightUrl = TEXTURES[`../textures/k2-${i}-light${size}.webp`];
  const maskUrl = TEXTURES[`../textures/k2-${i}-mask${size}.webp`];
  if (!band || !lightUrl || !maskUrl) return null;
  let loaded = 0;
  const loader = new THREE.TextureLoader();
  const load = (url: string) => {
    const t = loader.load(url, () => loaded++);
    t.colorSpace = THREE.NoColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  const light = load(lightUrl);
  const mask = load(maskUrl);
  const m = renderedMaterial(light, mask, {
    scale: k2Render.lightScale,
    nearKm: band.near_km,
    farKm: band.far_km,
    horizonY: HORIZON_Y,
    degY: DEG_Y,
    rows: band.size[1]!,
    pad: k2Render.pad,
  });
  const x0 = band.lon[0]! * DEG_X;
  const x1 = band.lon[1]! * DEG_X;
  const y0 = HORIZON_Y + band.bottom_deg * DEG_Y;
  const y1 = HORIZON_Y + band.top_deg * DEG_Y;
  const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  const mesh = new THREE.Mesh(geo, m.material);
  // In front of the painted band it replaces, behind K2's plume.
  mesh.position.z = 0.2;
  mesh.frustumCulled = false;
  // Fog lying in the valleys at the layer's foot, its top a few degrees over the lowest skyline.
  const thick = FOG[i] ?? 0;
  const fog = thick > 0 ? fogBank({ x0, x1, y0, y1: HORIZON_Y + (band.bottom_deg + BELOW_DEG + 5) * DEG_Y, seed: 13.7 * (i + 1), drift: 0.004 + 0.003 * i }) : null;
  if (fog) fog.mesh.position.z = 0.3;
  // When both textures were in, by the world's clock: the fade keeps real time even when
  // frames come slowly.
  let since: number | null = null;
  return {
    meshes: fog ? [mesh, fog.mesh] : [mesh],
    x0,
    x1,
    /** Light it for the hour and fade it in; returns how far it has (0–1). */
    update(look: WorldLook, time: number) {
      if (loaded >= 2 && since === null) since = time;
      const shown = since === null ? 0 : Math.min(1, (time - since) / FADE);
      m.uniforms.uOpacity.value = shown;
      mesh.visible = shown > 0;
      if (shown > 0) m.set(lightFor(look));
      if (fog) {
        fog.mesh.visible = shown > 0;
        fog.uniforms.uLit.value.set(mixHex(mixHex(look.skyHorizon, '#ffffff', 0.4), look.sun, 0.35));
        fog.uniforms.uShade.value.set(mixHex(look.haze, look.skyTop, 0.3));
        fog.uniforms.uAmount.value = thick * shown * (0.5 + 0.5 * look.mist);
      }
      return shown;
    },
    dispose() {
      light.dispose();
      mask.dispose();
      geo.dispose();
      m.material.dispose();
      fog?.mesh.geometry.dispose();
      fog?.mesh.material.dispose();
    },
  };
}

/** K2's summit on its own (farthest) layer, in that layer's units. */
export const K2_SUMMIT = (() => {
  const band = k2.layers[0]!;
  let top = 0;
  band.deg.forEach((d, i) => {
    if (d > band.deg[top]!) top = i;
  });
  return { x: (band.x[top]! - 0.5) * k2.arc_deg * DEG_X, y: HORIZON_Y + band.deg[top]! * DEG_Y };
})();

/**
 * The real K2 range as five layers, far first: rendered in Blender and relit by the hour
 * (blender/k2_render.py), over the painted silhouettes they replace (blender/k2_panorama.py),
 * which show until the renders load and wherever they do not reach. `half` loads the
 * half-size renders, for phones.
 */
export function mountains(half = false): Layer[] {
  return k2.layers.map((band, i) => {
    const xs = band.x.map((x) => (x - 0.5) * k2.arc_deg * DEG_X);
    const ys = band.deg.map((d) => HORIZON_Y + d * DEG_Y);
    // Past the measured arc, continue the band with ridges of the same height and roughness,
    // blended in from the real edge, so a panning camera never finds an end.
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const spread = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
    const ridge = fbm(70 + i * 13, 5);
    const extend = (from: number, to: number, edgeY: number) => {
      const out: [number, number][] = [];
      const dir = Math.sign(to - from);
      for (let d = 16; d <= Math.abs(to - from); d += 16) {
        const x = from + dir * d;
        const blend = Math.min(1, d / 520);
        const target = mean + spread * 1.4 * ridge(x / 380);
        out.push([x, edgeY + (target - edgeY) * blend]);
      }
      return out;
    };
    const left = extend(xs[0]!, xs[0]! - CONTINUE, ys[0]!).reverse();
    const right = extend(xs.at(-1)!, xs.at(-1)! + CONTINUE, ys.at(-1)!);
    xs.unshift(...left.map((p) => p[0]));
    ys.unshift(...left.map((p) => p[1]));
    xs.push(...right.map((p) => p[0]));
    ys.push(...right.map((p) => p[1]));
    const top = Math.max(...ys);
    const group = new THREE.Group();
    const rendered = renderedBand(i, half);
    // The painted band: all of it until the rendered one has faded in, then only beyond it.
    const painted = flatMaterial({ y0: top - 220, y1: top + 10, transparent: !!rendered });
    const beyond = flatMaterial({ y0: top - 220, y1: top + 10 });
    const parts = rendered ? splitLine(xs, ys, rendered.x0, rendered.x1) : null;
    const covered = new THREE.Mesh(parts ? silhouette(parts[1].xs, parts[1].ys, -1600) : silhouette(xs, ys, -1600), painted);
    group.add(covered);
    if (parts) {
      for (const side of [parts[0], parts[2]]) {
        if (side.xs.length > 1) group.add(new THREE.Mesh(silhouette(side.xs, side.ys, -1600), beyond));
      }
    }
    if (rendered) group.add(...rendered.meshes);
    return {
      group,
      p: PARALLAX[i] ?? 0.1,
      py: PARALLAX[i] ?? 0.1,
      sink: SINK[i] ?? 0.4,
      update: ({ look, time }) => {
        const base = tone(look, DEPTH[i] ?? 0.5);
        for (const mat of [painted, beyond]) {
          mat.uniforms.uBottom.value.set(base);
          mat.uniforms.uTop.value.set(mixHex(base, look.snow, SNOW[i] ?? 0));
        }
        if (rendered) {
          const shown = rendered.update(look, time);
          painted.uniforms.uOpacity.value = 1 - shown;
          covered.visible = shown < 1;
        }
      },
      dispose: () => rendered?.dispose(),
    };
  });
}

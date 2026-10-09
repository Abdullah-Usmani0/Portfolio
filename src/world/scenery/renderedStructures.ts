import * as THREE from 'three';
import indexJson from '../data/structuresRender.json';
import { shadowMaterial, structureMaterial } from '../gl/structure.ts';
import { admit, loadTexture, type Loading } from '../gl/textures.ts';
import { linear, relightFor } from './relight.ts';
import type { Frame } from './types.ts';

/** A rectangle of the valley, in its own units, and the texels that cover it. */
interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  rows: number;
  cols: number;
}
/** What blender/structures_render.py rendered: where each building's render goes, and its shadows' (if it casts any). */
interface Entry extends Region {
  scene: string;
  building: number;
  shadow: Region | null;
}
interface StructureIndex {
  pad: number;
  shadowPad: number;
  scale: number;
  ground: { sun: number; sky: number };
  structures: Record<string, Entry>;
}
const index = indexJson as unknown as StructureIndex;

/** The claude.ai preview carries only the half-size textures (see renderedStrip.ts). */
const ONLY_HALF = import.meta.env.MODE === 'artifact';
const TEXTURES = (
  ONLY_HALF
    ? import.meta.glob(['../textures/structures/*-half.webp', '../textures/structures/*-shadow.webp'], { eager: true, query: '?url', import: 'default' })
    : import.meta.glob('../textures/structures/*.webp', { eager: true, query: '?url', import: 'default' })
) as Record<string, string>;
/** Seconds a building takes to fade in over its painted self, once loaded. */
const FADE = 0.9;
/** Its textures load once the scene is within this many view widths of the view. */
const NEAR = 1.2;
/** The windows' light at full strength (look.windows = 1). */
const GLOW = linear('#ffb565');
/** How high the valley floor stands, for the low sun's last light (see StripLook.deg). */
const DEG = -4;
/** Depth between one building's render and the next, the one on the right in front. */
const STEP = 1e-5;

interface Built {
  id: string;
  entry: Entry;
  mesh: THREE.Mesh;
  shade: THREE.Mesh | null;
  strip: ReturnType<typeof structureMaterial>;
  shadow: ReturnType<typeof shadowMaterial> | null;
  light: Loading | null;
  mask: Loading | null;
  since: number | null;
  /** How far it has faded in since its textures arrived (0–1). */
  fade: number;
  /** Set by the scene: how much of the render to show (a dive opening the painted one instead). */
  show: number;
}

export interface RenderedStructures {
  /** How far every building of the scene has faded in (0–1): the painted ones can go at 1. */
  shown: () => number;
  /** How far one building's render has faded in (0–1), by its number in the scene's dives; 0 if it has none. */
  shownOf: (building: number) => number;
  /** How far one render has faded in (0–1), by its id; 0 if there is none. */
  fadeOf: (id: string) => number;
  /** How much of one building's render to show, by its number in the scene's dives (all with −1… none). */
  show: (building: number, amount: number) => void;
  /** One render's mesh, centred on its frame (to turn it, like the windmill's sails), if loaded into the scene. */
  mesh: (id: string) => THREE.Mesh | null;
  update: (f: Frame) => void;
  dispose: () => void;
}

/** A quad covering a region, centred on the origin, and a mesh of it placed over the region at depth z. */
const placed = (r: Region, material: THREE.Material, z: number) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0), material);
  mesh.position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
};

/**
 * The buildings of `scene` as rendered in Blender, laid over their painted selves in `group`
 * at depth `z`, their shadows on the ground just under them: loaded once the scene nears the
 * view, each fading in once it has, lit for the hour, windows aglow at night. Null when the
 * scene has none rendered. `half` loads the half-size textures (phones); `zOf` puts a render
 * at its own depth instead (the farm's fields lie behind everything on them).
 */
export function renderedStructures(group: THREE.Group, scene: string, o: { z: number; half: boolean; zOf?: (id: string) => number | undefined }): RenderedStructures | null {
  const size = o.half || ONLY_HALF ? '-half' : '';
  const url = (name: string) => TEXTURES[`../textures/structures/${name}.webp`];
  const entries = Object.entries(index.structures ?? {})
    .filter(([id, e]) => e.scene === scene && e.shadow !== undefined && url(`${id}-light${size}`) && (!e.shadow || url(`${id}-shadow`)))
    .sort((a, b) => a[1].x0 - b[1].x0);
  if (entries.length === 0) return null;
  const x0 = Math.min(...entries.map(([, e]) => (e.shadow ?? e).x0));
  const x1 = Math.max(...entries.map(([, e]) => (e.shadow ?? e).x1));
  const glow = new THREE.Color();

  const built: Built[] = entries.map(([id, entry], k) => {
    const strip = structureMaterial(new THREE.Texture(), { scale: index.scale, rows: entry.rows, pad: index.pad });
    // Left to right: the one on the right stands in front of its neighbour's side wall.
    const z = o.zOf?.(id) ?? o.z + k * STEP;
    const mesh = placed(entry, strip.material, z);
    group.add(mesh);
    // Every shadow lies on the ground under every building.
    const shadow = entry.shadow ? shadowMaterial(new THREE.Texture(), { rows: entry.shadow.rows, pad: index.shadowPad, ground: index.ground }) : null;
    const shade = entry.shadow && shadow ? placed(entry.shadow, shadow.material, Math.min(z, o.z) - 0.0005) : null;
    if (shade) group.add(shade);
    return { id, entry, mesh, shade, strip, shadow, light: null, mask: null, since: null, fade: 0, show: 1 };
  });

  const view = { mid: 0 };
  const load = (b: Built) => {
    const away = () => Math.abs((b.entry.x0 + b.entry.x1) / 2 - view.mid) / 2000;
    b.light = loadTexture(url(`${b.id}-light${size}`)!, { grey: false, mipmaps: true, priority: away });
    b.strip.uniforms.uLight.value = b.light.texture;
    if (b.shadow) {
      b.mask = loadTexture(url(`${b.id}-shadow`)!, { grey: true, mipmaps: false, priority: away });
      b.shadow.uniforms.uMask.value = b.mask.texture;
    }
  };

  return {
    shown: () => Math.min(...built.map((b) => b.fade)),
    shownOf(building) {
      const of = built.filter((b) => b.entry.building === building);
      return of.length ? Math.min(...of.map((b) => b.fade)) : 0;
    },
    show(building, amount) {
      for (const b of built) if (building < 0 || b.entry.building === building) b.show = amount;
    },
    mesh: (id) => built.find((b) => b.id === id)?.mesh ?? null,
    fadeOf: (id) => built.find((b) => b.id === id)?.fade ?? 0,
    update(f) {
      const s = group.scale.x || 1;
      const left = (f.camX - f.viewW / 2 - group.position.x) / s;
      const right = (f.camX + f.viewW / 2 - group.position.x) / s;
      const span = f.viewW / s;
      view.mid = (left + right) / 2;
      const near = x1 > left - NEAR * span && x0 < right + NEAR * span;
      const r = relightFor(f.look);
      const w = Math.min(1, f.look.windows * 1.15);
      glow.setRGB(GLOW[0] * w * 1.6, GLOW[1] * w * 1.6, GLOW[2] * w * 1.6);
      for (const b of built) {
        if (near && !b.light) load(b);
        if (b.since === null && b.light?.ready() && (!b.mask || b.mask.ready()) && admit(f.time)) b.since = f.time;
        b.fade = b.since === null ? 0 : Math.min(1, (f.time - b.since) / FADE);
        const op = b.fade * b.show;
        b.strip.uniforms.uOpacity.value = op;
        b.mesh.visible = op > 0;
        if (op > 0) b.strip.set(r, DEG, glow);
        if (b.shade && b.shadow) {
          b.shadow.uniforms.uOpacity.value = op;
          b.shade.visible = op > 0;
          if (op > 0) b.shadow.set(r, DEG);
        }
      }
    },
    dispose() {
      for (const b of built) {
        group.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.strip.material.dispose();
        if (b.shade) {
          group.remove(b.shade);
          b.shade.geometry.dispose();
        }
        b.shadow?.material.dispose();
        b.light?.dispose();
        b.mask?.dispose();
      }
    },
  };
}

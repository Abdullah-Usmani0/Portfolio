import * as THREE from 'three';
import indexJson from '../data/foregroundRender.json';
import { CLIP_SLOTS, type Clip } from '../gl/flat.ts';
import { stripMaterial, type StripLook } from '../gl/strip.ts';
import { admit, loadTexture, type Loading } from '../gl/textures.ts';
import { relightFor } from './relight.ts';
import type { Frame } from './types.ts';

/** The foreground layers rendered in Blender (blender/foreground_render.py). */
export type StripName = 'ridge0' | 'ridge1' | 'valley' | 'bank';

interface Tile {
  i: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
interface StripIndex {
  pad: number;
  layers: Partial<Record<StripName, { scale: number; tilt: number; tiles: Tile[] }>>;
}
const index = indexJson as StripIndex;

/**
 * The claude.ai preview (`vite build --mode artifact`) inlines every asset into one page, under
 * a size limit: it carries only the half-size tiles, and draws them on every screen.
 */
const ONLY_HALF = import.meta.env.MODE === 'artifact';
/** The rendered tiles' textures, by path. */
const TEXTURES = (
  ONLY_HALF
    ? import.meta.glob('../textures/foreground/*-half.webp', { eager: true, query: '?url', import: 'default' })
    : import.meta.glob('../textures/foreground/*.webp', { eager: true, query: '?url', import: 'default' })
) as Record<string, string>;
/** Seconds a tile takes to fade in over the painted layer, once loaded. */
const FADE = 0.9;
/** How far down into a faded-in tile the painted layer is hidden (the tile covers it there). */
const OVERLAP = 40;
/** Tiles load once within this many view widths of the view, and are let go beyond FREE. */
const NEAR = 0.6;
const FREE = 2.2;

interface Loaded {
  mesh: THREE.Mesh;
  strip: ReturnType<typeof stripMaterial>;
  light: Loading;
  mask: Loading;
  since: number | null;
  deg: number;
}

export interface RenderedStrip {
  /** Where the painted layer is covered, for its materials (see flatMaterial's `clip`). */
  clip: Clip;
  /** For a strip with an `edge`: the height at x below which the painted layer still shows (its geometry's `aClip`). */
  clipLine: (x: number) => number;
  /** Load the tiles near the view, let far ones go, fade them in and light them for the hour. */
  update: (f: Frame) => void;
  dispose: () => void;
}

/**
 * A foreground layer as rendered in Blender, in tiles along its length, drawn over the
 * painted layer in `group`: only the tiles near the view are loaded, each fades in once it
 * has, and from then on the painted layer is hidden under it (see `clip`). Null when the
 * layer was not rendered. `half` loads the half-size tiles (phones); `lift` is how far the
 * ground has climbed at x (the bank, which climbs the mountain); `edge` is the ground's edge
 * at x, for a strip that fades out below it (StripLook.fade): then the painted layer is
 * hidden from just above the fade, by the painted geometry's `aClip` (see `clipLine`).
 */
export function renderedStrip(name: StripName, group: THREE.Group, o: { half: boolean; look: StripLook; z: number; lift?: (x: number) => number; edge?: (x: number) => number }): RenderedStrip | null {
  const layer = index.layers[name];
  const tiles = layer?.tiles ?? [];
  const size = o.half || ONLY_HALF ? '-half' : '';
  const url = (t: Tile, kind: string) => TEXTURES[`../textures/foreground/${name}-${String(t.i).padStart(2, '0')}-${kind}${size}.webp`];
  if (!layer || tiles.length === 0 || tiles.some((t) => !url(t, 'light') || !url(t, 'mask'))) return null;
  const width = tiles[0]!.x1 - tiles[0]!.x0;
  const x0 = tiles[0]!.x0;
  const slots = Math.round((tiles.at(-1)!.x1 - x0) / width);
  if (slots > CLIP_SLOTS) throw new Error(`${name}: ${slots} tiles, more than a clip holds`);
  const clip: Clip = { x0, width, ys: new Float32Array(CLIP_SLOTS).fill(1e9) };
  const slotOf = (t: Tile) => Math.round((t.x0 - x0) / width);
  const loaded = new Map<number, Loaded>();
  // Where the view was last frame, in the layer's units: tiles nearest its middle download first.
  const view = { mid: 0, span: 1 };

  const load = (t: Tile) => {
    // How many view widths from the middle of the view; the light before the mask.
    const away = () => Math.max(0, Math.abs((t.x0 + t.x1) / 2 - view.mid) - width / 2) / view.span;
    // Drawn about a texel to a pixel or larger: no mipmaps needed. The light is in colour;
    // the mask (coverage and sway) is greyscale.
    const light = loadTexture(url(t, 'light')!, { grey: false, priority: away });
    const mask = loadTexture(url(t, 'mask')!, { grey: true, priority: () => away() + 0.01 });
    const w = t.x1 - t.x0;
    const strip = stripMaterial(light.texture, mask.texture, { scale: layer.scale, rows: t.y1 - t.y0, pad: index.pad, width: w, look: o.look });
    const segs = o.lift || o.edge ? Math.max(1, Math.round(w / 16)) : 1;
    const geo = new THREE.PlaneGeometry(w, t.y1 - t.y0, segs, 1);
    geo.translate((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, 0);
    const pos = geo.getAttribute('position');
    const lift = new Float32Array(pos.count);
    const edge = new Float32Array(pos.count);
    for (let k = 0; k < pos.count; k++) {
      if (o.lift) lift[k] = o.lift(pos.getX(k));
      if (o.edge) edge[k] = o.edge(pos.getX(k));
    }
    geo.setAttribute('aLift', new THREE.BufferAttribute(lift, 1));
    geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    const mesh = new THREE.Mesh(geo, strip.material);
    mesh.position.z = o.z;
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    // How high the tile stands, for the low sun's last light: the climbing bank rises into it.
    const climb = o.lift ? o.lift((t.x0 + t.x1) / 2) : 0;
    loaded.set(t.i, { mesh, strip, light, mask, since: null, deg: o.look.deg + (climb / 1400) * 40 });
  };

  const unload = (t: Tile) => {
    const got = loaded.get(t.i);
    if (!got) return;
    group.remove(got.mesh);
    got.mesh.geometry.dispose();
    got.strip.material.dispose();
    got.light.dispose();
    got.mask.dispose();
    loaded.delete(t.i);
    clip.ys[slotOf(t)] = 1e9;
  };

  const fadeFrom = o.look.fade?.[0] ?? 0;
  return {
    clip,
    clipLine: (x) => (o.edge ? o.edge(x) - fadeFrom : 0),
    update(f) {
      const s = group.scale.x || 1;
      const left = (f.camX - f.viewW / 2 - group.position.x) / s;
      const right = (f.camX + f.viewW / 2 - group.position.x) / s;
      const span = f.viewW / s;
      view.mid = (left + right) / 2;
      view.span = span;
      const r = relightFor(f.look);
      const haze = Math.min(0.9, o.look.haze * (0.7 + 0.6 * f.look.mist));
      // From the middle of the view outwards, so the tiles in view are shown first.
      const order = [...tiles].sort((a, b) => Math.abs((a.x0 + a.x1) / 2 - view.mid) - Math.abs((b.x0 + b.x1) / 2 - view.mid));
      for (const t of order) {
        const near = t.x1 > left - NEAR * span && t.x0 < right + NEAR * span;
        const far = t.x1 < left - FREE * span || t.x0 > right + FREE * span;
        if (near && !loaded.has(t.i)) load(t);
        else if (far && loaded.has(t.i)) unload(t);
        const got = loaded.get(t.i);
        if (!got) continue;
        // By the world's clock, so the fade keeps real time even when frames come slowly.
        if (got.since === null && got.light.ready() && got.mask.ready() && admit(f.time)) got.since = f.time;
        const shown = got.since === null ? 0 : Math.min(1, (f.time - got.since) / FADE);
        got.mesh.visible = shown > 0;
        got.strip.uniforms.uOpacity.value = shown;
        if (shown > 0) got.strip.set(r, haze, got.deg);
        // Covered above the tile's foot, or (fading out below an edge) from just above the fade.
        clip.ys[slotOf(t)] = shown < 1 ? 1e9 : o.edge ? OVERLAP : t.y0 + OVERLAP;
      }
    },
    dispose() {
      for (const t of tiles) unload(t);
    },
  };
}

/** A mesh with the tiles' shader, for compiling it before any tile has loaded (see engine.ts). */
export function stripWarmup(): THREE.Mesh {
  const look: StripLook = { haze: 0, sway: 0, shadeY0: 0, shadeY1: 1, shadeFloor: 1, deg: 0 };
  const strip = stripMaterial(new THREE.Texture(), new THREE.Texture(), { scale: 1, rows: 1, pad: 0, width: 1, look });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), strip.material);
  mesh.frustumCulled = false;
  return mesh;
}

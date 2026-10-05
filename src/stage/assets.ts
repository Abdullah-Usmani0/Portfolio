import { useEffect, useState } from 'react';

export type Vec3 = [number, number, number];

/** A Blender camera, described so three can reproduce it (36 mm sensor, AUTO fit). */
export interface CameraMeta {
  position: Vec3;
  target: Vec3;
  lensMm: number;
  sensorMm: number;
  /** Lens shift in units of the larger sensor dimension (Blender's convention). */
  shiftX: number;
  shiftY: number;
  /** Vertical field of view at 16:9, for reference. */
  fovDeg: number;
}

/** Shape of public/models/valley_m0.json (written by blender/export_web_m0.py). */
export interface ValleyMeta {
  frame: string;
  camera: { establish: CameraMeta; hero: CameraMeta };
  landmarks: { village: Vec3; farm: Vec3; observatory: Vec3; bridge: Vec3; k2Summit: Vec3 };
  hero: { position: Vec3; faceK2: number };
  villagers: { name: string; position: Vec3; rotY: number }[];
  pathWalk: Vec3[];
  /** [x, y, z, scale, rotY, type(0 pine, 1 round), r, g, b, sunVis dawn, day, golden, dusk, night] */
  trees: number[][];
  riverY: Vec3[];
  heightfield: { url: string; x0: number; z0: number; step: number; nx: number; nz: number; encoding: 'int16-cm' };
}

export interface Heightfield {
  x0: number;
  z0: number;
  step: number;
  nx: number;
  nz: number;
  /** Metres, row-major, rows along +z. */
  heights: Float32Array;
}

/** Bilinear ground height; NaN outside the field. */
export function sampleHeight(h: Heightfield, x: number, z: number): number {
  const fx = (x - h.x0) / h.step;
  const fz = (z - h.z0) / h.step;
  if (fx < 0 || fz < 0 || fx > h.nx - 1 || fz > h.nz - 1) return Number.NaN;
  const i = Math.min(h.nx - 2, Math.floor(fx));
  const j = Math.min(h.nz - 2, Math.floor(fz));
  const tx = fx - i;
  const tz = fz - j;
  const at = (ii: number, jj: number) => h.heights[jj * h.nx + ii] ?? 0;
  const a = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
  const b = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
  return a * (1 - tz) + b * tz;
}

let metaPromise: Promise<ValleyMeta> | null = null;
let fieldPromise: Promise<Heightfield> | null = null;

export function loadValleyMeta(): Promise<ValleyMeta> {
  metaPromise ??= fetch('/models/valley_m0.json').then((r) => {
    if (!r.ok) throw new Error(`valley_m0.json: HTTP ${r.status}`);
    return r.json() as Promise<ValleyMeta>;
  });
  return metaPromise;
}

export function loadHeightfield(meta: ValleyMeta): Promise<Heightfield> {
  fieldPromise ??= fetch(meta.heightfield.url)
    .then((r) => {
      if (!r.ok) throw new Error(`heightfield: HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const raw = new Int16Array(buf);
      const heights = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) heights[i] = (raw[i] ?? 0) / 100;
      const { x0, z0, step, nx, nz } = meta.heightfield;
      return { x0, z0, step, nx, nz, heights };
    });
  return fieldPromise;
}

/** Suspense-free loader hook: returns null until ready. */
export function useValleyData(): { meta: ValleyMeta; field: Heightfield } | null {
  const [data, setData] = useState<{ meta: ValleyMeta; field: Heightfield } | null>(null);
  useEffect(() => {
    let alive = true;
    loadValleyMeta()
      .then(async (meta) => ({ meta, field: await loadHeightfield(meta) }))
      .then((d) => alive && setData(d))
      .catch((err: unknown) => console.error('[stage] valley data failed', err));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

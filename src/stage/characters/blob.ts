import { DataTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

let alpha: DataTexture | null = null;

/** A soft radial falloff, built from data so it needs no canvas or file. */
function blobAlpha(): DataTexture {
  if (alpha) return alpha;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(((x + 0.5) / n) * 2 - 1, ((y + 0.5) / n) * 2 - 1);
      const a = Math.max(0, 1 - d);
      const v = Math.round(255 * a * a * (3 - 2 * a));
      data.set([v, v, v, 255], (y * n + x) * 4);
    }
  }
  alpha = new DataTexture(data, n, n);
  alpha.magFilter = LinearFilter;
  alpha.minFilter = LinearFilter;
  alpha.needsUpdate = true;
  return alpha;
}

/** Blob shadows ground every character cheaply, on every tier. */
export function createBlobFactory() {
  const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    color: 0x0a1406,
    transparent: true,
    opacity: 0.45,
    alphaMap: blobAlpha(),
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return {
    make: (size: number) => {
      const m = new Mesh(geometry, material);
      m.scale.setScalar(size);
      m.renderOrder = 1;
      return m;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

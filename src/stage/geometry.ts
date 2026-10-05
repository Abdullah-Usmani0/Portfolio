import { BufferAttribute, type BufferGeometry, type Mesh } from 'three';

/**
 * A mesh's geometry with its node transform baked in, positions as plain floats.
 *
 * Mesh quantization stores positions as normalized int16 and moves the dequantization into
 * the node's translation and scale. Prototypes used for instancing must carry that in the
 * geometry itself — and baking a scale into int16 data would clip, so positions are
 * widened to Float32 first.
 */
export function bakedGeometry(mesh: Mesh): BufferGeometry {
  mesh.updateMatrix();
  const g = mesh.geometry.clone();
  const pos = g.getAttribute('position');
  const wide = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    wide[i * 3] = pos.getX(i);
    wide[i * 3 + 1] = pos.getY(i);
    wide[i * 3 + 2] = pos.getZ(i);
  }
  g.setAttribute('position', new BufferAttribute(wide, 3));
  g.deleteAttribute('normal');
  g.applyMatrix4(mesh.matrix);
  g.computeBoundingSphere();
  return g;
}

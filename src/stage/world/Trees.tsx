import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from 'three';
import type { ValleyMeta } from '../assets.ts';
import { bakedGeometry } from '../geometry.ts';
import { withBakedLight } from '../lightBake.ts';

const URL = '/models/trees_m0.glb';

/** Crowns sway with a breeze that grows with height; trunks stay put. */
function windy(material: MeshLambertMaterial, time: { value: number }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float k = max(0.0, position.y - 1.0) / 5.0;
          float gust = sin(uTime * 1.25 + ip.x * 0.045 + ip.z * 0.06) + 0.35 * sin(uTime * 2.9 + ip.x * 0.2);
          transformed.x += gust * 0.09 * k * k;
          transformed.z += gust * 0.05 * k * k;
        #endif`,
      );
  };
}

/** Thousands of trees in four draw calls: two prototypes × (trunk, crown). */
export function Trees({ meta, count }: { meta: ValleyMeta; count: number }) {
  const { nodes } = useGLTF(URL);
  const time = useMemo(() => ({ value: 0 }), []);

  const meshes = useMemo(() => {
    const trunkMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const crownMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    windy(crownMat, time);
    withBakedLight(trunkMat, 'aVisA', 'aVisB', 'tree-trunk', 0.6);
    withBakedLight(crownMat, 'aVisA', 'aVisB', 'tree-crown', 0.6);
    const geo = (name: string): BufferGeometry | undefined => {
      const mesh = nodes[name] as Mesh | undefined;
      return mesh?.isMesh ? bakedGeometry(mesh) : undefined;
    };
    const rows = meta.trees.filter((_, i) => i % Math.max(1, Math.round(meta.trees.length / Math.max(1, count))) === 0);
    const out: InstancedMesh[] = [];
    for (const type of [0, 1]) {
      const kind = type === 0 ? 'pine' : 'round';
      const mine = rows.filter((r) => r[5] === type);
      const trunkGeo = geo(`tree_${kind}_trunk`);
      const crownGeo = geo(`tree_${kind}_crown`);
      if (!trunkGeo || !crownGeo || mine.length === 0) continue;
      // Baked sun visibility per tree (five looks) and a constant sky openness under the canopy.
      const visA = new Float32Array(mine.length * 4);
      const visB = new Float32Array(mine.length * 4);
      mine.forEach((r, i) => {
        visA.set([r[9] ?? 1, r[10] ?? 1, r[11] ?? 1, r[12] ?? 1], i * 4);
        visB.set([r[13] ?? 1, 0.82, 0, 1], i * 4);
      });
      for (const g of [trunkGeo, crownGeo]) {
        g.setAttribute('aVisA', new InstancedBufferAttribute(visA, 4));
        g.setAttribute('aVisB', new InstancedBufferAttribute(visB, 4));
      }
      const trunks = new InstancedMesh(trunkGeo, trunkMat, mine.length);
      const crowns = new InstancedMesh(crownGeo, crownMat, mine.length);
      const m = new Matrix4();
      const q = new Quaternion();
      const up = new Vector3(0, 1, 0);
      const c = new Color();
      mine.forEach((r, i) => {
        const [x = 0, y = 0, z = 0, s = 1, rot = 0, , cr = 1, cg = 1, cb = 1] = r;
        q.setFromAxisAngle(up, rot);
        m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s));
        trunks.setMatrixAt(i, m);
        crowns.setMatrixAt(i, m);
        crowns.setColorAt(i, c.setRGB(cr, cg, cb));
      });
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      trunks.computeBoundingSphere();
      crowns.computeBoundingSphere();
      out.push(trunks, crowns);
    }
    return out;
  }, [nodes, meta, count, time]);

  useEffect(
    () => () => {
      meshes.forEach((m) => {
        m.geometry.dispose();
        m.dispose();
      });
    },
    [meshes],
  );

  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
  });

  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}

useGLTF.preload(URL);

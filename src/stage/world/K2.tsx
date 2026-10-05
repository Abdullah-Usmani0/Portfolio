import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MeshLambertMaterial, Vector3, type Mesh } from 'three';
import { lightAt } from '@/sim/world/timeOfDay.ts';
import { stage } from '../store.ts';

const URL = '/models/k2_m0.glb';

/**
 * K2, meshed from real terrain data in Blender. Snow (the brightest vertex colours)
 * gets an extra "alpenglow" term so the summit blushes pink at dusk and gold at dawn,
 * even while the valley below sits in shadow.
 */
export function K2() {
  const { scene } = useGLTF(URL);

  const { material, alpen } = useMemo(() => {
    const alpen = { value: new Vector3() };
    const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uAlpen = alpen;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uAlpen;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          #ifdef USE_COLOR
            float snow = smoothstep(0.62, 0.9, dot(vColor.rgb, vec3(0.3333)));
            totalEmissiveRadiance += uAlpen * snow;
          #endif`,
        );
    };
    return { material, alpen };
  }, []);

  useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.material = material;
    });
  }, [scene, material]);

  useFrame(() => {
    const l = lightAt(stage.getState().tod);
    alpen.value.set(...l.alpenglowColor).multiplyScalar(l.alpenglow * 0.45);
  });

  return <primitive object={scene} />;
}

useGLTF.preload(URL);

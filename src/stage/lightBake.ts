import { Vector4, type Material, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { lookWeights } from '@/sim/world/timeOfDay.ts';

/**
 * Baked light, blended live. Blender bakes, per vertex (or per tree), how visible the sun is
 * at each of the five looks plus how open the sky is. Every frame we blend those with the
 * same weights the lights blend with, and scale the shader's direct and indirect light.
 *
 * One set of uniforms is shared by every patched material, so a frame updates it once.
 */
export const bakedUniforms = {
  uVisW: { value: new Vector4(1, 0, 0, 0) },
  uVisN: { value: 0 },
};

export function updateBakedLight(tod: number): void {
  const [dawn, day, golden, dusk, night] = lookWeights(tod);
  bakedUniforms.uVisW.value.set(dawn, day, golden, dusk);
  bakedUniforms.uVisN.value = night;
}

type Compile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void;

/**
 * Patch a Lambert material to read baked visibility from two vec4 attributes:
 *   a = (dawn, day, golden, dusk) sun visibility, b = (night, ao, –, –).
 * Composes with any existing onBeforeCompile, and gives the program its own cache key —
 * three caches programs by the hook's source text, which composed hooks share.
 */
export function withBakedLight(material: Material, attrA: string, attrB: string, key: string, aoStrength = 0.85): void {
  const prev: Compile = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    shader.uniforms.uVisW = bakedUniforms.uVisW;
    shader.uniforms.uVisN = bakedUniforms.uVisN;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 ${attrA};
        attribute vec4 ${attrB};
        uniform vec4 uVisW;
        uniform float uVisN;
        varying float vSunVis;
        varying float vSkyVis;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSunVis = dot(${attrA}, uVisW) + ${attrB}.x * uVisN;
        vSkyVis = ${attrB}.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSunVis;\nvarying float vSkyVis;')
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= vSunVis;
        reflectedLight.indirectDiffuse *= mix(1.0, vSkyVis, ${aoStrength.toFixed(3)});`,
      );
  };
  material.customProgramCacheKey = () => `baked-light:${key}`;
}

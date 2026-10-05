import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { createRng } from '@/sim/rng.ts';
import { fillColor, lightAt, sunDirection } from '@/sim/world/timeOfDay.ts';
import { sampleHeight, type Heightfield, type ValleyMeta } from '../assets.ts';
import { stage } from '../store.ts';

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec3 aOffset;
  attribute vec4 aParams; // height, rotation, hue, phase
  uniform float uTime;
  uniform float uWind;
  varying float vY;
  varying float vHue;
  void main() {
    float h = aParams.x;
    float c = cos(aParams.y), s = sin(aParams.y);
    vec3 p = position;
    p.xz = mat2(c, -s, s, c) * p.xz;
    p.y *= h;
    float bend = (sin(uTime * 1.7 + aOffset.x * 0.09 + aOffset.z * 0.07 + aParams.w) * 0.5 + 0.5);
    float gust = sin(uTime * 0.6 + aOffset.x * 0.02) * 0.5 + 0.5;
    float k = position.y * position.y;
    p.x += (0.12 + 0.35 * gust) * uWind * bend * k * h;
    p.z += 0.12 * uWind * bend * k * h;
    vec4 world = vec4(aOffset + p, 1.0);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    vY = position.y;
    vHue = aParams.z;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform vec3 uTipDry;
  uniform vec3 uSky;     // hemisphere sky colour × intensity
  uniform vec3 uGround;  // hemisphere ground colour × intensity
  uniform vec3 uSun;     // sun colour × intensity
  uniform float uSunUp;  // how high the sun stands (0 horizon … 1 zenith)
  varying float vY;
  varying float vHue;
  void main() {
    vec3 albedo = mix(uBase, mix(uTip, uTipDry, vHue), smoothstep(0.0, 1.0, vY));
    // Lambert-equivalent to the terrain under the same lights, with blades treated as
    // mostly upward-facing and their tips catching (and glowing through) the sun.
    vec3 fill = mix(uGround, uSky, 0.72 + 0.28 * vY);
    vec3 direct = uSun * (0.18 + 0.6 * uSunUp) * (0.45 + 0.55 * vY);
    vec3 col = albedo * (fill + direct) * RECIPROCAL_PI;
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

/** One blade: a tapered strip of 3 segments (7 verts, 5 tris), height 1, facing +z. */
function bladeInto<G extends BufferGeometry>(g: G): G {
  const w = 0.09;
  const pos = [-w, 0, 0, w, 0, 0, -w * 0.75, 0.35, 0, w * 0.75, 0.35, 0, -w * 0.4, 0.7, 0, w * 0.4, 0.7, 0, 0, 1, 0];
  const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const segDist = (px: number, pz: number, a: number[], b: number[]) => {
  const [ax = 0, , az = 0] = a;
  const [bx = 0, , bz = 0] = b;
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** Wind-swept grass on the hill around the camera — denser near the viewer. */
export function Grass({ meta, field, count }: { meta: ValleyMeta; field: Heightfield; count: number }) {
  const mesh = useMemo(() => {
    const rng = createRng('grass-m0');
    const [cx = 0, , cz = 0] = meta.camera.establish.position;
    const offsets = new Float32Array(count * 3);
    const params = new Float32Array(count * 4);
    let n = 0;
    let guard = 0;
    while (n < count && guard++ < count * 6) {
      // polar sampling biased toward the camera, mostly in front of it (towards -z)
      const r = 0.6 + Math.pow(rng.next(), 1.7) * 150;
      const a = -Math.PI / 2 + (rng.next() - 0.5) * Math.PI * 1.35;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const y = sampleHeight(field, x, z);
      if (Number.isNaN(y)) continue;
      let onPath = false;
      for (let i = 0; i < meta.pathWalk.length - 1 && !onPath; i++) {
        onPath = segDist(x, z, meta.pathWalk[i] ?? [0, 0, 0], meta.pathWalk[i + 1] ?? [0, 0, 0]) < 2.4;
      }
      if (onPath) continue;
      offsets.set([x, y - 0.05, z], n * 3);
      params.set([0.35 + rng.next() * 0.55, rng.next() * Math.PI * 2, rng.chance(0.06) ? 0.7 : rng.next() * 0.25, rng.next() * 6.28], n * 4);
      n++;
    }
    const geo = bladeInto(new InstancedBufferGeometry());
    geo.instanceCount = n;
    geo.setAttribute('aOffset', new InstancedBufferAttribute(offsets.subarray(0, n * 3), 3));
    geo.setAttribute('aParams', new InstancedBufferAttribute(params.subarray(0, n * 4), 4));
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      fog: true,
      side: 2,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uWind: { value: 1 },
          // The hill's own vertex colours (linear): blades start at the ground and lift brighter.
          uBase: { value: new Vector3(0.07, 0.22, 0.06) },
          uTip: { value: new Vector3(0.17, 0.42, 0.12) },
          uTipDry: { value: new Vector3(0.32, 0.4, 0.14) },
          uSky: { value: new Vector3(1, 1, 1) },
          uGround: { value: new Vector3(0.5, 0.5, 0.5) },
          uSun: { value: new Vector3(1, 1, 1) },
          uSunUp: { value: 0.5 },
        },
      ]),
    });
    const m = new Mesh(geo, material);
    m.frustumCulled = false;
    return m;
  }, [meta, field, count]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );

  useFrame(({ clock }) => {
    const l = lightAt(stage.getState().tod);
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uTime!.value = clock.elapsedTime;
    const [, sy] = sunDirection(l);
    u.uSunUp!.value = Math.max(0, sy);
    (u.uSun!.value as Vector3).set(...l.sunColor).multiplyScalar(l.sunIntensity);
    (u.uSky!.value as Vector3).set(...fillColor(l)).multiplyScalar(l.hemiIntensity);
    (u.uGround!.value as Vector3).set(...l.ground).multiplyScalar(l.hemiIntensity);
  });

  return <primitive object={mesh} />;
}

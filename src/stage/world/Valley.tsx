import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Color,
  MeshBasicMaterial,
  MeshLambertMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type Material,
  type Mesh,
} from 'three';
import { fillColor, lightAt, sunDirection } from '@/sim/world/timeOfDay.ts';
import { withBakedLight } from '../lightBake.ts';
import { stage } from '../store.ts';

const URL = '/models/valley_m0.glb';

const waterVertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const waterFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;    // sky radiance near the horizon (what the water mirrors)
  uniform vec3 uFill;   // sky fill × intensity
  uniform vec3 uSun;    // sun colour × intensity
  uniform float uSunUp; // 0 horizon … 1 zenith
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    float across = abs(vUv.x - 0.5) * 2.0;           // 0 centre … 1 bank
    float flow = vUv.y * 40.0 - uTime * 1.6;           // metres downstream
    float ripple = sin(flow * 0.9 + sin(vUv.x * 9.0 + uTime) * 1.5) * 0.5 + 0.5;
    float streak = smoothstep(0.82, 1.0, sin(flow * 0.35 + vUv.x * 13.0) * 0.5 + 0.5);

    // The body of the water is lit like everything else, so it darkens with the day.
    vec3 body = mix(uDeep, uShallow, smoothstep(0.15, 0.95, across));
    vec3 light = uFill + uSun * (0.25 + 0.75 * uSunUp);
    vec3 col = body * light * RECIPROCAL_PI;

    // It mirrors the sky, more so at grazing angles (Schlick), rippled by the current.
    vec3 V = normalize(cameraPosition - vWorld);
    float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
    col = mix(col, uSky, clamp(fresnel * (0.55 + 0.15 * ripple), 0.0, 0.6));
    col += uSun * streak * 0.035 * uSunUp;

    // Foam where the water meets the bank — lit, never glowing.
    float foam = smoothstep(0.86, 0.98, across) * (0.55 + 0.45 * ripple);
    col = mix(col, vec3(0.85, 0.9, 0.95) * light * RECIPROCAL_PI, foam * 0.7);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

/** The Blender-built valley: terrain, river, ridges, village, farm, observatory, clouds, flowers, lights. */
export function Valley() {
  const { scene } = useGLTF(URL);

  const mats = useMemo(() => {
    const land = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    // Terrain and ridges carry baked sun visibility + sky occlusion for each look.
    const bakedLand = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    withBakedLight(bakedLand, '_visa', '_visb', 'land');
    const clouds = new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new Color('#ffffff') });
    const windows = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const lanterns = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const fireflies = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true });
    const water = new ShaderMaterial({
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDeep: { value: new Vector3(0.02, 0.11, 0.22) },
          uShallow: { value: new Vector3(0.06, 0.28, 0.38) },
          uSky: { value: new Vector3(0.5, 0.65, 0.85) },
          uFill: { value: new Vector3(1, 1, 1) },
          uSun: { value: new Vector3(1, 1, 1) },
          uSunUp: { value: 0.5 },
        },
      ]),
    });
    return { land, bakedLand, clouds, windows, lanterns, fireflies, water };
  }, []);

  useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const byName: Record<string, Material> = {
        Terrain: mats.bakedLand,
        Ridges: mats.bakedLand,
        River: mats.water,
        Clouds: mats.clouds,
        Windows: mats.windows,
        Lanterns: mats.lanterns,
        Fireflies: mats.fireflies,
      };
      mesh.material = byName[mesh.name] ?? mats.land;
      mesh.frustumCulled = mesh.name !== 'Terrain';
    });
  }, [scene, mats]);

  useFrame(({ clock }) => {
    const l = lightAt(stage.getState().tod);
    const t = clock.elapsedTime;
    // Emissive HDR levels > 1 are what the bloom pass picks up at dusk and night.
    mats.windows.color.setScalar(0.25 + l.windows);
    mats.lanterns.color.setScalar(0.3 + l.lanterns);
    mats.fireflies.color.setScalar(l.fireflies * (0.75 + 0.25 * Math.sin(t * 3.1)));
    mats.fireflies.opacity = Math.min(1, l.fireflies);
    mats.fireflies.visible = l.fireflies > 0.01;
    // Clouds take the colour of the light: white at noon, pink at dusk, slate at night.
    mats.clouds.emissive.setRGB(
      l.skyHorizon[0] * 0.35 + l.sunColor[0] * 0.08,
      l.skyHorizon[1] * 0.35 + l.sunColor[1] * 0.08,
      l.skyHorizon[2] * 0.35 + l.sunColor[2] * 0.08,
    );
    const u = mats.water.uniforms;
    u.uTime!.value = t;
    // Water mirrors the sky above the far bank, which is bluer than the horizon line itself.
    (u.uSky!.value as Vector3).set(
      (l.skyTop[0] + l.skyHorizon[0]) / 2,
      (l.skyTop[1] + l.skyHorizon[1]) / 2,
      (l.skyTop[2] + l.skyHorizon[2]) / 2,
    );
    (u.uFill!.value as Vector3).set(...fillColor(l)).multiplyScalar(l.hemiIntensity);
    (u.uSun!.value as Vector3).set(...l.sunColor).multiplyScalar(l.sunIntensity);
    u.uSunUp!.value = Math.max(0, sunDirection(l)[1]);
  });

  return <primitive object={scene} />;
}

useGLTF.preload(URL);

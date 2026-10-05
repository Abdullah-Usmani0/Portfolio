import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, ShaderMaterial, Vector3, type Mesh } from 'three';
import { lightAt, sunDirection } from '@/sim/world/timeOfDay.ts';
import { stage } from '../store.ts';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pinned to the far plane
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uMoonDir;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.65, h), 0.75));
    col = mix(col, uHorizon * 0.85, smoothstep(0.0, -0.25, h));

    // sun: a soft disc and a wide warm glow that fades at night
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 10.0) * 0.22) * (1.0 - uStars);

    // stars: one in ~400 cells, twinkling, only above the horizon
    vec3 q = d * 420.0;
    float r = hash(floor(q));
    float star = step(0.9972, r) * smoothstep(0.04, 0.18, h);
    float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 3.0) + r * 60.0);
    col += vec3(0.9, 0.95, 1.0) * star * tw * uStars * 1.6;

    // moon: a ~1.2° disc (stylised, a little larger than life) with a soft limb and a halo
    float m = dot(d, uMoonDir);
    float disc = smoothstep(0.999895, 0.999912, m);
    vec3 moonCol = vec3(1.0, 0.97, 0.9) * (0.82 + 0.18 * smoothstep(0.999895, 0.99998, m));
    col = mix(col, moonCol * 3.2, disc * uStars);
    col += vec3(0.6, 0.7, 1.0) * pow(max(m, 0.0), 400.0) * uStars * 0.18;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A gradient sky dome with a sun, twinkling stars and a moon. */
export function Sky() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Vector3() },
          uHorizon: { value: new Vector3() },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: new Vector3(1, 1, 1) },
          uMoonDir: { value: new Vector3(-0.32, 0.27, -0.91).normalize() },
          uStars: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  useFrame(({ camera, clock }) => {
    const l = lightAt(stage.getState().tod);
    const u = material.uniforms;
    (u.uTop!.value as Vector3).set(...l.skyTop);
    (u.uHorizon!.value as Vector3).set(...l.skyHorizon);
    (u.uSunDir!.value as Vector3).set(...sunDirection(l));
    (u.uSunColor!.value as Vector3).set(...l.sunColor);
    u.uStars!.value = l.stars;
    u.uTime!.value = clock.elapsedTime;
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[9000, 48, 24]} />
    </mesh>
  );
}

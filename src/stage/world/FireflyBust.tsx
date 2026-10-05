import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  Plane,
  Points,
  Raycaster,
  ShaderMaterial,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { createRng } from '@/sim/rng.ts';
import { CONTEXT_LAYERS, LAYER_COLORS, buildBustTargets, parseBustMesh, type BustTargets } from '@/sim/particles/bust.ts';
import { smootherstep } from '../director.ts';
import { sampleHeight, type Heightfield, type Vec3 } from '../assets.ts';
import { stage } from '../store.ts';

/** Where the bust floats: over the meadow below the hilltop, facing the hill (+z). */
export const BUST_AT: [number, number] = [-52, 168];
export const BUST_SCALE = 14;
/** Live morph state the camera reads: 0 = bust, 1 = poured into the pond. */
export const bustState = { morph: 0 };
export const BUST_LIFT = 12;
export function bustBase(field: Heightfield): Vec3 {
  const g = sampleHeight(field, BUST_AT[0], BUST_AT[1]);
  return [BUST_AT[0], (Number.isNaN(g) ? 20 : g) + BUST_LIFT, BUST_AT[1]];
}

const vertexShader = /* glsl */ `
  attribute vec3 aPond;
  attribute vec3 aSwarm;
  attribute float aLayer;
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uGather;
  uniform float uMorph;
  uniform float uPixelRatio;
  uniform float uProj;
  uniform float uSize;
  uniform float uPointerOn;
  uniform vec3 uPointer;
  uniform vec3 uLayerColors[${CONTEXT_LAYERS.length}];
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = aRand.x;
    // Gather: each firefly rises on its own schedule, so the bust assembles like a breeze.
    float g = smoothstep(d * 0.55, d * 0.55 + 0.45, uGather);
    // Pour: the head drains from the crown down, filling the terraces from the top.
    float md = (1.0 - clamp(position.y, 0.0, 1.0)) * 0.6 + d * 0.15;
    float m = smoothstep(md, md + 0.25, uMorph);
    vec3 p = mix(aSwarm, mix(position, aPond, m), g);

    // A breeze: loose fireflies wander, formed ones only shimmer.
    float t = uTime * 0.55 + aRand.z * 6.2831;
    vec3 drift = vec3(sin(t + p.y * 4.1), sin(t * 1.3 + p.z * 3.7), cos(t * 0.9 + p.x * 3.3));
    float loose = 1.0 - g * 0.92;
    p += drift * (0.003 + 0.07 * loose);

    // The cursor parts them with a little swirl.
    vec3 dp = p - uPointer;
    float push = uPointerOn * smoothstep(0.32, 0.0, length(dp));
    p += normalize(dp + vec3(1e-4)) * push * 0.1 + vec3(-dp.z, 0.0, dp.x) * push * 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.55 + aRand.y * 1.2) * uSize * uProj * uPixelRatio / max(-mv.z, 0.1);

    vec3 fire = mix(vec3(0.78, 1.0, 0.24), vec3(1.0, 0.72, 0.28), aRand.w * aRand.w);
    float lipGlow = fract(aLayer) > 0.25 ? 2.4 : 1.4;
    vColor = mix(fire, uLayerColors[int(aLayer)] * lipGlow, m);
    float tw = 0.62 + 0.38 * sin(uTime * (2.0 + aRand.w * 3.0) + aRand.z * 40.0);
    vAlpha = tw * mix(0.5, 1.0, g);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor * uIntensity, a * a * vAlpha);
  }
`;

/**
 * The Mind Garden spike: fireflies over the night meadow gather into a head-and-shoulders
 * bust as the camera arrives, then pour into a terraced pond — one terrace per context
 * block, assembled in order — and back. Points are sampled on the device from a small CC0
 * mesh; a lower tier simply draws fewer of them.
 */
export function FireflyBust({ field, maxPoints, drawPoints }: { field: Heightfield; maxPoints: number; drawPoints: number }) {
  const [targets, setTargets] = useState<BustTargets | null>(null);
  // Built once for the starting tier; a later step down only draws fewer points.
  const [cap] = useState(maxPoints);
  const group = useRef<Group>(null);
  const base = useMemo(() => bustBase(field), [field]);
  const state = useRef({ morph: 0, pointerOn: 0, restSince: -1, yaw: 0 });
  const tmp = useMemo(() => ({ ray: new Raycaster(), ndc: new Vector2(), plane: new Plane(), hit: new Vector3(), n: new Vector3() }), []);

  useEffect(() => {
    let alive = true;
    fetch('/models/bust_m0.bin')
      .then((r) => {
        if (!r.ok) throw new Error(`bust_m0.bin: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (!alive) return;
        const t0 = performance.now();
        const t = buildBustTargets(parseBustMesh(buf), cap, createRng('firefly-bust'));
        if (import.meta.env.DEV) console.info(`[bust] ${cap} points in ${(performance.now() - t0).toFixed(0)} ms`);
        setTargets(t);
      })
      .catch((err: unknown) => console.error('[bust] failed', err));
    return () => {
      alive = false;
    };
  }, [cap]);

  const points = useMemo(() => {
    if (!targets) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(targets.bust, 3));
    g.setAttribute('aPond', new BufferAttribute(targets.pond, 3));
    g.setAttribute('aSwarm', new BufferAttribute(targets.swarm, 3));
    g.setAttribute('aLayer', new BufferAttribute(targets.layer, 1));
    g.setAttribute('aRand', new BufferAttribute(targets.rand, 4));
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uGather: { value: 0 },
        uMorph: { value: 0 },
        uPixelRatio: { value: 1 },
        uProj: { value: 1000 },
        uSize: { value: 0.012 },
        uPointerOn: { value: 0 },
        uPointer: { value: new Vector3(99, 99, 99) },
        uIntensity: { value: 2.2 },
        uLayerColors: { value: LAYER_COLORS.map((c) => new Color(c)) },
      },
    });
    const p = new Points(g, material);
    p.frustumCulled = false;
    return p;
  }, [targets]);

  useEffect(
    () => () => {
      points?.geometry.dispose();
      (points?.material as ShaderMaterial | undefined)?.dispose();
    },
    [points],
  );

  useFrame(({ clock, camera, gl, size, pointer }, delta) => {
    if (!points || !group.current) return;
    const st = stage.getState();
    const u = (points.material as ShaderMaterial).uniforms;
    const t = clock.elapsedTime;
    const cam = camera as PerspectiveCamera;
    points.geometry.setDrawRange(0, Math.min(drawPoints, targets?.count ?? 0));
    points.visible = st.progress > 0.62;

    // Gather while the camera travels in from the night valley (keys 4 → 5).
    const gather = smootherstep((st.progress - 0.84) / 0.12);
    u.uGather!.value = gather;

    // Attract mode: once settled, pour into the pond and back every few seconds — until the
    // visitor takes over with the toggle.
    const s = state.current;
    const atMind = st.act === 5 && st.moving < 0.05 && gather > 0.99;
    if (atMind && s.restSince < 0) s.restSince = t;
    if (!atMind) s.restSince = -1;
    const auto = s.restSince > 0 ? Math.floor((t - s.restSince - 2) / 6) % 2 === 0 && t - s.restSince > 2 : false;
    const want = (st.mindPond ?? auto) ? 1 : 0;
    s.morph += (want - s.morph) * (1 - Math.exp(-0.9 * delta));
    u.uMorph!.value = s.morph;
    bustState.morph = s.morph;

    u.uTime!.value = t;
    u.uPixelRatio!.value = gl.getPixelRatio();
    u.uProj!.value = size.height / (2 * Math.tan(MathUtils.degToRad(cam.fov) / 2));

    // Head glance: turn up to 8° towards the viewer.
    const toCam = Math.atan2(camera.position.x - base[0], camera.position.z - base[2]);
    const yaw = MathUtils.clamp(toCam, -MathUtils.degToRad(8), MathUtils.degToRad(8));
    s.yaw += (yaw * (1 - s.morph) - s.yaw) * (1 - Math.exp(-2 * delta));
    group.current.rotation.y = s.yaw;

    // Pointer → a point on the plane through the bust that faces the camera, in bust space.
    const { ray, ndc, plane, hit, n } = tmp;
    ndc.set(pointer.x, pointer.y);
    ray.setFromCamera(ndc, camera);
    n.copy(camera.position).sub(group.current.position).setY(0).normalize();
    plane.setFromNormalAndCoplanarPoint(n, group.current.position);
    const active = st.act === 5 && ray.ray.intersectPlane(plane, hit) !== null;
    s.pointerOn += ((active ? 1 : 0) - s.pointerOn) * (1 - Math.exp(-4 * delta));
    if (active) (u.uPointer!.value as Vector3).copy(group.current.worldToLocal(hit));
    u.uPointerOn!.value = s.pointerOn;
  });

  return (
    <group ref={group} position={base} scale={BUST_SCALE}>
      {points ? <primitive object={points} /> : null}
    </group>
  );
}

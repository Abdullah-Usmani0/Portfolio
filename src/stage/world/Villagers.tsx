import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MeshLambertMaterial, type Mesh, type Object3D } from 'three';
import { blendPose, pose, walkSpeed, type Action, type Persona } from '@/sim/characters/pose.ts';
import { sampleHeight, type Heightfield, type ValleyMeta, type Vec3 } from '../assets.ts';
import { applyPose, buildRig, type Rig } from '../characters/rig.ts';
import { createBlobFactory } from '../characters/blob.ts';
import { stage } from '../store.ts';

const URL = '/models/villagers_m0.glb';

/** The act in which the camera stands beside the hero, who turns and waves. */
export const HERO_ACT = 1;

type Role =
  | { kind: 'hero' }
  /** Walks a stretch of the hill path (arc-length fractions), pausing at each end. */
  | { kind: 'walker'; from: number; to: number; pause: number }
  | { kind: 'still'; action: Action; at: [number, number]; faceTo: [number, number] };

interface Cast {
  name: string;
  persona: Persona;
  seed: number;
  role: Role;
}

const CAST: Cast[] = [
  { name: 'Hero', persona: { energy: 0.65, confidence: 0.85, stress: 0.1 }, seed: 1, role: { kind: 'hero' } },
  { name: 'Villager0', persona: { energy: 0.75, confidence: 0.7, stress: 0.15 }, seed: 2, role: { kind: 'walker', from: 0.06, to: 0.42, pause: 2.5 } },
  { name: 'Villager1', persona: { energy: 0.35, confidence: 0.35, stress: 0.6 }, seed: 3, role: { kind: 'walker', from: 0.48, to: 0.18, pause: 3.5 } },
  { name: 'Villager2', persona: { energy: 0.7, confidence: 0.75, stress: 0.1 }, seed: 4, role: { kind: 'still', action: 'talk', at: [-57.5, 191], faceTo: [-54.8, 189.4] } },
  { name: 'Villager3', persona: { energy: 0.45, confidence: 0.6, stress: 0.2 }, seed: 5, role: { kind: 'still', action: 'talk', at: [-54.8, 189.4], faceTo: [-57.5, 191] } },
];

const TAU = Math.PI * 2;
const wrap = (a: number) => a - TAU * Math.round(a / TAU);
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));
const dampAngle = (current: number, target: number, rate: number, dt: number) => current + wrap(target - current) * (1 - Math.exp(-rate * dt));

/** Arc-length parameterisation of a polyline in the ground plane. */
function polyline(points: Vec3[]) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[2] - a[2]));
  }
  const total = cum[cum.length - 1] ?? 0;
  return {
    total,
    at(s: number) {
      const d = Math.min(total, Math.max(0, s));
      let i = 1;
      while (i < cum.length - 1 && cum[i]! < d) i++;
      const a = points[i - 1]!;
      const b = points[i]!;
      const len = cum[i]! - cum[i - 1]! || 1;
      const t = (d - cum[i - 1]!) / len;
      return {
        x: a[0] + (b[0] - a[0]) * t,
        y: a[1] + (b[1] - a[1]) * t,
        z: a[2] + (b[2] - a[2]) * t,
        heading: Math.atan2(b[0] - a[0], b[2] - a[2]),
      };
    },
  };
}

interface Actor {
  cast: Cast;
  rig: Rig;
  blob: Mesh;
  x: number;
  z: number;
  heading: number;
  /** Cross-fade weight toward the active action (wave, walk). */
  w: number;
}

/** The hero who waves from the hilltop, two walkers on the path and a pair chatting on the lawn. */
export function Villagers({ meta, field }: { meta: ValleyMeta; field: Heightfield }) {
  const { scene } = useGLTF(URL);
  const path = useMemo(() => polyline(meta.pathWalk), [meta]);

  const { actors, group, dispose } = useMemo(() => {
    const material = new MeshLambertMaterial({ vertexColors: true });
    const blobs = createBlobFactory();
    const group: Object3D[] = [];
    const actors: Actor[] = CAST.map((cast) => {
      const src = scene.getObjectByName(cast.name);
      if (!src) throw new Error(`villagers: ${cast.name} not in ${URL}`);
      const copy = src.clone(true);
      copy.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        if (!m.geometry.getAttribute('normal')) m.geometry.computeVertexNormals();
        m.material = material;
      });
      const rig = buildRig(copy);
      const blob = blobs.make(1.25);
      group.push(rig.root, blob);
      const start =
        cast.role.kind === 'hero'
          ? { x: meta.hero.position[0], z: meta.hero.position[2], heading: meta.hero.faceK2 }
          : cast.role.kind === 'walker'
            ? { ...path.at(cast.role.from * path.total) }
            : {
                x: cast.role.at[0],
                z: cast.role.at[1],
                heading: Math.atan2(cast.role.faceTo[0] - cast.role.at[0], cast.role.faceTo[1] - cast.role.at[1]),
              };
      return { cast, rig, blob, x: start.x, z: start.z, heading: start.heading, w: 0 };
    });
    return {
      actors,
      group,
      dispose: () => {
        material.dispose();
        blobs.dispose();
      },
    };
  }, [scene, meta, path]);

  useEffect(() => dispose, [dispose]);

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.1);
    const { act } = stage.getState();

    for (const a of actors) {
      const { persona, seed, role } = a.cast;
      let action: Action;
      let targetHeading = a.heading;
      let lookUp = 0;
      let fallbackY: number;

      if (role.kind === 'hero') {
        fallbackY = meta.hero.position[1];
        const attending = act === HERO_ACT;
        targetHeading = attending ? Math.atan2(camera.position.x - a.x, camera.position.z - a.z) : meta.hero.faceK2;
        const facing = Math.abs(wrap(targetHeading - a.heading)) < 0.45;
        a.w = damp(a.w, attending && facing ? 1 : 0, 4, dt);
        action = 'wave';
        lookUp = attending ? 0 : 0.18; // gazing up at the mountain
      } else if (role.kind === 'walker') {
        const len = Math.abs(role.to - role.from) * path.total;
        const speed = walkSpeed(persona) * 0.8;
        const leg = len / speed;
        const cycle = 2 * (leg + role.pause);
        const ph = (t + seed * 7.3) % cycle;
        let u: number;
        let walking: boolean;
        if (ph < leg) [u, walking] = [ph / leg, true];
        else if (ph < leg + role.pause) [u, walking] = [1, false];
        else if (ph < 2 * leg + role.pause) [u, walking] = [1 - (ph - leg - role.pause) / leg, true];
        else [u, walking] = [0, false];
        const s = (role.from + (role.to - role.from) * u) * path.total;
        const p = path.at(s);
        a.x = p.x;
        a.z = p.z;
        fallbackY = p.y;
        const forward = role.to > role.from;
        const goingOut = ph < leg + role.pause;
        if (walking) targetHeading = forward === goingOut ? p.heading : p.heading + Math.PI;
        a.w = damp(a.w, walking ? 1 : 0, 6, dt);
        action = 'walk';
      } else {
        const g = sampleHeight(field, a.x, a.z);
        fallbackY = Number.isNaN(g) ? 0 : g;
        a.w = 1;
        action = role.action;
      }

      a.heading = dampAngle(a.heading, targetHeading, role.kind === 'hero' ? 2.6 : 5, dt);
      const ground = sampleHeight(field, a.x, a.z);
      const y = Number.isNaN(ground) ? fallbackY : ground;

      const base = pose('idle', t, persona, seed);
      const p = a.w > 0.001 ? blendPose(base, pose(action, t, persona, seed), a.w) : base;
      p.headPitch -= lookUp;
      applyPose(a.rig, p);
      a.rig.root.position.set(a.x, y - 0.04 + p.lift, a.z);
      a.rig.root.rotation.y = a.heading;
      a.blob.position.set(a.x, y + 0.03, a.z);
      a.blob.scale.setScalar(1.25 * (1 - Math.min(0.5, p.lift * 1.6)));
    }
  });

  return (
    <>
      {group.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </>
  );
}

useGLTF.preload(URL);

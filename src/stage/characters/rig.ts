import { Group, type Mesh, type Object3D } from 'three';
import type { Pose } from '@/sim/characters/pose.ts';

type V3 = [number, number, number];
const PARTS = ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const;
type Part = (typeof PARTS)[number];

/**
 * A villager as a joint hierarchy, rebuilt from the glTF:
 *
 *   root ─┬─ hipL ── legL           (legs swing from the root)
 *         ├─ hipR ── legR
 *         └─ hips ─┬─ body          (lean, sway and squash carry the whole upper body)
 *                  ├─ neck ── head
 *                  ├─ shoulderL ── armL
 *                  └─ shoulderR ── armR
 *
 * Mesh quantization moves every part's node origin to its bounding-box centre, so the real
 * joint arrives as `extras.pivot` (root space) and each mesh is re-parented under a group
 * sitting on that joint.
 */
export interface Rig {
  root: Group;
  hips: Group;
  neck: Group;
  shoulderL: Group;
  shoulderR: Group;
  hipL: Group;
  hipR: Group;
  meshes: Mesh[];
}

function partOf(name: string): Part | null {
  const tail = name.slice(name.lastIndexOf('_') + 1);
  return (PARTS as readonly string[]).includes(tail) ? (tail as Part) : null;
}

export function buildRig(source: Object3D): Rig {
  const found = new Map<Part, { mesh: Mesh; pivot: V3 }>();
  for (const child of source.children) {
    const part = partOf(child.name);
    const pivot = child.userData.pivot as V3 | undefined;
    if (part && pivot && (child as Mesh).isMesh) found.set(part, { mesh: child as Mesh, pivot });
  }
  const missing = PARTS.filter((p) => !found.has(p));
  if (missing.length) throw new Error(`rig ${source.name}: missing ${missing.join(', ')}`);
  const get = (p: Part) => found.get(p)!;

  const root = new Group();
  root.name = source.name;
  const joint = (name: string, part: Part, parent: Group, parentPivot: V3 = [0, 0, 0]) => {
    const { mesh, pivot } = get(part);
    const g = new Group();
    g.name = `${source.name}.${name}`;
    g.position.set(pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], pivot[2] - parentPivot[2]);
    parent.add(g);
    mesh.position.set(mesh.position.x - pivot[0], mesh.position.y - pivot[1], mesh.position.z - pivot[2]);
    g.add(mesh);
    return g;
  };

  const hips = joint('hips', 'body', root);
  const bodyPivot = get('body').pivot;
  const neck = joint('neck', 'head', hips, bodyPivot);
  const shoulderL = joint('shoulderL', 'armL', hips, bodyPivot);
  const shoulderR = joint('shoulderR', 'armR', hips, bodyPivot);
  const hipL = joint('hipL', 'legL', root);
  const hipR = joint('hipR', 'legR', root);
  return { root, hips, neck, shoulderL, shoulderR, hipL, hipR, meshes: PARTS.map((p) => get(p).mesh) };
}

/**
 * Apply a pose. Signs follow the character's frame (facing +Z): limbs hang down, so a
 * forward swing is a negative X rotation; the upper body sits above the hips, so a
 * forward lean is positive. `lift` is added to `baseY` by the caller's placement.
 */
export function applyPose(rig: Rig, p: Pose): void {
  const s = 1 / Math.sqrt(p.squash);
  rig.hips.scale.set(s, p.squash, s);
  rig.hips.rotation.set(p.lean, 0, p.sway);
  rig.neck.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
  rig.shoulderL.rotation.set(-p.armL, 0, -p.armLRaise);
  rig.shoulderR.rotation.set(-p.armR, 0, p.armRRaise);
  rig.hipL.rotation.set(-p.legL, 0, 0);
  rig.hipR.rotation.set(-p.legR, 0, 0);
}

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type PerspectiveCamera } from 'three';
import { resolveShot, shiftToViewOffset, smootherstep, validateKeys, verticalFovDeg } from './director.ts';
import { sampleHeight, type Heightfield, type ValleyMeta } from './assets.ts';
import { m0Keys } from './shots.ts';
import { bustBase, bustState } from './world/FireflyBust.tsx';
import { stage } from './store.ts';

const INTRO_SECONDS = 2.8;
/** The intro starts low by the river and cranes up onto the hilltop. */
const INTRO_FROM: [number, number, number] = [26, -19, 38];
const UP = new Vector3(0, 1, 0);

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * The camera follows the director: scroll → shot. It damps toward the shot (inertia), adds
 * a pointer parallax and a slow breathing drift, never dips below the ground, and plays an
 * intro crane once the world is ready. Lens and lens-shift reproduce the Blender cameras.
 */
export function CameraRig({ meta, field }: { meta: ValleyMeta; field: Heightfield }) {
  const keys = useMemo(() => {
    const k = m0Keys(meta, bustBase(field));
    validateKeys(k);
    return k;
  }, [meta, field]);
  const reduced = useMemo(() => reducedMotion(), []);
  const cur = useRef<{ pos: Vector3; look: Vector3; lens: number; sx: number; sy: number } | null>(null);
  const tmp = useMemo(() => ({ want: new Vector3(), look: new Vector3(), fwd: new Vector3(), right: new Vector3(), up: new Vector3() }), []);

  useFrame(({ camera, size, clock }, delta) => {
    const cam = camera as PerspectiveCamera;
    const st = stage.getState();
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.1);
    const r = resolveShot(keys, st.progress);

    const tod = st.todOverride ?? r.tod;
    if (Math.abs(st.tod - tod) > 1e-4) st.setTod(tod);
    st.setShot(r.key, r.moving);

    const { want, look, fwd, right, up } = tmp;
    want.set(...r.position);
    look.set(...r.target);

    // In the mind, the camera bows as the bust pours down into the pond on the meadow.
    if (r.key === 5) {
      const m = bustState.morph * (1 - r.moving);
      look.y -= m * 7;
      want.y += m * 3;
      want.z += m * 8;
    }

    if (st.ready && st.introStart === null) stage.setState({ introStart: reduced ? -1e9 : t });
    if (st.introStart !== null && !reduced) {
      const k = smootherstep((t - st.introStart) / INTRO_SECONDS);
      want.x += INTRO_FROM[0] * (1 - k);
      want.y += INTRO_FROM[1] * (1 - k);
      want.z += INTRO_FROM[2] * (1 - k);
    }

    // Pointer parallax and an idle breath, scaled down for long lenses so they stay subtle.
    fwd.subVectors(look, want).normalize();
    right.crossVectors(fwd, UP).normalize();
    up.crossVectors(right, fwd);
    const k = reduced ? 0 : Math.min(1, 28 / r.lensMm);
    want.addScaledVector(right, st.pointer.x * 0.9 * k + Math.sin(t * 0.21) * 0.18 * k);
    want.addScaledVector(up, st.pointer.y * 0.45 * k + Math.sin(t * 0.17 + 1) * 0.1 * k);

    if (!cur.current) {
      cur.current = { pos: want.clone(), look: look.clone(), lens: r.lensMm, sx: r.shiftX, sy: r.shiftY };
    }
    const c = cur.current;
    const a = reduced ? 1 : 1 - Math.exp(-4.2 * dt);
    c.pos.lerp(want, a);
    c.look.lerp(look, a);
    c.lens += (r.lensMm - c.lens) * a;
    c.sx += (r.shiftX - c.sx) * a;
    c.sy += (r.shiftY - c.sy) * a;

    const ground = sampleHeight(field, c.pos.x, c.pos.z);
    if (!Number.isNaN(ground)) c.pos.y = Math.max(c.pos.y, ground + 1.4);

    cam.position.copy(c.pos);
    cam.lookAt(c.look);
    const aspect = size.width / Math.max(1, size.height);
    const fov = verticalFovDeg(c.lens, aspect);
    const off = shiftToViewOffset(c.sx, c.sy, size.width, size.height);
    cam.aspect = aspect;
    cam.fov = fov;
    cam.setViewOffset(size.width, size.height, off.x, off.y, size.width, size.height);
    cam.updateProjectionMatrix();
  });

  return null;
}

import { Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { BUDGETS, stepDown, type TierBudget } from '@/sim/device/tier.ts';
import { useValleyData, type Heightfield, type ValleyMeta } from './assets.ts';
import { CameraRig } from './CameraRig.tsx';
import { Effects } from './Effects.tsx';
import { stats } from './stats.ts';
import { stage, useStage } from './store.ts';
import { FireflyBust } from './world/FireflyBust.tsx';
import { Grass } from './world/Grass.tsx';
import { K2 } from './world/K2.tsx';
import { Lighting } from './world/Lighting.tsx';
import { Sky } from './world/Sky.tsx';
import { Trees } from './world/Trees.tsx';
import { Valley } from './world/Valley.tsx';
import { Villagers } from './world/Villagers.tsx';

/** Tests read pixels back from the canvas, which needs the drawing buffer kept. */
const TEST_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('test');

function Heartbeat() {
  // The composer renders several passes per frame, so totals are accumulated by hand
  // (autoReset is off) and read back here, before the next frame begins.
  useFrame(({ camera, gl }) => {
    stats.frames++;
    stats.calls = gl.info.render.calls;
    stats.triangles = gl.info.render.triangles;
    gl.info.reset();
    stats.cam = [camera.position.x, camera.position.y, camera.position.z];
  });
  return null;
}

/** Marks the stage ready once the world has mounted and drawn its first frame. */
function Ready() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => stage.getState().setReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, [gl]);
  return null;
}

function World({ meta, field, budget }: { meta: ValleyMeta; field: Heightfield; budget: TierBudget }) {
  return (
    <>
      <Lighting />
      <Sky />
      <Valley />
      <K2 />
      <Trees meta={meta} count={budget.trees} />
      {budget.grass > 0 ? <Grass meta={meta} field={field} count={budget.grass} /> : null}
      <Villagers meta={meta} field={field} />
      {budget.bustPoints > 0 ? <FireflyBust field={field} maxPoints={budget.bustPoints} drawPoints={budget.bustPoints} /> : null}
      <CameraRig meta={meta} field={field} />
      <Ready />
    </>
  );
}

/**
 * The one persistent canvas behind the page. `flat` turns off three's own tone mapping so
 * AgX is applied once, in the composer; the DPR ceiling and effects come from the tier.
 */
export default function Stage() {
  const tier = useStage((s) => s.tier);
  const budget = BUDGETS[tier];
  const data = useValleyData();

  return (
    <Canvas
      flat
      dpr={[1, budget.dpr]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: TEST_MODE }}
      camera={{ near: 0.5, far: 16000, fov: 40, position: [-76, 47, 236] }}
      eventPrefix="client"
      onCreated={({ gl, scene }) => {
        gl.info.autoReset = false;
        if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
          Object.assign(window, { __scene: scene });
        }
      }}
    >
      <PerformanceMonitor
        flipflops={2}
        onDecline={() => {
          const s = stage.getState();
          if (s.tier !== 'static') s.setTier(stepDown(s.tier));
        }}
      />
      <Heartbeat />
      <Suspense fallback={null}>{data ? <World meta={data.meta} field={data.field} budget={budget} /> : null}</Suspense>
      <Effects budget={budget} />
    </Canvas>
  );
}

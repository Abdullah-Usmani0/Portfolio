import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { DIVES } from '@/content/dives.ts';
import { intro, progress, useDive, valley } from '@/motion/store.ts';
import { anchorOf } from './anchors.ts';
import { diveStage, fitZoom } from './diveFraming.ts';
import { createWorld, type World as WorldApi } from './engine.ts';
import { shotAt } from './journey.ts';
import { pointer } from './pointer.ts';
import { worldView } from './view.ts';

/** Seconds for the camera to fly into a dive, or back out. */
const FLY = 1.5;
/** How quickly the camera settles on the next step's target. */
const SETTLE = 0.42;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** The illustrated valley behind the page. Draws on GSAP's ticker, after the scroll has moved. */
export default function World() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let world: WorldApi;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    try {
      const small = window.matchMedia('(max-width: 700px)').matches;
      world = createWorld(el, small ? 1.5 : 2, small ? 14000 : 24000, { snow: small ? 500 : 1100, still: () => reduce.matches, halfTextures: small });
    } catch {
      document.documentElement.dataset.world = 'off';
      return;
    }
    const resize = () => world.resize(window.innerWidth, window.innerHeight);
    resize();
    window.addEventListener('resize', resize);
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.active = true;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    worldView.project = (group, x, y) => world.project(group, x, y);

    // The dive: how far in the camera has flown, and what it is looking at.
    let fly = 0;
    let target: { group: NonNullable<ReturnType<typeof anchorOf>>['group']; x: number; y: number; zoom: number; scene: string; step: string } | null = null;

    const t0 = performance.now();
    let last = t0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Behind the CV or How it works: nothing to draw until the visitor comes back.
      if (valley.hidden) return;
      const shot = shotAt(progress.s);
      // The opening crane: the camera rises out of the valley as the sun comes up.
      const rise = 1 - (1 - intro.rise) ** 3;

      const { scene, step } = useDive.getState();
      const current = scene ? DIVES[scene]?.steps[step] : undefined;
      const anchor = scene && current?.focus ? anchorOf(scene, current.focus) : null;
      const { viewW, viewH } = world.size();
      const stage = diveStage(window.innerWidth, viewW, viewH, current?.frame === 'low');
      if (anchor && scene && current) {
        const zoom = fitZoom(anchor.w, anchor.h, stage, current.fill ?? 0.8);
        const snap = !target || target.group !== anchor.group || fly < 0.02 || reduce.matches;
        if (snap) target = { group: anchor.group, x: anchor.x, y: anchor.y, zoom, scene, step: current.id };
        else if (target) {
          const k = 1 - Math.exp(-dt / SETTLE);
          target.x += (anchor.x - target.x) * k;
          target.y += (anchor.y - target.y) * k;
          target.zoom += (zoom - target.zoom) * k;
          target.scene = scene;
          target.step = current.id;
        }
      }
      const want = anchor ? 1 : 0;
      fly = reduce.matches ? want : Math.min(1, Math.max(0, fly + Math.sign(want - fly) * (dt / FLY)));
      if (fly === 0) target = null;
      const t = easeInOut(fly);
      world.render(
        { ...shot, y: shot.y - (1 - rise) * 240 },
        (now - t0) / 1000,
        dt,
        target && t > 0 ? { ...target, zoom: target.zoom ** t, t, aimX: stage.aimX, aimY: stage.aimY } : undefined,
      );
    };
    gsap.ticker.add(tick);
    document.documentElement.dataset.world = 'on';
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      worldView.project = null;
      world.dispose();
    };
  }, []);

  return <canvas ref={canvas} className="world" aria-hidden />;
}

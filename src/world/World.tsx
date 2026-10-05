import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { intro, progress } from '@/motion/store.ts';
import { createWorld, type World as WorldApi } from './engine.ts';
import { shotAt } from './journey.ts';
import { pointer } from './pointer.ts';

/** The illustrated valley behind the page. Draws on GSAP's ticker, after the scroll has moved. */
export default function World() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let world: WorldApi;
    try {
      const small = window.matchMedia('(max-width: 700px)').matches;
      world = createWorld(el, small ? 1.5 : 2, small ? 14000 : 24000);
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
    const t0 = performance.now();
    let last = t0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const shot = shotAt(progress.s);
      // The opening crane: the camera rises out of the valley as the sun comes up.
      const rise = 1 - (1 - intro.rise) ** 3;
      world.render({ ...shot, y: shot.y - (1 - rise) * 240 }, (now - t0) / 1000, dt);
    };
    gsap.ticker.add(tick);
    document.documentElement.dataset.world = 'on';
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      world.dispose();
    };
  }, []);

  return <canvas ref={canvas} className="world" aria-hidden />;
}

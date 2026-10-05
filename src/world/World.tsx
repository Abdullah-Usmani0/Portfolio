import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { intro, progress } from '@/motion/store.ts';
import { createWorld, type World as WorldApi } from './engine.ts';
import { shotAt } from './journey.ts';

/** The illustrated valley behind the page. Draws on GSAP's ticker, after the scroll has moved. */
export default function World() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let world: WorldApi;
    try {
      world = createWorld(el, window.matchMedia('(max-width: 700px)').matches ? 1.5 : 2);
    } catch {
      document.documentElement.dataset.world = 'off';
      return;
    }
    const resize = () => world.resize(window.innerWidth, window.innerHeight);
    resize();
    window.addEventListener('resize', resize);
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
      world.dispose();
    };
  }, []);

  return <canvas ref={canvas} className="world" aria-hidden />;
}

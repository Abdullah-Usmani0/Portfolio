import { useEffect, useRef, type ReactNode } from 'react';
import { ReactLenis, useLenis, type LenisRef } from 'lenis/react';
import type Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { storyProgress } from '@/ui/storyProgress.ts';
import { SCENES, shotAt } from '@/world/journey.ts';
import { skyIsDark, WORLD_LOOKS } from '@/world/palette.ts';
import { progress, useDay } from './store.ts';

gsap.registerPlugin(ScrollTrigger);

/** The live Lenis instance, for test hooks and programmatic scrolls outside React. */
export const scroller: { lenis: Lenis | undefined } = { lenis: undefined };

/**
 * Turns the scroll position into a scene position every frame — where the viewport centre
 * sits among the `[data-scene]` sections — for the world to draw and the nav to name.
 */
function SceneDriver() {
  const lenis = useLenis(ScrollTrigger.update);

  useEffect(() => {
    scroller.lenis = lenis;
  }, [lenis]);

  useEffect(() => {
    const root = document.documentElement;
    let centers: number[] = [];

    const measure = () => {
      const sections = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
      // A centre the viewport can never reach (the first and last scenes) is pulled in,
      // so the journey still starts and ends exactly at the top and bottom of the page.
      const lo = window.innerHeight / 2;
      const hi = Math.max(lo, root.scrollHeight - window.innerHeight / 2);
      centers = sections.map((el) => {
        const r = el.getBoundingClientRect();
        return Math.min(hi, Math.max(lo, r.top + window.scrollY + r.height / 2));
      });
    };

    const apply = () => {
      if (centers.length === 0) return;
      const p = storyProgress(centers, window.scrollY + window.innerHeight / 2);
      progress.s = p * (centers.length - 1);
      const scene = Math.round(progress.s);
      const dark = skyIsDark(shotAt(progress.s).look);
      const day = useDay.getState();
      if (day.scene !== scene || day.dark !== dark) {
        const look = WORLD_LOOKS[SCENES[scene]?.look ?? 'dawn'];
        useDay.setState({ scene, dark, label: look.label, clock: look.clock });
        root.dataset.sky = dark ? 'dark' : 'light';
      }
    };

    measure();
    apply();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    ScrollTrigger.addEventListener('refresh', measure);
    void document.fonts?.ready.then(() => {
      measure();
      ScrollTrigger.refresh();
    });
    gsap.ticker.add(apply);
    return () => {
      ro.disconnect();
      ScrollTrigger.removeEventListener('refresh', measure);
      gsap.ticker.remove(apply);
    };
  }, []);

  return null;
}

/**
 * Lenis smooths the page's own scroll (it never fakes it), and GSAP's ticker is the one
 * clock: it steps Lenis first, then ScrollTrigger, the scene position and the world.
 * Lenis turns smoothing off by itself for people who prefer reduced motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const ref = useRef<LenisRef>(null);

  useEffect(() => {
    const tick = (time: number) => ref.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(tick, false, true);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <ReactLenis
      root
      ref={ref}
      options={{ autoRaf: false, anchors: true, allowNestedScroll: true, stopInertiaOnNavigate: true, autoToggle: true }}
    >
      <SceneDriver />
      {children}
    </ReactLenis>
  );
}

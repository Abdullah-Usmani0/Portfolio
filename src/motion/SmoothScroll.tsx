import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { ReactLenis, useLenis, type LenisRef } from 'lenis/react';
import type Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { storyProgress } from '@/ui/storyProgress.ts';
import { SCENES, shotAt } from '@/world/journey.ts';
import { skyIsDark, WORLD_LOOKS } from '@/world/palette.ts';
import { valleyScroll } from '@/lib/route.ts';
import { progress, useDay, valley } from './store.ts';

gsap.registerPlugin(ScrollTrigger);

/** The live Lenis instance, for test hooks and programmatic scrolls outside React. */
export const scroller: { lenis: Lenis | undefined } = { lenis: undefined };

/**
 * Turns the scroll position into a scene position every frame — where the viewport centre
 * sits among the `[data-scene]` sections — for the world to draw and the nav to name.
 */
function SceneDriver({ hidden }: { hidden: boolean }) {
  const lenis = useLenis(ScrollTrigger.update);

  useEffect(() => {
    scroller.lenis = lenis;
  }, [lenis]);

  // Behind a page the valley holds still. Back from one, it measures itself again and puts
  // the visitor where they were: same scene, same hour, no intro.
  const was = useRef(hidden);
  useLayoutEffect(() => {
    valley.hidden = hidden;
    if (was.current === hidden) return;
    was.current = hidden;
    const lenis = scroller.lenis;
    if (hidden) {
      // An immediate scroll cancels any glide still running: it belongs to the valley, not
      // to the page now on screen, which starts at its top.
      lenis?.scrollTo(0, { immediate: true, force: true });
      return;
    }
    lenis?.resize();
    ScrollTrigger.refresh();
    const y = valleyScroll();
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, [hidden]);

  useEffect(() => {
    const root = document.documentElement;
    let centers: number[] = [];

    const measure = () => {
      if (valley.hidden) return;
      const sections = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
      // The world reads scene i from SCENES[i]; the page must list its scenes in that order.
      if (import.meta.env.DEV && sections.map((el) => el.id).join() !== SCENES.map((sc) => sc.id).join()) {
        console.error('[scenes] page order differs from SCENES', sections.map((el) => el.id));
      }
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
      if (valley.hidden || centers.length === 0) return;
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
export function SmoothScroll({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
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
      <SceneDriver hidden={hidden} />
      {children}
    </ReactLenis>
  );
}

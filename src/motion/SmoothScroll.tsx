import { useEffect, useRef, type ReactNode } from 'react';
import { ReactLenis, useLenis, type LenisRef } from 'lenis/react';
import type Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { storyProgress } from '@/ui/storyProgress.ts';
import { lightAt, LOOKS, type Look, type LookName } from './pageLight.ts';
import { intro, useDay } from './store.ts';

gsap.registerPlugin(ScrollTrigger);

/** The live Lenis instance, for test hooks and programmatic scrolls outside React. */
export const scroller: { lenis: Lenis | undefined } = { lenis: undefined };

/**
 * Writes the page light into CSS variables every frame, from where the viewport centre
 * sits among the `[data-look]` sections. Style is only written when a value changes.
 */
function LightDriver() {
  const lenis = useLenis(ScrollTrigger.update);

  useEffect(() => {
    scroller.lenis = lenis;
  }, [lenis]);

  useEffect(() => {
    const root = document.documentElement;
    let centers: number[] = [];
    let looks: Look[] = [];
    let last = '';

    const measure = () => {
      const sections = [...document.querySelectorAll<HTMLElement>('[data-look]')];
      looks = sections.map((el) => LOOKS[el.dataset.look as LookName] ?? LOOKS.dawn);
      // A centre the viewport can never reach (the first and last sections) is pulled in,
      // so the first and last looks still land exactly at the top and bottom of the page.
      const lo = window.innerHeight / 2;
      const hi = Math.max(lo, root.scrollHeight - window.innerHeight / 2);
      centers = sections.map((el) => {
        const r = el.getBoundingClientRect();
        return Math.min(hi, Math.max(lo, r.top + window.scrollY + r.height / 2));
      });
    };

    const apply = () => {
      if (looks.length === 0) return;
      const p = storyProgress(centers, window.scrollY + window.innerHeight / 2);
      const l = lightAt(looks, p * (looks.length - 1));
      const glowY = l.glowY + (1 - intro.rise) * 48;
      const key = `${l.bg}${l.glow}${glowY.toFixed(1)}`;
      if (key !== last) {
        last = key;
        root.style.setProperty('--bg', l.bg);
        root.style.setProperty('--bg-rgb', l.bgRgb);
        root.style.setProperty('--glow', l.glow);
        root.style.setProperty('--glow-y', `${glowY.toFixed(2)}%`);
      }
      const day = useDay.getState();
      if (day.look !== l.look || day.dark !== l.dark || !root.style.getPropertyValue('--ink')) {
        root.style.setProperty('--ink', l.ink);
        root.style.setProperty('--muted', l.muted);
        root.style.colorScheme = l.dark ? 'dark' : 'light';
        useDay.setState({ look: l.look, dark: l.dark });
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
 * clock: it steps Lenis, then ScrollTrigger and the light read the same position.
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
      <LightDriver />
      {children}
    </ReactLenis>
  );
}

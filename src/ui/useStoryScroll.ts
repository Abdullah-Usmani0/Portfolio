import { useEffect, useRef, type RefObject } from 'react';
import Lenis from 'lenis';
import { stage } from '@/stage/store.ts';
import { storyProgress } from './storyProgress.ts';

export interface StoryScroll {
  lenis: RefObject<Lenis | null>;
  /** Smooth-scroll to a section by index. */
  goTo: (index: number) => void;
}

/**
 * Lenis smooths native scrolling (never hijacks it); reduced-motion users get plain native
 * scroll. Either way, each scroll writes the story progress into the stage store.
 */
export function useStoryScroll(sections: RefObject<(HTMLElement | null)[]>): StoryScroll {
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let centers: number[] = [];
    const measure = () => {
      centers = (sections.current ?? [])
        .filter((el): el is HTMLElement => el !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return r.top + window.scrollY + r.height / 2;
        });
    };
    const update = () => {
      const s = stage.getState();
      const p = storyProgress(centers, window.scrollY + window.innerHeight / 2);
      s.setProgress(p);
      // With no stage there is no director to name the act; the nearest section is it.
      if (s.tier === 'static' && centers.length > 1) s.setShot(Math.round(p * (centers.length - 1)), 0);
    };

    measure();
    update();
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    ro.observe(document.body);

    if (!reduced) {
      lenis.current = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9 });
      lenis.current.on('scroll', update);
    } else {
      window.addEventListener('scroll', update, { passive: true });
    }
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update);
      lenis.current?.destroy();
      lenis.current = null;
    };
  }, [sections]);

  return {
    lenis,
    goTo: (index) => {
      const el = sections.current?.[index];
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY + el.offsetHeight / 2 - window.innerHeight / 2;
      if (lenis.current) lenis.current.scrollTo(top, { duration: 2.2 });
      else window.scrollTo({ top });
    },
  };
}

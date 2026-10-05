import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { chapters } from '@/content/site.ts';
import { playIntro, revealOnScroll } from '@/motion/choreography.ts';
import { SmoothScroll } from '@/motion/SmoothScroll.tsx';
import { intro } from '@/motion/store.ts';
import { Ascent, Index } from '@/sections/Ascent.tsx';
import { Chapter } from '@/sections/Chapter.tsx';
import { Hero } from '@/sections/Hero.tsx';
import { Mind } from '@/sections/Mind.tsx';
import { Nav } from '@/sections/Nav.tsx';
import { Summit } from '@/sections/Summit.tsx';

gsap.registerPlugin(useGSAP);

export function App() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        playIntro(el);
        revealOnScroll(el);
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        intro.rise = 1;
      });
    },
    { scope },
  );

  return (
    <SmoothScroll>
      <div ref={scope}>
        <div className="sky" aria-hidden />
        <div className="veil" data-intro="veil" aria-hidden />
        <Nav />
        <main>
          <Hero />
          {chapters.map((c) => (
            <Chapter key={c.id} chapter={c} />
          ))}
          <Mind />
          <Ascent />
          <Index />
          <Summit />
        </main>
      </div>
    </SmoothScroll>
  );
}

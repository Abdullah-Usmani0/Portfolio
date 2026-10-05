import { lazy, Suspense, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { playIntro, sceneCards } from '@/motion/choreography.ts';
import { SmoothScroll } from '@/motion/SmoothScroll.tsx';
import { intro } from '@/motion/store.ts';
import { useCvRoute } from '@/lib/route.ts';
import { Cv } from '@/sections/Cv.tsx';
import { Dive } from '@/sections/Dive.tsx';
import { Hero } from '@/sections/Hero.tsx';
import { Journey } from '@/sections/Journey.tsx';
import { Nav } from '@/sections/Nav.tsx';
import { Summit } from '@/sections/Summit.tsx';

gsap.registerPlugin(useGSAP);

const World = lazy(() => import('@/world/World.tsx'));

/** The valley, or the printable CV at `#cv`. */
export function App() {
  return useCvRoute() ? <Cv /> : <Site />;
}

function Site() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        playIntro(el);
        sceneCards(el);
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
        <div className="world-fallback" aria-hidden />
        <Suspense fallback={null}>
          <World />
        </Suspense>
        <div className="veil" data-intro="veil" aria-hidden />
        <Nav />
        <main>
          <Hero />
          <Journey />
          <Summit />
        </main>
        <Dive />
      </div>
    </SmoothScroll>
  );
}

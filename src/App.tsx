import { lazy, Suspense, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { playIntro, sceneCards } from '@/motion/choreography.ts';
import { SmoothScroll } from '@/motion/SmoothScroll.tsx';
import { intro } from '@/motion/store.ts';
import { usePage } from '@/lib/route.ts';
import { Cv } from '@/sections/Cv.tsx';
import { Dive } from '@/sections/Dive.tsx';
import { Hero } from '@/sections/Hero.tsx';
import { Journey } from '@/sections/Journey.tsx';
import { Nav } from '@/sections/Nav.tsx';
import { Summit } from '@/sections/Summit.tsx';
import { Systems } from '@/sections/Systems.tsx';

gsap.registerPlugin(useGSAP);

const World = lazy(() => import('@/world/World.tsx'));

/**
 * The valley, and the two reading pages laid over it: the printable CV (`#cv`) and How it
 * works (`#systems`). The valley is built the first time it is shown and then kept, hidden
 * behind a page, so Back is instant and lands where the visitor left off. A visitor who
 * arrives straight on a page does not pay for the valley until they go to it.
 */
export function App() {
  const page = usePage();
  const [built, setBuilt] = useState(page === 'valley');
  if (page === 'valley' && !built) setBuilt(true);
  return (
    <>
      {built ? <Site hidden={page !== 'valley'} /> : null}
      {page === 'cv' ? <Cv /> : null}
      {page === 'systems' ? <Systems /> : null}
    </>
  );
}

function Site({ hidden }: { hidden: boolean }) {
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
    <SmoothScroll hidden={hidden}>
      <div ref={scope} hidden={hidden} inert={hidden}>
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
        <Dive hidden={hidden} />
      </div>
    </SmoothScroll>
  );
}

import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { CACHE_LINE, CONTEXT_LAYERS, LAYER_COLORS } from '@/sim/particles/bust.ts';
import { stage, useStage } from '@/stage/store.ts';
import { ChapterRail, type Chapter } from '@/ui/ChapterRail.tsx';
import { Compare } from '@/ui/Compare.tsx';
import { DebugHud } from '@/ui/DebugHud.tsx';
import { Reveal } from '@/ui/Reveal.tsx';
import { SunDial } from '@/ui/SunDial.tsx';
import { cn } from '@/ui/cn.ts';
import { useStoryScroll } from '@/ui/useStoryScroll.ts';

const Stage = lazy(() => import('@/stage/Stage.tsx'));

const CHAPTERS: readonly Chapter[] = [
  { numeral: '01', title: 'Dawn' },
  { numeral: '02', title: 'The village' },
  { numeral: '03', title: 'The councils' },
  { numeral: '04', title: 'The farm' },
  { numeral: '05', title: 'The ascent' },
  { numeral: '06', title: 'A mind' },
];

/** Posters stand in when WebGL is unavailable: the Cycles frame for each beat. */
const POSTERS = [
  '/stills/m0_establish_dawn.jpg',
  '/stills/m0_hero_day.jpg',
  '/stills/m0_establish_golden.jpg',
  '/stills/m0_establish_dusk.jpg',
  '/stills/m0_establish_night.jpg',
  '/stills/m0_establish_night.jpg',
];

const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="tabular rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-[11.5px] text-text/90">
      {children}
    </li>
  );
}

function Panel({ eyebrow, title, children, side }: { eyebrow: string; title: ReactNode; children: ReactNode; side: 'left' | 'right' }) {
  return (
    <Reveal className={cn('w-full max-w-[31rem]', side === 'right' ? 'ml-auto' : '')}>
      <div className="glass rounded-3xl p-7 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.2em] text-lime uppercase">{eyebrow}</p>
        <h2 className="font-display mt-3 text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.05] font-semibold tracking-tight text-balance">
          {title}
        </h2>
        <div className="mt-4 space-y-4 text-[15.5px] leading-relaxed text-muted">{children}</div>
      </div>
    </Reveal>
  );
}

function Poster() {
  const act = useStage((s) => s.act);
  return (
    <div className="absolute inset-0">
      {POSTERS.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-[var(--ease-zv-out)]',
            i === act ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </div>
  );
}

/** A dark veil that lifts like morning mist once the world has drawn its first frame. */
function Veil() {
  const ready = useStage((s) => s.ready || s.tier === 'static');
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-night transition-opacity duration-[1800ms] ease-[var(--ease-zv-out)]',
        ready ? 'opacity-0' : 'opacity-100',
      )}
    >
      <p className="font-serif text-lg text-muted italic">Drawing the valley…</p>
    </div>
  );
}

function MindPanel() {
  const pond = useStage((s) => s.mindPond);
  const set = stage.getState().setMindPond;
  return (
    <Panel side="left" eyebrow="II · Inside a mind — preview" title="Context, poured in order.">
      <p>
        Every turn, an NPC's context is assembled block by block — identity first, voice last. The firefly bust pours into a
        terraced pond: one terrace per block. The waterline is the cache line: everything above it is a stable prefix the
        model has already read.
      </p>
      <ol className="flex flex-wrap gap-1.5" aria-label="Context blocks, in order">
        {CONTEXT_LAYERS.map((name, i) => (
          <li key={name} className="contents">
            {i === CACHE_LINE ? (
              <span className="mx-1 self-center font-mono text-[10px] tracking-wide text-cyan uppercase" aria-label="cache line">
                ≈ cache line ≈
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[11px] text-text/85">
              <span className="block size-2 rounded-full" style={{ background: LAYER_COLORS[i] }} />
              {name}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => set(pond === true ? false : true)}
          className="rounded-full bg-lime px-4 py-1.5 text-[13px] font-semibold text-night transition-transform duration-[var(--dur-micro)] active:scale-[0.96]"
        >
          {pond === true ? 'Gather the bust' : 'Pour into context'}
        </button>
        {pond !== null ? (
          <button
            type="button"
            onClick={() => set(null)}
            className="rounded-full border border-white/15 px-4 py-1.5 text-[13px] text-muted transition-colors hover:text-text"
          >
            Auto
          </button>
        ) : null}
      </div>
      <p className="flex flex-wrap gap-x-5 gap-y-2 pt-2 font-mono text-[12px] text-text">
        <a className="underline decoration-lime/50 underline-offset-4 hover:text-lime" href="mailto:abdullahusmani74@gmail.com">
          Email
        </a>
        <a className="underline decoration-lime/50 underline-offset-4 hover:text-lime" href="https://www.linkedin.com/in/muhammadabdullahusmani/">
          LinkedIn
        </a>
        <a className="underline decoration-lime/50 underline-offset-4 hover:text-lime" href="https://github.com/Abdullah-Usmani0">
          GitHub
        </a>
      </p>
    </Panel>
  );
}

export function App() {
  const tier = useStage((s) => s.tier);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const { goTo } = useStoryScroll(sections);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      stage.getState().setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const section = (i: number, className: string, children: ReactNode) => (
    <section
      ref={(el) => {
        sections.current[i] = el;
      }}
      aria-label={CHAPTERS[i]?.title}
      className={cn('relative flex items-center px-5 sm:px-10 md:pl-48 lg:px-56', className)}
    >
      {children}
    </section>
  );

  return (
    <>
      <div className="fixed inset-0" aria-hidden>
        {tier === 'static' ? (
          <Poster />
        ) : (
          <Suspense fallback={<Poster />}>
            <Stage />
          </Suspense>
        )}
      </div>
      <Veil />
      <ChapterRail chapters={CHAPTERS} onGo={goTo} />

      <main className="relative z-10">
        {section(
          0,
          'min-h-svh items-end pb-[14vh]',
          <Reveal className="max-w-[44rem]">
            <p className="font-mono text-[11px] tracking-[0.24em] text-lime uppercase">Zero Valley · M0 look-dev slice</p>
            <h1 className="font-display mt-4 text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.92] font-bold tracking-tight text-snow drop-shadow-[0_2px_24px_rgb(0_0_0/0.35)]">
              Muhammad Abdullah Usmani
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-snow/90 drop-shadow-[0_1px_10px_rgb(0_0_0/0.5)]">
              Founding AI Engineer — I build humanoid AI coworkers, self-improving multi-agent systems and realtime voice AI.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Highlights">
              <Chip>1M+ daily interactions</Chip>
              <Chip>99.8% uptime</Chip>
              <Chip>sub-200 ms responses</Chip>
              <Chip>+340% engagement</Chip>
            </ul>
            <p className="mt-8 font-mono text-[11px] tracking-[0.2em] text-snow/70 uppercase">Scroll to drift downstream ↓</p>
          </Reveal>,
        )}

        {section(
          1,
          'min-h-[135svh] items-end pb-[22svh]',
          <Panel side="right" eyebrow="I · The village" title="Humanoid NPCs that people actually talk to.">
            <p>
              Every villager stands for an AI character: a persona of about ninety traits, a voice of its own, a memory of
              you, and a context window assembled fresh for every turn.
            </p>
            <p className="text-text/80">She waved because you arrived. In the full site, sliders reshape how she walks and speaks.</p>
          </Panel>,
        )}

        {section(
          2,
          'min-h-[135svh]',
          <Panel side="left" eyebrow="III · The councils" title="Six councils of agents that write, audit and improve a curriculum.">
            <p>
              127 tool-bound agents research, design, build, audit, train and film. A SkillOps loop turns their recurring
              failures into better prompts — but only when the evidence spans enough scenarios to be a pattern.
            </p>
          </Panel>,
        )}

        {section(
          3,
          'min-h-[135svh] items-end pb-[22svh]',
          <Panel side="left" eyebrow="IV–V · The farm & the proving grounds" title="Endless scenarios, proven by simulated learners.">
            <p>
              One job role becomes a focus map, then scenarios with stages, resources and a “what good looks like” exemplar.
              Then a cohort of simulated learners plays them, and what trips them up fixes the content.
            </p>
          </Panel>,
        )}

        {section(
          4,
          'min-h-[135svh] items-end pb-[12svh]',
          <Panel side="right" eyebrow="VII · The ascent" title="The mountain is the future.">
            <p>
              Realtime voice and avatars on the lake, a career climbed camp by camp, and the summit at sunrise. Before
              that: look closer at the fireflies over the meadow.
            </p>
          </Panel>,
        )}

        {section(
          5,
          'min-h-svh items-end pb-[10svh]',
          <MindPanel />,
        )}
      </main>

      <SunDial />
      {tier !== 'static' ? <Compare /> : null}
      {debug ? <DebugHud /> : null}
    </>
  );
}

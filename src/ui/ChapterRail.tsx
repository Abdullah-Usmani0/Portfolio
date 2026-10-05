import { useStage } from '@/stage/store.ts';
import { cn } from './cn.ts';

export interface Chapter {
  numeral: string;
  title: string;
}

/** The left rail: where you are in the day, and a way to jump. Hidden on small screens. */
export function ChapterRail({ chapters, onGo }: { chapters: readonly Chapter[]; onGo: (i: number) => void }) {
  const act = useStage((s) => s.act);
  return (
    <nav aria-label="Chapters" className="fixed top-1/2 left-5 z-30 hidden -translate-y-1/2 md:block">
      <ol className="flex flex-col gap-3.5">
        {chapters.map((c, i) => (
          <li key={c.title}>
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-current={act === i ? 'step' : undefined}
              className="group flex items-center gap-3 text-left"
            >
              <span
                className={cn(
                  'block h-px transition-all duration-[var(--dur-panel)] ease-[var(--ease-zv-out)]',
                  act === i ? 'w-8 bg-lime' : 'w-4 bg-white/30 group-hover:w-6 group-hover:bg-white/60',
                )}
              />
              <span
                className={cn(
                  'font-mono text-[10.5px] tracking-[0.18em] uppercase transition-colors duration-[var(--dur-ui)]',
                  act === i ? 'text-lime' : 'text-white/45 group-hover:text-white/80',
                )}
              >
                {c.numeral} · {c.title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

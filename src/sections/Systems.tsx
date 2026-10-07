import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DIVES, type Diagram } from '@/content/dives.ts';
import { chapters, explained, howItWorks, mind } from '@/content/site.ts';
import { useSection } from '@/lib/route.ts';
import { PageLink, ValleyLink } from '@/ui/PageLink.tsx';
import { Rich } from '@/ui/Rich.tsx';
import { SCENES } from '@/world/journey.ts';
import { DIAGRAMS } from './dives/registry.tsx';
import { DiveDiagram } from './DiveDiagram.tsx';
import { PageBar } from './PageBar.tsx';

/** A row of facts under the short version: a chapter's numbers, or the context techniques. */
interface Fact {
  big: string;
  small?: string;
  text: string;
}

/** Each system the valley shows, in the valley's own order, with the words the page needs. */
const TOPICS = SCENES.filter((s) => s.id in explained).map((s) => {
  const chapter = chapters.find((c) => c.id === s.id);
  const dive = DIVES[s.id]!;
  const facts: Fact[] = chapter
    ? chapter.proofs.map((p) => ({ big: p.stat, small: p.label, text: p.text }))
    : mind.techniques.map((t) => ({ big: t.name, text: t.text }));
  const built = [...new Set([...(chapter?.stack ?? []), ...dive.steps.flatMap((st) => st.stack ?? [])])];
  return {
    id: s.id,
    kicker: chapter?.kicker ?? mind.kicker,
    title: chapter?.title ?? mind.title,
    lead: chapter?.lead ?? mind.lead,
    plain: explained[s.id]!,
    facts,
    built,
    dive,
  };
});

/** Where the sticky bar ends, so a section scrolled to is not hidden under it. */
const BAR = 72;

const scrollToSection = (id: string | undefined) => {
  const el = id ? document.getElementById(`sys-${id}`) : null;
  window.scrollTo(0, el ? el.getBoundingClientRect().top + window.scrollY - BAR : 0);
};

/**
 * A step's animated board, drawn only while it is near the screen: boards animate every
 * frame, and a page with thirty of them running at once would not stay smooth. A board
 * that has been seen keeps its height while it rests, so the page does not jump.
 */
function Figure({ kind, scene }: { kind: Diagram; scene: string }) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const [rest, setRest] = useState<number>();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (!entry.isIntersecting) setRest(el.offsetHeight);
        setNear(entry.isIntersecting);
      },
      { rootMargin: '320px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <figure ref={ref} className="sys-figure" style={rest ? { minHeight: rest } : undefined}>
      {near ? <DiveDiagram kind={kind} scene={scene} inline /> : null}
    </figure>
  );
}

/**
 * How it works (`#systems`): the six systems behind the valley, said plainly and then step
 * by step, for anyone who would rather read than fly. Each section ends with a way back
 * into its scene, where the same steps play out on the world.
 */
export function Systems() {
  const section = useSection();
  useLayoutEffect(() => scrollToSection(section), [section]);

  const jump = (id: string) => {
    window.history.replaceState(window.history.state, '', `#systems/${id}`);
    scrollToSection(id);
  };

  return (
    <div className="page systems">
      <PageBar>
        <PageLink page="cv" className="page-link">
          CV
        </PageLink>
      </PageBar>
      <article className="sys-page">
        <header className="sys-head">
          <p className="eyebrow">{howItWorks.kicker}</p>
          <h1 className="sys-h1">
            <Rich text={howItWorks.title} />
          </h1>
          <p className="sys-intro">{howItWorks.intro}</p>
          <nav aria-label="Systems" className="sys-toc">
            {TOPICS.map((t, i) => (
              <button key={t.id} type="button" onClick={() => jump(t.id)}>
                <span className="sys-toc-n tabular">{String(i + 1).padStart(2, '0')}</span> {t.kicker}
              </button>
            ))}
          </nav>
        </header>

        {TOPICS.map((t, i) => {
          const [overview, ...steps] = t.dive.steps;
          return (
            <section key={t.id} id={`sys-${t.id}`} className="sys" aria-labelledby={`sys-${t.id}-title`}>
              <p className="eyebrow">
                <span className="tabular">{String(i + 1).padStart(2, '0')}</span> · {t.kicker}
              </p>
              <h2 id={`sys-${t.id}-title`} className="sys-title">
                <Rich text={t.title} />
              </h2>

              <div className="sys-plain">
                <p className="sys-label">In plain words</p>
                <p className="sys-plain-intro">{t.plain.intro}</p>
                <p>{t.plain.what}</p>
                <p>{t.plain.why}</p>
              </div>

              <div className="sys-short">
                <p className="sys-label">The short version</p>
                <p>{t.lead}</p>
                {overview?.points.length ? (
                  <ul className="sys-points">
                    {overview.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <ul className="sys-facts">
                {t.facts.map((f) => (
                  <li key={f.big + f.text} className="sys-fact">
                    <strong>{f.big}</strong>
                    {f.small ? <span className="sys-fact-small">{f.small}</span> : null}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>

              <p className="sys-label">Step by step</p>
              <ol className="sys-steps">
                {steps.map((st, n) => {
                  const board = st.diagram && DIAGRAMS[st.diagram].inline ? st.diagram : undefined;
                  return (
                    <li key={st.id} className={board ? 'sys-step has-figure' : 'sys-step'}>
                      <div className="sys-step-text">
                        <h3>
                          <span className="sys-step-n tabular">{n + 1}</span>
                          {st.title}
                        </h3>
                        <p>{st.line}</p>
                        {st.points.length ? (
                          <ul>
                            {st.points.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        ) : null}
                        {st.widget ? (
                          <ValleyLink hash={`#${t.id}/${st.id}`} className="sys-try">
                            Try it in the valley <span aria-hidden>→</span>
                          </ValleyLink>
                        ) : null}
                      </div>
                      {board ? <Figure kind={board} scene={t.id} /> : null}
                    </li>
                  );
                })}
              </ol>

              <div className="sys-foot">
                {t.built.length ? (
                  <div className="sys-built">
                    <p className="sys-label">Built with</p>
                    <ul className="stack">
                      {t.built.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ValleyLink hash={`#${t.id}/${overview?.id ?? ''}`} className="sys-watch">
                  Watch it in the valley <span aria-hidden>→</span>
                </ValleyLink>
              </div>
            </section>
          );
        })}
      </article>
    </div>
  );
}

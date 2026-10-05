import type { ReactNode } from 'react';
import type { Chapter as ChapterContent } from '@/content/site.ts';
import { LOOKS, type LookName } from '@/motion/pageLight.ts';
import { Rich } from '@/ui/Rich.tsx';

/** The frame every section shares: a rule, the hour on the left, the story on the right. */
export function Frame({ id, look, children, className }: { id: string; look: LookName; children: ReactNode; className?: string }) {
  const l = LOOKS[look];
  return (
    <section id={id} data-look={look} className={className ?? 'chapter'}>
      <div className="wrap">
        <div className="rule" data-rule aria-hidden />
        <div className="chapter-grid">
          <aside className="chapter-meta" aria-label={`${l.clock}, ${l.label}`}>
            <p className="chapter-clock tabular">{l.clock}</p>
            <p className="chapter-hour">{l.label}</p>
          </aside>
          <div className="chapter-body">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function Chapter({ chapter }: { chapter: ChapterContent }) {
  return (
    <Frame id={chapter.id} look={chapter.look}>
      <p className="eyebrow" data-rise>
        {chapter.kicker}
      </p>
      <h2 className="display-l chapter-title" data-split>
        <Rich text={chapter.title} />
      </h2>
      <p className="lead chapter-lead" data-rise>
        {chapter.lead}
      </p>
      <ul className="proofs" data-rise-group>
        {chapter.proofs.map((p) => (
          <li key={p.label} className="proof">
            <p className="proof-stat tabular">{p.stat}</p>
            <p className="proof-label">{p.label}</p>
            <p className="proof-text">{p.text}</p>
          </li>
        ))}
      </ul>
      <ul className="stack" aria-label="Built with" data-rise>
        {chapter.stack.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </Frame>
  );
}

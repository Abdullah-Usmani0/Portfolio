import { ascent, chapters, mind, type Outcome } from '@/content/site.ts';
import { Rich } from '@/ui/Rich.tsx';
import { ZeroLink } from '@/ui/ZeroLink.tsx';
import { SCENES } from '@/world/journey.ts';
import { Scene } from './Scene.tsx';

interface CardCopy {
  kicker: string;
  title: string;
  line: string;
  /** A system built at Zero: its label says so, and its results follow the line. */
  outcomes?: readonly Outcome[];
}

function Card({ kicker, title, line, outcomes }: CardCopy) {
  return (
    <>
      <p className="eyebrow card-eyebrow">
        {outcomes ? (
          <>
            <ZeroLink />
            <span aria-hidden> · </span>
          </>
        ) : null}
        <span>{kicker}</span>
      </p>
      <h2 className="display-l card-title">
        <Rich text={title} />
      </h2>
      <p className="card-line">{line}</p>
      {outcomes ? (
        <ul className="card-outcomes" aria-label="Results">
          {outcomes.map((o) => (
            <li key={o.label}>
              <strong>{o.stat}</strong> {o.label}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** Every scene card between the hero and the summit, what its button says, and whether How it works explains it. */
const CARDS: Readonly<Record<string, CardCopy & { details: string; read: boolean }>> = {
  ...Object.fromEntries(chapters.map((c) => [c.id, { kicker: c.kicker, title: c.title, line: c.line, outcomes: c.outcomes, details: 'How it works', read: true }])),
  [mind.id]: { kicker: mind.kicker, title: mind.title, line: mind.line, outcomes: mind.outcomes, details: 'Open the context window', read: true },
  [ascent.id]: { kicker: ascent.kicker, title: ascent.title, line: ascent.line, details: 'Climb camp by camp', read: false },
};

/** The work, scene by scene along the river, then the climb, in the journey's own order. */
export function Journey() {
  return (
    <>
      {SCENES.filter((s) => CARDS[s.id]).map((s) => {
        const card = CARDS[s.id]!;
        return (
          <Scene key={s.id} id={s.id} details={card.details} read={card.read}>
            <Card kicker={card.kicker} title={card.title} line={card.line} outcomes={card.outcomes} />
          </Scene>
        );
      })}
    </>
  );
}

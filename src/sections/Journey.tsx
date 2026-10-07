import { ascent, chapters, mind } from '@/content/site.ts';
import { Rich } from '@/ui/Rich.tsx';
import { SCENES } from '@/world/journey.ts';
import { Scene } from './Scene.tsx';

function Card({ kicker, title, line }: { kicker: string; title: string; line: string }) {
  return (
    <>
      <p className="eyebrow card-eyebrow">{kicker}</p>
      <h2 className="display-l card-title">
        <Rich text={title} />
      </h2>
      <p className="card-line">{line}</p>
    </>
  );
}

/** Every scene card between the hero and the summit, what its button says, and whether How it works explains it. */
const CARDS: Readonly<Record<string, { kicker: string; title: string; line: string; details: string; read: boolean }>> = {
  ...Object.fromEntries(chapters.map((c) => [c.id, { kicker: c.kicker, title: c.title, line: c.line, details: 'How it works', read: true }])),
  [mind.id]: { kicker: mind.kicker, title: mind.title, line: mind.line, details: 'Open the context window', read: true },
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
            <Card kicker={card.kicker} title={card.title} line={card.line} />
          </Scene>
        );
      })}
    </>
  );
}

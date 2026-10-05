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

/** Every scene card between the hero and the summit, and what its button says. */
const CARDS: Readonly<Record<string, { kicker: string; title: string; line: string; details: string }>> = {
  ...Object.fromEntries(chapters.map((c) => [c.id, { kicker: c.kicker, title: c.title, line: c.line, details: 'How it works' }])),
  [mind.id]: { kicker: mind.kicker, title: mind.title, line: mind.line, details: 'Open the context window' },
  [ascent.id]: { kicker: ascent.kicker, title: ascent.title, line: ascent.line, details: 'Climb camp by camp' },
};

/** The work, scene by scene along the river, then the climb, in the journey's own order. */
export function Journey() {
  return (
    <>
      {SCENES.filter((s) => CARDS[s.id]).map((s) => {
        const card = CARDS[s.id]!;
        return (
          <Scene key={s.id} id={s.id} details={card.details}>
            <Card kicker={card.kicker} title={card.title} line={card.line} />
          </Scene>
        );
      })}
    </>
  );
}

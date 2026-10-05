import { ascent, chapters, mind } from '@/content/site.ts';
import { Rich } from '@/ui/Rich.tsx';
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

/** The work, scene by scene along the river, then the climb. */
export function Journey() {
  return (
    <>
      {chapters.map((c) => (
        <Scene key={c.id} id={c.id} details="How it works">
          <Card kicker={c.kicker} title={c.title} line={c.line} />
        </Scene>
      ))}
      <Scene id={mind.id} details="Open the context window">
        <Card kicker={mind.kicker} title={mind.title} line={mind.line} />
      </Scene>
      <Scene id={ascent.id} details="Career, projects and awards">
        <Card kicker={ascent.kicker} title={ascent.title} line={ascent.line} />
      </Scene>
    </>
  );
}

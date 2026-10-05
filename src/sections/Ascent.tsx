import { ascent, index } from '@/content/site.ts';
import { Rich } from '@/ui/Rich.tsx';
import { Frame } from './Chapter.tsx';

export function Ascent() {
  return (
    <Frame id={ascent.id} look={ascent.look}>
      <p className="eyebrow" data-rise>
        {ascent.kicker}
      </p>
      <h2 className="display-l chapter-title" data-split>
        <Rich text={ascent.title} />
      </h2>
      <p className="lead chapter-lead" data-rise>
        {ascent.lead}
      </p>
      <ol className="camps" data-rise-group>
        {ascent.camps.map((c) => (
          <li key={c.camp} className="camp">
            <p className="camp-alt tabular">{c.altitude}</p>
            <p className="camp-name">{c.camp}</p>
            <div className="camp-body">
              <p className="camp-org">
                {c.org} <span className="text-muted">· {c.role}</span>
              </p>
              <p className="proof-text">{c.note}</p>
            </div>
            <p className="camp-dates tabular">{c.dates}</p>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

function List({ title, items }: { title: string; items: readonly { name: string; year: string; text?: string }[] }) {
  return (
    <div className="index-col" data-rise>
      <p className="eyebrow">{title}</p>
      <ul className="index-list">
        {items.map((it) => (
          <li key={it.name} className="index-item">
            <p className="index-name">
              {it.name}
              <span className="index-year tabular">{it.year}</span>
            </p>
            {it.text ? <p className="proof-text">{it.text}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Index() {
  return (
    <section id={index.id} data-look={index.look} className="index">
      <div className="wrap">
        <div className="rule" data-rule aria-hidden />
        <div className="index-grid">
          <List title="Projects" items={index.projects} />
          <List title="Recognition" items={index.recognition} />
          <List title="Certifications" items={index.certifications} />
        </div>
      </div>
    </section>
  );
}

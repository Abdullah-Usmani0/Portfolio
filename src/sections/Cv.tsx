import { useEffect } from 'react';
import { ascent, chapters, hero, index, mind, person, skills, zeroHighlights } from '@/content/site.ts';

/** The site's copy marks a few words with `*…*` for the serif italic; on paper they are plain. */
const plain = (s: string) => s.replace(/\*/g, '');

/** The systems built at Zero: one per scene of the valley. */
const SYSTEMS = [...chapters.map((c) => c.kicker), mind.kicker].join(' · ');

/**
 * The printable CV: the same words as the valley, laid out on one sheet of paper. Reached at
 * `#cv` (or `/cv`); print it, or save it as a PDF, from the bar at the top. No phone number.
 */
export function Cv() {
  // The valley was scrolled somewhere; the CV starts at its top.
  useEffect(() => window.scrollTo(0, 0), []);
  const work = [...ascent.camps].slice(1).reverse();
  const school = ascent.camps[0];
  return (
    <div className="cv">
      <div className="cv-bar">
        <a href="#top" className="cv-back">
          ← Back to the valley
        </a>
        <button type="button" className="cv-print" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      <article className="cv-page">
        <header className="cv-head">
          <h1 className="cv-name">{person.name}</h1>
          <p className="cv-role">
            {person.role} · {person.where}
          </p>
          <p className="cv-contact">
            <a href={`mailto:${person.email}`}>{person.email}</a>
            <a href={person.linkedin}>LinkedIn</a>
            <a href={person.github}>GitHub</a>
          </p>
        </header>

        <p className="cv-summary">{plain(hero.lead)}</p>
        <ul className="cv-metrics">
          {hero.metrics.map((m) => (
            <li key={m.label}>
              <strong>{m.stat}</strong> {m.label}
            </li>
          ))}
        </ul>

        <section className="cv-section">
          <h2>Experience</h2>
          {work.map((c) => (
            <div key={c.org} className="cv-item">
              <p className="cv-item-head">
                <span>
                  <strong>{c.role}</strong>, {c.org}
                </span>
                <span className="cv-dates">{c.dates}</span>
              </p>
              <p>{c.note}</p>
              {c.org === 'Zero' && (
                <>
                  <ul className="cv-bullets">
                    {zeroHighlights.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <p className="cv-systems">
                    <span>Systems built:</span> {SYSTEMS}
                  </p>
                </>
              )}
            </div>
          ))}
        </section>

        {school && (
          <section className="cv-section">
            <h2>Education</h2>
            <div className="cv-item">
              <p className="cv-item-head">
                <span>
                  <strong>{school.role}</strong>, {school.org}
                </span>
                <span className="cv-dates">{school.dates}</span>
              </p>
              <p>{school.note}</p>
            </div>
          </section>
        )}

        <section className="cv-section">
          <h2>Research projects</h2>
          <ul className="cv-list">
            {index.projects.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong> <span className="cv-dates">{p.year}</span>
                <span className="cv-list-text">{p.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="cv-columns">
          <section className="cv-section">
            <h2>Recognition</h2>
            <ul className="cv-list cv-list-tight">
              {index.recognition.map((r) => (
                <li key={r.name}>
                  {r.name} <span className="cv-dates">{r.year}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="cv-section">
            <h2>Certifications</h2>
            <ul className="cv-list cv-list-tight">
              {index.certifications.map((c) => (
                <li key={c.name}>
                  {c.name} <span className="cv-dates">{c.year}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="cv-section">
          <h2>Skills</h2>
          <dl className="cv-skills">
            {skills.map((s) => (
              <div key={s.group}>
                <dt>{s.group}</dt>
                <dd>{s.items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
    </div>
  );
}

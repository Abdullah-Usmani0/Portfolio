import { hero, person } from '@/content/site.ts';
import { Rich } from '@/ui/Rich.tsx';

export function Hero() {
  return (
    <section id="top" data-look="dawn" className="hero">
      <div className="wrap hero-inner">
        <p className="eyebrow" data-intro="fade">
          {person.role} <span aria-hidden>·</span> {person.where}
        </p>
        <h1 className="display-xl hero-name" data-intro="name">
          <span className="block">Muhammad Abdullah</span>
          <span className="block">
            <em>Usmani</em>
          </span>
        </h1>
        <div className="hero-foot">
          <p className="lead hero-lead" data-intro="fade">
            <Rich text={hero.lead} />
          </p>
          <dl className="metrics">
            {hero.metrics.map((m) => (
              <div key={m.label} className="metric" data-intro="metric">
                <dt className="metric-label">{m.label}</dt>
                <dd className="metric-stat tabular">{m.stat}</dd>
              </div>
            ))}
          </dl>
        </div>
        <a href="#npcs" className="scroll-cue" data-intro="fade">
          <span className="scroll-cue-line" aria-hidden />
          Scroll to start the day
        </a>
      </div>
    </section>
  );
}

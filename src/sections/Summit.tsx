import { person, summit } from '@/content/site.ts';
import { CopyEmail } from '@/ui/CopyEmail.tsx';
import { Rich } from '@/ui/Rich.tsx';
import { Frame } from './Chapter.tsx';

export function Summit() {
  return (
    <>
      <Frame id={summit.id} look={summit.look} className="chapter summit">
        <p className="eyebrow" data-rise>
          {summit.kicker}
        </p>
        <h2 className="display-l chapter-title" data-split>
          <Rich text={summit.title} />
        </h2>
        <p className="lead chapter-lead" data-rise>
          {summit.vision}
        </p>
        <div className="contact" data-rise>
          <p className="eyebrow">Say hello</p>
          <CopyEmail email={person.email} className="contact-email" />
          <p className="contact-links">
            <a className="link" href={person.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a className="link" href={person.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </Frame>
      <footer className="footer">
        <div className="wrap footer-inner">
          <p>© 2026 {person.name}</p>
          <p className="text-muted">Built with React, Lenis and GSAP.</p>
        </div>
      </footer>
    </>
  );
}

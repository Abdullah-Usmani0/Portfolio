import { person, summit } from '@/content/site.ts';
import { CopyEmail } from '@/ui/CopyEmail.tsx';
import { PageLink } from '@/ui/PageLink.tsx';
import { Rich } from '@/ui/Rich.tsx';
import { Scene } from './Scene.tsx';

export function Summit() {
  return (
    <>
      <Scene id={summit.id} className="scene-summit">
        <p className="eyebrow card-eyebrow">{summit.kicker}</p>
        <h2 className="display-l card-title">
          <Rich text={summit.title} />
        </h2>
        <p className="card-line">{summit.vision}</p>
        <div className="contact">
          <CopyEmail email={person.email} className="contact-email" />
          <p className="contact-links">
            <a className="link" href={person.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a className="link" href={person.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <PageLink page="systems" className="link">
              How it works
            </PageLink>
            <PageLink page="cv" className="link">
              CV
            </PageLink>
          </p>
        </div>
      </Scene>
      <footer className="footer">
        <p>© 2026 {person.name}</p>
        <p>K2 drawn from AWS Terrain Tiles. Built with React, three.js, Lenis and GSAP.</p>
      </footer>
    </>
  );
}

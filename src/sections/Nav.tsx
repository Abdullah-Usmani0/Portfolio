import type { MouseEvent } from 'react';
import { SoundButton } from '@/audio/SoundButton.tsx';
import { person } from '@/content/site.ts';
import { isPlainClick } from '@/lib/route.ts';
import { useDay } from '@/motion/store.ts';
import { PageLink } from '@/ui/PageLink.tsx';

/** Places in the valley; the two reading pages follow them. */
const LINKS = [
  { href: '#councils', label: 'Work' },
  { href: '#ascent', label: 'Career' },
  { href: '#summit', label: 'Contact' },
] as const;

/** Lenis glides to the place; the browser must not also add a history entry for it, or Back retraces every glide. */
const glide = (e: MouseEvent<HTMLAnchorElement>) => {
  if (isPlainClick(e)) e.preventDefault();
};

/** The hour moves with the page: the time label is the scroll position, told as a clock. */
function Clock() {
  const clock = useDay((s) => s.clock);
  const label = useDay((s) => s.label);
  return (
    <p className="clock-label" aria-live="off">
      <span className="clock-dot" aria-hidden />
      <span className="tabular">{clock}</span>
      <span className="nav-muted">{label}</span>
    </p>
  );
}

export function Nav() {
  return (
    <header className="nav" data-intro="nav">
      <a href="#top" className="nav-name" onClick={glide}>
        <span className="hidden sm:inline">{person.name}</span>
        <span className="sm:hidden">M. A. Usmani</span>
      </a>
      <Clock />
      <div className="nav-end">
        <nav aria-label="Sections" className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="link" onClick={glide}>
              {l.label}
            </a>
          ))}
          <PageLink page="systems" className="link">
            How it works
          </PageLink>
          <PageLink page="cv" className="link">
            CV
          </PageLink>
        </nav>
        <SoundButton />
      </div>
    </header>
  );
}

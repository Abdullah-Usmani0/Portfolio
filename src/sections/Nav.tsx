import { person } from '@/content/site.ts';
import { useDay } from '@/motion/store.ts';

const LINKS = [
  { href: '#npcs', label: 'Work' },
  { href: '#ascent', label: 'Career' },
  { href: '#summit', label: 'Contact' },
] as const;

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
      <a href="#top" className="nav-name">
        <span className="hidden sm:inline">{person.name}</span>
        <span className="sm:hidden">M. A. Usmani</span>
      </a>
      <Clock />
      <nav aria-label="Sections" className="nav-links">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="link">
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

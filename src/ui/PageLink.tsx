import type { MouseEvent, ReactNode } from 'react';
import { isPlainClick, openPage, toValley, valleyPath, type Page } from '@/lib/route.ts';

/** Takes over a plain click; Lenis would otherwise go looking for an element called "cv". */
const takeOver = (e: MouseEvent<HTMLAnchorElement>, go: () => void) => {
  if (!isPlainClick(e)) return;
  e.preventDefault();
  e.stopPropagation();
  go();
};

/**
 * A link to a reading page. It is a real address, so it opens in a new tab or without
 * scripts; a plain click opens the page over the valley and remembers where the visitor was.
 */
export function PageLink({ page, section, className, children }: { page: Exclude<Page, 'valley'>; section?: string; className?: string; children: ReactNode }) {
  return (
    <a href={`#${page}${section ? `/${section}` : ''}`} className={className} onClick={(e) => takeOver(e, () => openPage(page, section))}>
      {children}
    </a>
  );
}

/** Back to the valley: to where the visitor was, or, with a dive address, into that dive. */
export function ValleyLink({ hash, className, children }: { hash?: string; className?: string; children: ReactNode }) {
  return (
    <a href={`${valleyPath(window.location)}${hash ?? ''}`} className={className} onClick={(e) => takeOver(e, () => toValley(hash))}>
      {children}
    </a>
  );
}

import type { ReactNode } from 'react';
import { zero } from '@/content/site.ts';

/** Zero, where every system in the valley was built: its own site, in a new tab. */
export function ZeroLink() {
  return (
    <a className="zero-link" href={zero.url} target="_blank" rel="noreferrer" aria-label={`${zero.name} (opens its website in a new tab)`}>
      {zero.name}
    </a>
  );
}

/** A sentence with its first mention of Zero as that link. */
export function linkZero(text: string): ReactNode {
  const at = text.search(new RegExp(`\\b${zero.name}\\b`));
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <ZeroLink />
      {text.slice(at + zero.name.length)}
    </>
  );
}

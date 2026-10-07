import { useEffect, type ReactNode } from 'react';
import { SoundButton } from '@/audio/SoundButton.tsx';
import { toValley } from '@/lib/route.ts';
import { ValleyLink } from '@/ui/PageLink.tsx';

/** The bar along the top of a reading page: the way back, and the page's own actions. Escape also goes back. */
export function PageBar({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toValley();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="page-bar">
      <ValleyLink className="page-back">
        <span aria-hidden>←</span> Back to the valley
      </ValleyLink>
      <div className="page-actions">
        {children}
        <SoundButton />
      </div>
    </div>
  );
}

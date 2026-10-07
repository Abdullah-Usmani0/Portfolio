import type { ReactNode } from 'react';
import { openDive } from '@/motion/store.ts';
import { cn } from '@/ui/cn.ts';
import { PageLink } from '@/ui/PageLink.tsx';

/**
 * One stop on the journey: a tall stretch of page that holds the camera on its scene, with
 * a short card pinned over the dark foreground. "How it works" flies into the scene; "Read
 * it plainly" opens the same system on the How it works page, in words.
 */
export function Scene({ id, children, details, read, className }: { id: string; children: ReactNode; details?: string; read?: boolean; className?: string }) {
  return (
    <section id={id} data-scene className={cn('scene', className)}>
      <div className="scene-sticky">
        <div className="scene-card" data-card>
          {children}
          {details || read ? (
            <div className="scene-actions">
              {details ? (
                <button type="button" className="more" onClick={() => openDive(id)} aria-haspopup="dialog">
                  {details}
                  <span aria-hidden className="more-arrow">
                    →
                  </span>
                </button>
              ) : null}
              {read ? (
                <PageLink page="systems" section={id} className="read-plainly">
                  Read it plainly
                </PageLink>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

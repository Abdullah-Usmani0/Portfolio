import type { ReactNode } from 'react';
import { usePanel } from '@/motion/store.ts';
import { cn } from '@/ui/cn.ts';

/**
 * One stop on the journey: a tall stretch of page that holds the camera on its scene, with
 * a short card pinned over the dark foreground. The details live in a panel, one click away.
 */
export function Scene({ id, children, details, className }: { id: string; children: ReactNode; details?: string; className?: string }) {
  return (
    <section id={id} data-scene className={cn('scene', className)}>
      <div className="scene-sticky">
        <div className="scene-card" data-card>
          {children}
          {details ? (
            <button type="button" className="more" onClick={() => usePanel.setState({ open: id })} aria-haspopup="dialog">
              {details}
              <span aria-hidden className="more-arrow">
                →
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn.ts';

/**
 * Content drifts in like a leaf settling on water once it is well inside the viewport —
 * the camera has settled by then. Reduced motion shows it immediately (see index.css).
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setShown(true);
      },
      { rootMargin: '0px 0px -22% 0px', threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={el} className={cn('reveal', shown && 'reveal-in', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

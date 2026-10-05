import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { DIVES, stepIndex, type Dive as DiveData, type Label } from '@/content/dives.ts';
import { scroller } from '@/motion/SmoothScroll.tsx';
import { closeDive, openDive, useDive } from '@/motion/store.ts';
import { cn } from '@/ui/cn.ts';
import { anchorOf } from '@/world/anchors.ts';
import { SHEET_BELOW } from '@/world/diveFraming.ts';
import { worldView } from '@/world/view.ts';
import { DiveDiagram, onWorld } from './DiveDiagram.tsx';
import { ContextLab } from './dives/ContextLab.tsx';

/** Step forward or back through the open dive. */
function go(delta: number) {
  const { scene, step } = useDive.getState();
  const dive = scene ? DIVES[scene] : undefined;
  if (!dive) return;
  useDive.setState({ step: Math.min(dive.steps.length - 1, Math.max(0, step + delta)) });
}

/** True while the step card is a bottom sheet. */
function useSheet() {
  const query = `(max-width: ${SHEET_BELOW - 1}px)`;
  const [sheet, setSheet] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setSheet(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return sheet;
}

/** Labels that ride on the world: one per building, following the camera as it flies. */
function Pins({ dive, active }: { dive: DiveData; active: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const place = () => {
      dive.pins?.forEach((pin, i) => {
        const el = refs.current[i];
        if (!el) return;
        const a = anchorOf(dive.scene, pin.anchor);
        const p = a && worldView.project ? worldView.project(a.group, a.x, a.y + a.h / 2) : null;
        el.style.visibility = p ? '' : 'hidden';
        if (p) el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      });
    };
    gsap.ticker.add(place);
    return () => gsap.ticker.remove(place);
  }, [dive]);
  if (!dive.pins) return null;
  return (
    <>
      {dive.pins.map((pin, i) => (
        <button
          key={pin.anchor}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          className="dive-pin"
          data-active={pin.step === active ? '' : undefined}
          onClick={() => useDive.setState({ step: stepIndex(dive, pin.step) })}
        >
          {pin.label}
        </button>
      ))}
    </>
  );
}

/** Words that ride on the world beside what they name, shown and hidden in time with it. */
/** Labels keep below the back button. */
const LABEL_TOP = 66;

function Labels({ scene, labels, sheet }: { scene: string; labels: readonly Label[]; sheet: boolean }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const sizes: { w: number; h: number }[] = [];
    const place = () => {
      labels.forEach((label, i) => {
        const el = refs.current[i];
        if (!el) return;
        const a = anchorOf(scene, label.anchor);
        const side = label.side ?? 'right';
        const px = !a ? 0 : side === 'right' ? a.x + a.w / 2 : side === 'left' ? a.x - a.w / 2 : a.x;
        const py = !a ? 0 : side === 'top' ? a.y + a.h / 2 : side === 'bottom' ? a.y - a.h / 2 : a.y;
        const p = a && worldView.project ? worldView.project(a.group, px, py) : null;
        const shown = label.id ? (worldView.labels[label.id] ?? 1) : 1;
        if (!p || shown < 0.02) {
          el.style.visibility = 'hidden';
          return;
        }
        // Measured once: the words never change while the step is open.
        const size = (sizes[i] ??= { w: el.offsetWidth, h: el.offsetHeight });
        let x = side === 'right' ? p.x + 12 : side === 'left' ? p.x - 12 - size.w : p.x - size.w / 2;
        let y = side === 'top' ? p.y - 10 - size.h : side === 'bottom' ? p.y + 10 : p.y - size.h / 2;
        // Never off the edge of the screen.
        x = Math.min(window.innerWidth - size.w - 8, Math.max(8, x));
        y = Math.min(window.innerHeight - size.h - 8, Math.max(LABEL_TOP, y));
        el.style.visibility = '';
        el.style.opacity = shown.toFixed(3);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      });
    };
    gsap.ticker.add(place);
    return () => gsap.ticker.remove(place);
  }, [scene, labels, sheet]);
  return (
    <div className="dive-labels" aria-hidden>
      {labels.map((label, i) => (
        <span
          key={`${label.anchor}-${label.id ?? i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="dive-label"
          data-tone={label.tone ?? 'cream'}
          data-side={label.side ?? 'right'}
          style={label.dot ? ({ '--dot': label.dot } as React.CSSProperties) : undefined}
        >
          {sheet && label.short ? label.short : label.text}
        </span>
      ))}
    </div>
  );
}

/**
 * The deep dive: "How it works" flies the camera into the scene and steps through it. The
 * world does the showing; this is the words, the labels riding on the world, and the way
 * back. Escape, the back button or ← → keys; on a phone, swipe the sheet.
 */
export function Dive() {
  const scene = useDive((s) => s.scene);
  const step = useDive((s) => s.step);
  const dive = scene ? DIVES[scene] : undefined;
  const current = dive?.steps[Math.min(step, dive.steps.length - 1)];
  const sheet = useSheet();
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // Open: pause the page, hide the scene cards, take focus. Close: give it all back.
  useEffect(() => {
    if (!dive) return;
    const html = document.documentElement;
    const returnTo = document.activeElement as HTMLElement | null;
    const url = window.location.href;
    scroller.lenis?.stop();
    html.dataset.dive = dive.scene;
    const raf = requestAnimationFrame(() => card.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDive();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab' && root.current) {
        // Keep focus inside the dive.
        const items = [...root.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="-1"]')].filter((el) => el.offsetParent !== null);
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      delete html.dataset.dive;
      scroller.lenis?.start();
      window.history.replaceState(window.history.state, '', url);
      returnTo?.focus({ preventScroll: true });
    };
  }, [dive]);

  // Each step has its own address, so a dive can be shared.
  useEffect(() => {
    if (dive && current) window.history.replaceState(window.history.state, '', `#${dive.scene}/${current.id}`);
  }, [dive, current]);

  // Arriving on such an address opens that dive once the page has settled.
  useEffect(() => {
    const m = window.location.hash.match(/^#([\w-]+)\/([\w-]+)$/);
    const target = m ? DIVES[m[1]!] : undefined;
    if (!m || !target) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(target.scene);
      if (el) scroller.lenis?.scrollTo(el, { offset: (el.offsetHeight - window.innerHeight) / 2, immediate: true, force: true });
      openDive(target.scene, stepIndex(target, m[2]!));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 1.4) go(dx < 0 ? 1 : -1);
  };

  const count = dive?.steps.length ?? 0;
  return (
    <div ref={root} className={cn('dive', dive && 'is-open')} aria-hidden={!dive}>
      {dive && current ? (
        <>
          <button type="button" className="dive-back" onClick={closeDive}>
            <span aria-hidden>←</span> Back to the valley
          </button>
          {!current.diagram || onWorld(current.diagram, sheet) ? <Pins dive={dive} active={current.id} /> : null}
          {current.labels ? <Labels key={`labels-${current.id}`} scene={dive.scene} labels={current.labels} sheet={sheet} /> : null}
          {current.diagram && (!sheet || onWorld(current.diagram, sheet)) ? <DiveDiagram key={`diagram-${current.id}`} kind={current.diagram} scene={dive.scene} /> : null}
          <div
            ref={card}
            className="dive-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dive-title"
            tabIndex={-1}
            data-lenis-prevent
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <p className="eyebrow dive-eyebrow">
              {dive.kicker}
              <span className="tabular">
                {' '}
                · {String(step + 1).padStart(2, '0')}/{String(count).padStart(2, '0')}
              </span>
            </p>
            <div key={current.id} className="dive-body">
              <h2 id="dive-title" className="dive-title">
                {current.title}
              </h2>
              <p className="dive-line">{current.line}</p>
              {current.diagram && sheet && !onWorld(current.diagram, sheet) ? <DiveDiagram kind={current.diagram} scene={dive.scene} inline /> : null}
              {current.widget === 'context-lab' ? <ContextLab /> : null}
              {current.points.length ? (
                <ul className="dive-points">
                  {current.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              {current.stack ? (
                <ul className="stack" aria-label="Built with">
                  {current.stack.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="dive-nav">
              <button type="button" className="dive-arrow" onClick={() => go(-1)} disabled={step === 0} aria-label="Previous step">
                ←
              </button>
              <ol className="dive-dots" aria-label="Steps">
                {dive.steps.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-label={s.title}
                      aria-current={i === step ? 'step' : undefined}
                      onClick={() => useDive.setState({ step: i })}
                    />
                  </li>
                ))}
              </ol>
              <button type="button" className="dive-arrow" onClick={() => go(1)} disabled={step === count - 1} aria-label="Next step">
                →
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

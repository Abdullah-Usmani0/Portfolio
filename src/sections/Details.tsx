import { useEffect, useRef } from 'react';
import { ascent, chapters, index, mind, type Chapter } from '@/content/site.ts';
import { scroller } from '@/motion/SmoothScroll.tsx';
import { usePanel } from '@/motion/store.ts';
import { cn } from '@/ui/cn.ts';
import { Rich } from '@/ui/Rich.tsx';

function Proofs({ chapter }: { chapter: Chapter }) {
  return (
    <>
      <p className="panel-lead">{chapter.lead}</p>
      <ul className="proofs">
        {chapter.proofs.map((p) => (
          <li key={p.label} className="proof">
            <p className="proof-stat tabular">{p.stat}</p>
            <p className="proof-label">{p.label}</p>
            <p className="proof-text">{p.text}</p>
          </li>
        ))}
      </ul>
      <ul className="stack" aria-label="Built with">
        {chapter.stack.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </>
  );
}

function Context() {
  return (
    <>
      <p className="panel-lead">{mind.lead}</p>
      <ol className="blocks" aria-label="Context blocks, in the order they are assembled">
        {mind.blocks.map(([name, text], i) => (
          <li key={name} className="block-row" data-cache={i === mind.cacheLine ? '' : undefined}>
            <span className="block-index tabular">{String(i + 1).padStart(2, '0')}</span>
            <span className="block-name">{name}</span>
            <span className="block-text">{text}</span>
          </li>
        ))}
      </ol>
      <ul className="techniques">
        {mind.techniques.map((t) => (
          <li key={t.name} className="technique">
            <p className="proof-label">{t.name}</p>
            <p className="proof-text">{t.text}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function List({ title, items }: { title: string; items: readonly { name: string; year: string; text?: string }[] }) {
  return (
    <div className="index-col">
      <p className="proof-label">{title}</p>
      <ul className="index-list">
        {items.map((it) => (
          <li key={it.name} className="index-item">
            <p className="index-name">
              {it.name}
              <span className="index-year tabular">{it.year}</span>
            </p>
            {it.text ? <p className="proof-text">{it.text}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Career() {
  return (
    <>
      <p className="panel-lead">{ascent.lead}</p>
      <ol className="camps">
        {ascent.camps.map((c) => (
          <li key={c.camp} className="camp">
            <p className="camp-alt tabular">
              {c.altitude} · <span className="camp-name">{c.camp}</span>
            </p>
            <p className="camp-org">
              {c.org} <span className="text-muted">· {c.role}</span>
            </p>
            <p className="proof-text">{c.note}</p>
            <p className="camp-dates tabular">{c.dates}</p>
          </li>
        ))}
      </ol>
      <List title="Projects" items={index.projects} />
      <List title="Recognition" items={index.recognition} />
      <List title="Certifications" items={index.certifications} />
    </>
  );
}

const PANELS: Record<string, { kicker: string; title: string; body: () => React.JSX.Element }> = {
  ...Object.fromEntries(chapters.map((c) => [c.id, { kicker: c.kicker, title: c.title, body: () => <Proofs chapter={c} /> }])),
  [mind.id]: { kicker: mind.kicker, title: mind.title, body: Context },
  [ascent.id]: { kicker: ascent.kicker, title: ascent.title, body: Career },
};

/**
 * The details panel: everything the scene card leaves out. It slides in over the world;
 * Escape, the close button or a click outside put it away and return focus.
 */
export function Details() {
  const open = usePanel((s) => s.open);
  const panel = open ? PANELS[open] : undefined;
  const dialog = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!panel) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    scroller.lenis?.stop();
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && usePanel.setState({ open: null });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      scroller.lenis?.start();
      returnTo.current?.focus();
    };
  }, [panel]);

  const close = () => usePanel.setState({ open: null });
  const Body = panel?.body;
  return (
    <div className={cn('panel-root', panel && 'is-open')} aria-hidden={!panel}>
      <div className="panel-backdrop" onClick={close} />
      <div ref={dialog} className="panel" role="dialog" aria-modal="true" aria-label={panel?.kicker} tabIndex={-1} data-lenis-prevent>
        {panel && Body ? (
          <>
            <div className="panel-head">
              <p className="proof-label">{panel.kicker}</p>
              <button type="button" className="pill" onClick={close}>
                Close
              </button>
            </div>
            <h2 className="panel-title">
              <Rich text={panel.title} />
            </h2>
            <Body />
          </>
        ) : null}
      </div>
    </div>
  );
}

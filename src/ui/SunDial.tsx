import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { LOOK_STOPS, nearestLook, type LookName } from '@/sim/world/timeOfDay.ts';
import { stage, useStage } from '@/stage/store.ts';
import { clockFor } from './clock.ts';
import { cn } from './cn.ts';

const LOOK_LABEL: Record<LookName, string> = {
  dawn: 'Dawn',
  day: 'Midday',
  golden: 'Golden hour',
  dusk: 'Dusk',
  night: 'Night',
};
const ORDER: LookName[] = ['dawn', 'day', 'golden', 'dusk', 'night'];

const W = 132;
const H = 74;
const CX = W / 2;
const CY = H - 10;
const R = 54;

const pointOnArc = (tod: number) => {
  const a = Math.PI * (1 - tod);
  return { x: CX + R * Math.cos(a), y: CY - R * Math.sin(a) };
};

/**
 * Drag the sun across the sky to set the hour — it then stops following the scroll until
 * "Follow scroll". A slider for keyboard and screen readers too.
 */
export function SunDial() {
  const tod = useStage((s) => Math.round(s.tod * 400) / 400);
  const overridden = useStage((s) => s.todOverride !== null);
  const svg = useRef<SVGSVGElement>(null);
  const look = nearestLook(tod);
  const sun = pointOnArc(tod);
  const night = tod > 0.86;

  const setFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * W - CX;
    const y = CY - ((e.clientY - box.top) / box.height) * H;
    const angle = Math.atan2(Math.max(0, y), x);
    stage.getState().setTodOverride(1 - angle / Math.PI);
  };

  const onKey = (e: KeyboardEvent) => {
    const s = stage.getState();
    const step = e.shiftKey ? 0.1 : 0.02;
    const map: Record<string, number | null> = {
      ArrowRight: s.tod + step,
      ArrowUp: s.tod + step,
      ArrowLeft: s.tod - step,
      ArrowDown: s.tod - step,
      Home: 0,
      End: 1,
    };
    if (e.key === 'Escape') {
      s.setTodOverride(null);
      return;
    }
    const v = map[e.key];
    if (v === undefined || v === null) return;
    e.preventDefault();
    s.setTodOverride(v);
  };

  return (
    <div className="glass fixed right-4 bottom-4 z-30 w-[184px] rounded-2xl p-3 select-none sm:right-6 sm:bottom-6">
      <div className="flex items-baseline justify-between">
        <span className="font-serif text-[15px] italic">{LOOK_LABEL[look]}</span>
        <span className="tabular font-mono text-[11px] text-muted">{clockFor(tod)}</span>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-lime/70 active:cursor-grabbing"
        role="slider"
        tabIndex={0}
        aria-label="Time of day"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(tod * 100)}
        aria-valuetext={`${LOOK_LABEL[look]}, ${clockFor(tod)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromPointer(e);
        }}
      >
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="1.5" strokeDasharray="2 4" />
        <line x1={6} x2={W - 6} y1={CY} y2={CY} stroke="rgb(255 255 255 / 0.18)" />
        {ORDER.map((name) => {
          const p = pointOnArc(LOOK_STOPS[name]);
          return <circle key={name} cx={p.x} cy={p.y} r={1.8} fill={name === look ? 'var(--color-lime)' : 'rgb(255 255 255 / 0.35)'} />;
        })}
        <circle cx={sun.x} cy={sun.y} r={11} fill={night ? 'rgb(190 205 255 / 0.12)' : 'rgb(255 190 110 / 0.18)'} />
        <circle cx={sun.x} cy={sun.y} r={6} fill={night ? '#dfe6ff' : '#ffd27a'} />
      </svg>
      <div className="mt-2 flex items-center justify-between gap-1">
        {ORDER.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => stage.getState().setTodOverride(LOOK_STOPS[name])}
            className={cn(
              'rounded-full px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide uppercase transition-colors duration-[var(--dur-ui)]',
              name === look ? 'text-lime' : 'text-muted hover:text-text',
            )}
            aria-pressed={overridden && name === look}
          >
            {name === 'golden' ? 'gold' : name}
          </button>
        ))}
      </div>
      {overridden ? (
        <button
          type="button"
          onClick={() => stage.getState().setTodOverride(null)}
          className="mt-2 w-full rounded-lg border border-line py-1 font-mono text-[10px] tracking-wide text-muted uppercase transition-colors hover:border-lime/50 hover:text-lime"
        >
          Follow scroll
        </button>
      ) : null}
    </div>
  );
}

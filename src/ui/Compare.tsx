import { useState, type PointerEvent } from 'react';
import { nearestLook } from '@/sim/world/timeOfDay.ts';
import { useStage } from '@/stage/store.ts';

/**
 * Look-dev A/B: lay the Cycles style frame over the live WebGL view and drag the divider.
 * Only the two acts that use the exact Blender cameras have a reference.
 */
export function stillFor(act: number, tod: number): string | null {
  const look = nearestLook(tod);
  if (act === 0) return `/stills/m0_establish_${look}.jpg`;
  if (act === 1) return `/stills/m0_hero_${look === 'dusk' || look === 'night' || look === 'golden' ? 'dusk' : 'day'}.jpg`;
  return null;
}

export function Compare() {
  const [on, setOn] = useState(false);
  const [split, setSplit] = useState(0.5);
  const act = useStage((s) => s.act);
  const tod = useStage((s) => Math.round(s.tod * 20) / 20);
  const src = stillFor(act, tod);

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setSplit(Math.min(1, Math.max(0, e.clientX / window.innerWidth)));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        disabled={!src}
        aria-pressed={on}
        className="glass fixed top-4 right-4 z-40 rounded-full px-3 py-1.5 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase transition-colors hover:text-text disabled:opacity-40 sm:top-6 sm:right-6"
        title={src ? 'Compare the live view with the Blender (Cycles) render' : 'A reference render exists for the first two shots'}
      >
        {on ? 'Close A/B' : 'A/B · Cycles'}
      </button>
      {on && src ? (
        <div
          className="fixed inset-0 z-20 cursor-ew-resize touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setSplit(e.clientX / window.innerWidth);
          }}
          onPointerMove={drag}
        >
          <img
            src={src}
            alt="Blender Cycles reference render of the same shot"
            className="pointer-events-none absolute top-1/2 left-0 w-full -translate-y-1/2"
            style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
          />
          <div className="pointer-events-none absolute inset-y-0 w-px bg-lime/80" style={{ left: `${split * 100}%` }}>
            <span className="glass absolute top-20 -translate-x-1/2 rounded-full px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-lime">
              WebGL ◂ ▸ Cycles
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

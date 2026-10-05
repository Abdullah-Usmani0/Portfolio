import { useEffect, useState } from 'react';
import { stats } from '@/stage/stats.ts';
import { stage } from '@/stage/store.ts';

/** `?debug`: frame rate, tier, act and draw calls — the real-device performance check. */
export function DebugHud() {
  const [line, setLine] = useState('');
  useEffect(() => {
    let frames = stats.frames;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const fps = ((stats.frames - frames) * 1000) / (now - last);
      frames = stats.frames;
      last = now;
      const s = stage.getState();
      setLine(
        `${fps.toFixed(0)} fps · ${s.tier} · act ${s.act} · tod ${s.tod.toFixed(2)} · ${stats.calls} calls · ${(stats.triangles / 1000).toFixed(0)}k tris`,
      );
    }, 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="glass tabular fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[11px] text-lime" aria-hidden>
      {line || '…'}
    </div>
  );
}

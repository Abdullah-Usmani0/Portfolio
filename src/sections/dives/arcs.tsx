import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { anchorOf } from '@/world/anchors.ts';
import { worldView } from '@/world/view.ts';
import { AMBER, CREAM, LIME } from './colors.ts';

/** One flow between two places in a scene, drawn as an arc over the world. */
export interface Arc {
  from: string;
  to: string;
  label: string;
  /** How high the arc rises, relative to its span. */
  lift: number;
  /** Where along the arc its label sits (0–1). */
  at: number;
  /** `back`: work coming back to change what is made (lime, dashed); `redo`: sent back to be made again (amber, dashed). */
  tone?: 'back' | 'redo';
}

const STYLE = {
  forward: { stroke: CREAM, opacity: 0.55, width: 1.5, dash: undefined, parcel: AMBER },
  back: { stroke: LIME, opacity: 0.9, width: 2, dash: '6 6', parcel: LIME },
  redo: { stroke: AMBER, opacity: 0.85, width: 1.6, dash: '4 6', parcel: AMBER },
} as const;

/** Arcs from place to place over the world, with parcels riding them; they follow the camera as it moves. */
export function WorldArcs({ scene, edges }: { scene: string; edges: readonly Arc[] }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const parcels = useRef<(SVGCircleElement | null)[]>([]);
  const labels = useRef<(SVGTextElement | null)[]>([]);
  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      const time = (performance.now() - start) / 1000;
      const top = (id: string) => {
        const a = anchorOf(scene, id);
        return a && worldView.project ? worldView.project(a.group, a.x, a.y + a.h / 2) : null;
      };
      edges.forEach((e, i) => {
        const a = top(e.from);
        const b = top(e.to);
        const path = paths.current[i];
        if (!a || !b || !path) return;
        const span = Math.abs(b.x - a.x);
        const ctrl = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - span * 0.34 * e.lift - 18 };
        path.setAttribute('d', `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${ctrl.x.toFixed(1)},${ctrl.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
        const at = (t: number) => ({
          x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctrl.x + t * t * b.x,
          y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * ctrl.y + t * t * b.y,
        });
        for (let k = 0; k < 2; k++) {
          const dot = parcels.current[i * 2 + k];
          const p = at((time * 0.16 + k / 2 + i * 0.13) % 1);
          dot?.setAttribute('cx', p.x.toFixed(1));
          dot?.setAttribute('cy', p.y.toFixed(1));
        }
        const mid = at(e.at);
        labels.current[i]?.setAttribute('x', mid.x.toFixed(1));
        labels.current[i]?.setAttribute('y', (mid.y - 9).toFixed(1));
      });
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [scene, edges]);
  return (
    <svg className="loops-svg" aria-hidden>
      {edges.map((e, i) => {
        const st = STYLE[e.tone ?? 'forward'];
        return (
          <g key={e.label}>
            <path
              ref={(el) => {
                paths.current[i] = el;
              }}
              fill="none"
              stroke={st.stroke}
              strokeOpacity={st.opacity}
              strokeWidth={st.width}
              strokeDasharray={st.dash}
            />
            {[0, 1].map((k) => (
              <circle
                key={k}
                ref={(el) => {
                  parcels.current[i * 2 + k] = el;
                }}
                r={4.5}
                fill={st.parcel}
              />
            ))}
            <text
              ref={(el) => {
                labels.current[i] = el;
              }}
              textAnchor="middle"
              className="diagram-label loops-label"
            >
              {e.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

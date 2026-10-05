import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { Diagram } from '@/content/dives.ts';
import { cn } from '@/ui/cn.ts';
import { anchorOf } from '@/world/anchors.ts';
import { worldView } from '@/world/view.ts';

const LIME = '#b9ef2e';
const AMBER = '#ffc45c';
const CREAM = '#f6f1ea';

/** The SkillOps loop: a token travels the ring; each stage lights as it passes. */
const LOOP = ['Run', 'Journal', 'Reflect', 'Pattern gate', 'Playbook', 'Prompt rewrite', 'Measure', 'Keep or undo'] as const;
const LAP = 16;

function SkillOps() {
  const c = 210;
  const r = 148;
  return (
    <svg viewBox="0 0 420 420" className="diagram-svg" role="img" aria-label="The SkillOps loop: run, journal, reflect, pattern gate, playbook, prompt rewrite, measure, keep or undo.">
      <circle cx={c} cy={c} r={r} fill="none" stroke={CREAM} strokeOpacity={0.32} strokeDasharray="2 7" />
      <circle cx={c} cy={c} r={r - 34} fill="rgb(10 12 22 / 0.5)" />
      {LOOP.map((name, i) => {
        const a = -Math.PI / 2 + (i / LOOP.length) * Math.PI * 2;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        const lx = c + Math.cos(a) * (r + 18);
        const ly = c + Math.sin(a) * (r + 18);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <g key={name}>
            <circle cx={x} cy={y} r={6.5} className="loop-node" style={{ animationDelay: `${(i * LAP) / LOOP.length - 0.15}s`, animationDuration: `${LAP}s` }} />
            <text x={lx} y={ly + (Math.sin(a) > 0.5 ? 12 : Math.sin(a) < -0.5 ? -6 : 4)} textAnchor={anchor} className="diagram-label">
              {name}
            </text>
          </g>
        );
      })}
      <circle r={5.5} fill={LIME}>
        <animateMotion dur={`${LAP}s`} repeatCount="indefinite" path={`M${c},${c - r} A${r},${r} 0 1,1 ${c},${c + r} A${r},${r} 0 1,1 ${c},${c - r}`} />
      </circle>
      <text x={c} y={c - 10} textAnchor="middle" className="diagram-title">
        SkillOps
      </text>
      <text x={c} y={c + 16} textAnchor="middle" className="diagram-note">
        a rule needs 3 scenarios
      </text>
      <text x={c} y={c + 31} textAnchor="middle" className="diagram-note">
        in 2 focuses · ±10 pt or undo
      </text>
    </svg>
  );
}

/**
 * The autonomy kernel: decisions flow in from the left and meet the gate. Confident ones
 * act (and leave an undo); the rest become proposals; while the brake is on, all are held.
 */
const KERNEL_LAP = 16;
const BRAKE: [number, number] = [10, 13.6];
const DECISIONS = Array.from({ length: 9 }, (_, i) => ({ at: i * 1.75, sure: [0.9, 0.62, 0.95, 0.88, 0.4, 0.97, 0.7, 0.92, 0.55][i]! }));
const THRESHOLD = 0.85;

function Kernel() {
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const lever = useRef<SVGGElement>(null);
  const brakeLabel = useRef<SVGTextElement>(null);
  const cap = useRef<SVGRectElement>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      const time = ((performance.now() - start) / 1000) % KERNEL_LAP;
      const braked = (at: number) => at >= BRAKE[0] && at < BRAKE[1];
      if (lever.current) {
        lever.current.style.transform = braked(time) ? 'translateY(26px)' : '';
        lever.current.dataset.on = braked(time) ? '1' : '0';
      }
      if (brakeLabel.current) brakeLabel.current.textContent = braked(time) ? 'BRAKE ON' : 'BRAKE OFF';
      let acted = 0;
      DECISIONS.forEach((d, i) => {
        const el = dots.current[i];
        if (!el) return;
        const age = (time - d.at + KERNEL_LAP) % KERNEL_LAP;
        const inbound = Math.min(1, age / 2.2);
        const gateAt = (d.at + 2.2) % KERNEL_LAP;
        const route = braked(gateAt) ? 'held' : d.sure >= THRESHOLD ? 'act' : 'propose';
        const out = Math.min(1, Math.max(0, (age - 2.2) / 1.6));
        if (route === 'act' && age > 3.8) acted++;
        const [tx, ty] = route === 'act' ? [470, 148] : route === 'propose' ? [470, 212] : [262, 262];
        const x = inbound < 1 ? 26 + inbound * 236 : 262 + (tx - 262) * out;
        const y = inbound < 1 ? 160 + Math.sin(i * 2.1) * 26 * (1 - inbound) : 160 + (ty - 160) * out;
        el.setAttribute('cx', x.toFixed(1));
        el.setAttribute('cy', y.toFixed(1));
        el.setAttribute('fill', inbound < 1 ? CREAM : route === 'act' ? LIME : route === 'propose' ? AMBER : '#8a8fa3');
        el.setAttribute('opacity', age > 6.4 ? '0' : '1');
      });
      cap.current?.setAttribute('width', String(Math.min(150, 12 + acted * 24)));
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  const dial = (deg: number, rr: number) => [262 + Math.cos((deg * Math.PI) / 180) * rr, 96 - Math.sin((deg * Math.PI) / 180) * rr] as const;
  const ticks = [
    ['OFF', 180],
    ['PROPOSE', 135],
    ['AUTO ≥ θ', 45],
    ['ALWAYS', 0],
  ] as const;
  return (
    <svg viewBox="0 0 540 300" className="diagram-svg" role="img" aria-label="The autonomy kernel: confident decisions act and record an undo, the rest become proposals, and the brake holds everything.">
      <rect x="6" y="6" width="528" height="288" rx="22" fill="rgb(10 12 22 / 0.55)" stroke={CREAM} strokeOpacity={0.14} />
      <text x="26" y="40" className="diagram-label">
        DECISIONS IN
      </text>
      <path d={`M26,160 L262,160`} stroke={CREAM} strokeOpacity={0.22} strokeDasharray="2 6" />
      {/* The dial: how much this kind of decision may do on its own. */}
      <path d={`M${dial(180, 52).join(',')} A52,52 0 0,1 ${dial(0, 52).join(',')}`} fill="none" stroke={CREAM} strokeOpacity={0.4} strokeWidth={2} />
      {ticks.map(([name, deg]) => {
        const [x, y] = dial(deg, 64);
        return (
          <text key={name} x={x} y={y} textAnchor={deg > 90 ? 'end' : 'start'} className="diagram-label" opacity={name === 'AUTO ≥ θ' ? 1 : 0.6}>
            {name}
          </text>
        );
      })}
      <g className="kernel-needle" style={{ transformOrigin: '262px 96px' }}>
        <line x1="262" y1="96" x2={dial(45, 46)[0]} y2={dial(45, 46)[1]} stroke={LIME} strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx="262" cy="96" r="5" fill={CREAM} />
      <rect x="252" y="128" width="20" height="64" rx="6" fill="rgb(246 241 234 / 0.14)" stroke={CREAM} strokeOpacity={0.4} />
      <text x="262" y="214" textAnchor="middle" className="diagram-label">
        GATE
      </text>
      {/* The brake: read fresh before every decision. */}
      <rect x="380" y="40" width="14" height="66" rx="7" fill="rgb(246 241 234 / 0.1)" stroke={CREAM} strokeOpacity={0.3} />
      <g ref={lever} className="kernel-lever">
        <circle cx="387" cy="50" r="11" />
      </g>
      <text ref={brakeLabel} x="404" y="78" className="diagram-label">
        BRAKE OFF
      </text>
      <text x="478" y="138" className="diagram-label" fill={LIME}>
        ACTED
      </text>
      <text x="478" y="152" className="diagram-note">
        ↺ undo kept
      </text>
      <text x="478" y="206" className="diagram-label" fill={AMBER}>
        PROPOSED
      </text>
      <text x="478" y="220" className="diagram-note">
        a person decides
      </text>
      <text x="262" y="286" textAnchor="middle" className="diagram-note">
        held while braked
      </text>
      <text x="26" y="248" className="diagram-label">
        TODAY’S CAP
      </text>
      <rect x="26" y="258" width="150" height="8" rx="4" fill="rgb(246 241 234 / 0.12)" />
      <rect ref={cap} x="26" y="258" width="12" height="8" rx="4" fill={LIME} />
      {DECISIONS.map((d, i) => (
        <circle
          key={d.at}
          ref={(el) => {
            dots.current[i] = el;
          }}
          r={6}
          cx={26}
          cy={160}
        />
      ))}
    </svg>
  );
}

/** Work flowing between the councils, drawn over the town: arcs from roof to roof, parcels riding them. */
const EDGES = [
  { from: 'research', to: 'design', label: 'signals', lift: 0.7, at: 0.5 },
  { from: 'design', to: 'implementation', label: 'focus maps', lift: 0.7, at: 0.5 },
  { from: 'implementation', to: 'audit', label: 'scenarios', lift: 0.6, at: 0.42 },
  { from: 'implementation', to: 'training', label: 'videos', lift: 1.05, at: 0.74 },
  { from: 'implementation', to: 'media', label: 'faces + voices', lift: 1.3, at: 0.8 },
  { from: 'audit', to: 'design', label: 'findings → playbook', lift: 1.6, at: 0.5, back: true },
] as const;

function Loops({ scene }: { scene: string }) {
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
      EDGES.forEach((e, i) => {
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
  }, [scene]);
  return (
    <svg className="loops-svg" aria-hidden>
      {EDGES.map((e, i) => (
        <g key={e.label}>
          <path
            ref={(el) => {
              paths.current[i] = el;
            }}
            fill="none"
            stroke={'back' in e ? LIME : CREAM}
            strokeOpacity={'back' in e ? 0.9 : 0.55}
            strokeWidth={'back' in e ? 2 : 1.5}
            strokeDasharray={'back' in e ? '6 6' : undefined}
          />
          {[0, 1].map((k) => (
            <circle
              key={k}
              ref={(el) => {
                parcels.current[i * 2 + k] = el;
              }}
              r={4.5}
              fill={'back' in e ? LIME : AMBER}
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
      ))}
    </svg>
  );
}

/** An animated diagram for a dive step: over the sky on a wide screen, or inside the sheet on a phone. */
export function DiveDiagram({ kind, scene, inline = false }: { kind: Diagram; scene: string; inline?: boolean }) {
  if (kind === 'loops') return <Loops scene={scene} />;
  return <div className={cn('dive-diagram', inline && 'is-inline')}>{kind === 'skillops' ? <SkillOps /> : <Kernel />}</div>;
}

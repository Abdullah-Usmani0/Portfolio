/**
 * The Scenario Generation diagrams: what a crate carries, the exemplar pipeline, the
 * reviewers, plain writing, the model ladder, and the farm's loops drawn over the world.
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { WorldArcs, type Arc } from './arcs.tsx';
import { AMBER, CREAM, CYAN, LIME, RED, VIOLET } from './colors.ts';

/** Calls `fn` every frame with the seconds since the diagram appeared. */
function useClock(fn: (t: number) => void) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const start = performance.now();
    const tick = () => ref.current((performance.now() - start) / 1000);
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
}

const Frame = ({ w, h, title }: { w: number; h: number; title: string }) => (
  <>
    <rect x="6" y="6" width={w - 12} height={h - 12} rx="22" fill="rgb(10 12 22 / 0.58)" stroke={CREAM} strokeOpacity={0.14} />
    <text x="26" y="38" className="diagram-label">
      {title}
    </text>
  </>
);

/* ─── What a crate carries ───────────────────────────────────────────────────────────── */

/** Small glyphs, drawn around (0, 0) in a 24 × 24 box. */
const GLYPHS: Record<string, ReactNode> = {
  brief: (
    <>
      <rect x="-7" y="-10" width="14" height="20" rx="2" fill="none" stroke={CREAM} strokeWidth="1.6" />
      {[-5, -1, 3].map((y) => (
        <line key={y} x1="-4" x2="4" y1={y} y2={y} stroke={CREAM} strokeWidth="1.4" />
      ))}
    </>
  ),
  why: <path d="M0,-10 L3,-3 L10,-2 L4,3 L6,10 L0,6 L-6,10 L-4,3 L-10,-2 L-3,-3 Z" fill={AMBER} />,
  stages: <path d="M-10,8 h6 v-6 h6 v-6 h6 v-6 h2" fill="none" stroke={LIME} strokeWidth="2" />,
  files: (
    <>
      <rect x="-10" y="-8" width="20" height="16" rx="2" fill="none" stroke={CYAN} strokeWidth="1.6" />
      <line x1="-10" x2="10" y1="-2" y2="-2" stroke={CYAN} strokeWidth="1.2" />
      <line x1="-10" x2="10" y1="3" y2="3" stroke={CYAN} strokeWidth="1.2" />
      <line x1="-3" x2="-3" y1="-8" y2="8" stroke={CYAN} strokeWidth="1.2" />
    </>
  ),
  checks: (
    <>
      <rect x="-9" y="-9" width="18" height="18" rx="3" fill="none" stroke={LIME} strokeWidth="1.6" />
      <path d="M-5,0 L-1,4 L6,-4" fill="none" stroke={LIME} strokeWidth="2" />
    </>
  ),
  voice: (
    <>
      {[-8, -4, 0, 4, 8].map((x, k) => (
        <line key={x} x1={x} x2={x} y1={-[3, 7, 10, 6, 3][k]!} y2={[3, 7, 10, 6, 3][k]!} stroke={VIOLET} strokeWidth="2" strokeLinecap="round" />
      ))}
    </>
  ),
  learn: <path d="M-10,-7 h20 v12 h-11 l-5,5 v-5 h-4 Z" fill="none" stroke={CREAM} strokeWidth="1.6" strokeLinejoin="round" />,
  film: (
    <>
      <rect x="-10" y="-7" width="20" height="14" rx="2" fill="none" stroke={AMBER} strokeWidth="1.6" />
      <path d="M-3,-4 L4,0 L-3,4 Z" fill={AMBER} />
    </>
  ),
  faces: (
    <>
      <circle cx="0" cy="-4" r="4.5" fill="none" stroke={CREAM} strokeWidth="1.6" />
      <path d="M-8,9 C-8,2 8,2 8,9" fill="none" stroke={CREAM} strokeWidth="1.6" />
    </>
  ),
  training: (
    <>
      <rect x="-10" y="-8" width="20" height="13" rx="2" fill="none" stroke={CYAN} strokeWidth="1.6" />
      <line x1="-4" x2="4" y1="9" y2="9" stroke={CYAN} strokeWidth="1.6" />
      <path d="M-2,-4.5 L3,-1.5 L-2,1.5 Z" fill={CYAN} />
    </>
  ),
  warmup: (
    <>
      <circle cx="0" cy="2" r="4" fill={AMBER} />
      {[0, 1, 2, 3, 4].map((k) => {
        const a = Math.PI + (k / 4) * Math.PI;
        return <line key={k} x1={Math.cos(a) * 7} y1={2 + Math.sin(a) * 7} x2={Math.cos(a) * 10} y2={2 + Math.sin(a) * 10} stroke={AMBER} strokeWidth="1.6" strokeLinecap="round" />;
      })}
    </>
  ),
  exemplar: (
    <>
      <circle cx="0" cy="-2" r="7" fill="none" stroke={LIME} strokeWidth="1.8" />
      <path d="M-4,4 L-6,11 L0,8 L6,11 L4,4" fill="none" stroke={LIME} strokeWidth="1.6" />
      <path d="M-3,-2 L-1,0 L3,-4" fill="none" stroke={LIME} strokeWidth="1.6" />
    </>
  ),
};

const CRATE_ITEMS: readonly [keyof typeof GLYPHS, string][] = [
  ['brief', 'Brief'],
  ['why', 'Why it matters'],
  ['stages', 'Typed stages'],
  ['files', 'Files + data'],
  ['checks', 'Checks'],
  ['voice', 'Voice notes'],
  ['learn', 'Learn mode'],
  ['film', 'Kickoff film'],
  ['faces', 'Faces + voices'],
  ['training', 'Training videos'],
  ['warmup', 'Warm-up'],
  ['exemplar', 'Exemplar'],
];

/** The crate opens and everything a learner gets rises out of it, one piece at a time. */
export function Crate() {
  const W = 540;
  const H = 270;
  const cx = W / 2;
  const crateY = 236;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="diagram-svg" role="img" aria-label={`What one scenario carries: ${CRATE_ITEMS.map(([, l]) => l).join(', ')}.`}>
      <Frame w={W} h={H} title="One scenario, crated" />
      {CRATE_ITEMS.map(([glyph, label], k) => {
        const col = k % 4;
        const row = Math.floor(k / 4);
        const x = 88 + col * 121;
        const y = 70 + row * 52;
        const style = { '--dx': `${cx - x}px`, '--dy': `${crateY - y}px`, animationDelay: `${0.35 + k * 0.32}s` } as CSSProperties;
        return (
          <g key={glyph} className="crate-item" style={style}>
            <g transform={`translate(${x} ${y})`}>
              <circle r="16" fill="rgb(246 241 234 / 0.06)" stroke={CREAM} strokeOpacity={0.18} />
              <g transform="scale(0.85)">{GLYPHS[glyph]}</g>
              <text y="29" textAnchor="middle" className="diagram-note">
                {label}
              </text>
            </g>
          </g>
        );
      })}
      {/* The crate itself, lid open. */}
      <g transform={`translate(${cx} ${crateY})`}>
        <rect x="-34" y="-6" width="68" height="26" rx="3" fill="#b88552" />
        <rect x="-34" y="4" width="68" height="3" fill="#5c3f28" />
        <path d="M-36,-6 L-30,-20 L34,-14 L36,-6 Z" fill="#5c3f28" className="crate-lid" />
      </g>
    </svg>
  );
}

/* ─── What Good Looks Like ──────────────────────────────────────────────────────────── */

const WGLL_STEPS = [
  ['Plan to', 'the checks'],
  ['Build', 'as data'],
  ['Render', 'in code'],
  ['Judge', 'each check'],
  ['Repair', 'once'],
] as const;
const WGLL_CHECKS = ['Meets every check', 'Numbers add up', 'Every button works', 'Product only, no notes'] as const;
const WGLL_LOOP = 11;

/** The exemplar pipeline: a token runs the stages; the judge ticks the checks, one fails, the repair fixes it. */
export function Wgll() {
  const nodes = useRef<(SVGCircleElement | null)[]>([]);
  const ticks = useRef<(SVGGElement | null)[]>([]);
  const token = useRef<SVGCircleElement>(null);
  const repair = useRef<SVGPathElement>(null);
  const shipped = useRef<SVGGElement>(null);
  const x0 = 70;
  const step = 100;
  const nodeY = 92;
  useClock((t) => {
    const lt = t % WGLL_LOOP;
    // 0–8: through the five stages; the judge stage takes longer, and repair loops back once.
    const at = lt < 1.6 ? lt / 1.6 : lt < 3.2 ? 1 + (lt - 1.6) / 1.6 : lt < 4.8 ? 2 + (lt - 3.2) / 1.6 : lt < 7.2 ? 3 : lt < 8.6 ? 4 : 4.6;
    const pos = Math.min(4, at);
    token.current?.setAttribute('cx', (x0 + pos * step).toFixed(1));
    nodes.current.forEach((n, k) => n?.setAttribute('fill', k <= Math.floor(pos + 0.001) ? LIME : 'rgb(246 241 234 / 0.25)'));
    // The judge reads each check against a verified quote; one fails until the repair.
    WGLL_CHECKS.forEach((_, k) => {
      const el = ticks.current[k];
      if (!el) return;
      const seen = lt > 4.9 + k * 0.5;
      const failing = k === 2 && lt < 8.2;
      el.setAttribute('opacity', seen ? '1' : '0.2');
      el.dataset.state = !seen ? '' : failing ? 'fail' : 'pass';
    });
    repair.current?.setAttribute('stroke-opacity', lt > 7.2 && lt < 8.6 ? '0.95' : '0.2');
    shipped.current?.setAttribute('opacity', lt > 8.8 ? '1' : '0.15');
  });
  return (
    <svg viewBox="0 0 540 262" className="diagram-svg" role="img" aria-label="The exemplar pipeline: plan against the checks, build as data, render in code, judge each check with a verified quote, repair once, then ship the product only.">
      <Frame w={540} h={262} title="What good looks like, made" />
      <line x1={x0} x2={x0 + 4 * step} y1={nodeY} y2={nodeY} stroke={CREAM} strokeOpacity={0.25} strokeWidth={2} />
      <path ref={repair} d={`M${x0 + 4 * step},${nodeY - 12} C${x0 + 3.6 * step},${nodeY - 52} ${x0 + 1.4 * step},${nodeY - 52} ${x0 + step},${nodeY - 12}`} fill="none" stroke={AMBER} strokeWidth={1.8} strokeDasharray="5 5" strokeOpacity={0.2} />
      <text x={x0 + 2.5 * step} y={nodeY - 46} textAnchor="middle" className="diagram-note">
        repair once, if it helps
      </text>
      {WGLL_STEPS.map(([a, b], k) => (
        <g key={a}>
          <circle
            ref={(el) => {
              nodes.current[k] = el;
            }}
            cx={x0 + k * step}
            cy={nodeY}
            r={8}
            fill="rgb(246 241 234 / 0.25)"
          />
          <text x={x0 + k * step} y={nodeY + 26} textAnchor="middle" className="diagram-note">
            {a}
          </text>
          <text x={x0 + k * step} y={nodeY + 39} textAnchor="middle" className="diagram-note">
            {b}
          </text>
        </g>
      ))}
      <circle ref={token} r={5} cy={nodeY} cx={x0} fill={CREAM} />
      {WGLL_CHECKS.map((label, k) => (
        <g
          key={label}
          ref={(el) => {
            ticks.current[k] = el;
          }}
          className="wgll-check"
          opacity={0.2}
          transform={`translate(${46 + (k % 2) * 238} ${168 + Math.floor(k / 2) * 30})`}
        >
          <circle r="8" className="wgll-mark" />
          <text x="16" y="4" className="diagram-note">
            {label}
          </text>
          <text x="16" y="17" className="diagram-note wgll-quote">
            “…” quote verified
          </text>
        </g>
      ))}
      <g ref={shipped} opacity={0.15}>
        <text x={514} y={38} textAnchor="end" className="diagram-label" fill={LIME}>
          Shipped: the product only
        </text>
      </g>
    </svg>
  );
}

/* ─── Reviewers in the loop ─────────────────────────────────────────────────────────── */

const REVIEW_LOOP = 12;
const VERDICTS = [
  { at: 0, out: 'pass' },
  { at: 1.5, out: 'redo' },
  { at: 3, out: 'pass' },
  { at: 4.5, out: 'code' },
  { at: 6, out: 'pass' },
  { at: 7.5, out: 'reject' },
  { at: 9, out: 'pass' },
  { at: 10.5, out: 'redo' },
] as const;

/** Work meets free checks in code first, then a judge; it passes, goes back with the reason, or stores nothing. */
export function Review() {
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const gateA = 170;
  const gateB = 300;
  const lanes = { pass: 82, redo: 140, reject: 198 } as const;
  useClock((t) => {
    const lt = t % REVIEW_LOOP;
    VERDICTS.forEach((v, i) => {
      const el = dots.current[i];
      if (!el) return;
      const age = (lt - v.at + REVIEW_LOOP) % REVIEW_LOOP;
      let x: number;
      let y = 140;
      let fill: string = CREAM;
      let op = 1;
      if (age < 1.2) x = 40 + (age / 1.2) * (gateA - 40);
      else if (v.out === 'code') {
        // Caught by a check in code: never reaches the judge, and costs nothing.
        const u = Math.min(1, (age - 1.2) / 1.2);
        x = gateA + 30 * u;
        y = 140 + 64 * u;
        fill = RED;
        op = age > 3 ? 0 : 1;
      } else if (age < 2.2) x = gateA + ((age - 1.2) / 1) * (gateB - gateA);
      else {
        const u = Math.min(1, (age - 2.2) / 1.4);
        x = gateB + u * 96;
        y = 140 + (lanes[v.out] - 140) * Math.min(1, u * 1.6);
        fill = v.out === 'pass' ? LIME : v.out === 'redo' ? AMBER : RED;
        op = age > 5 ? 0 : 1;
      }
      el.setAttribute('cx', x.toFixed(1));
      el.setAttribute('cy', y.toFixed(1));
      el.setAttribute('fill', fill);
      el.setAttribute('opacity', String(op));
    });
  });
  return (
    <svg viewBox="0 0 540 262" className="diagram-svg" role="img" aria-label="Reviewers: checks in code first, then a judge. Work passes, goes back with the reason, or is rejected and nothing is stored.">
      <Frame w={540} h={262} title="Every crate, reviewed" />
      <line x1={40} x2={gateB} y1={140} y2={140} stroke={CREAM} strokeOpacity={0.22} strokeDasharray="2 6" />
      <rect x={gateA - 9} y={108} width={18} height={64} rx={6} fill="rgb(246 241 234 / 0.12)" stroke={CREAM} strokeOpacity={0.4} />
      <text x={gateA} y={98} textAnchor="middle" className="diagram-label">
        Code checks
      </text>
      <text x={gateA} y={190} textAnchor="middle" className="diagram-note">
        free, first
      </text>
      <rect x={gateB - 9} y={108} width={18} height={64} rx={6} fill="rgb(185 239 46 / 0.12)" stroke={LIME} strokeOpacity={0.5} />
      <text x={gateB} y={98} textAnchor="middle" className="diagram-label">
        Judge
      </text>
      <text x={gateB} y={190} textAnchor="middle" className="diagram-note">
        a different model
      </text>
      <text x={410} y={lanes.pass + 4} className="diagram-label" fill={LIME}>
        Pass
      </text>
      <text x={410} y={lanes.redo + 4} className="diagram-label" fill={AMBER}>
        Re-ask
      </text>
      <text x={410} y={lanes.redo + 18} className="diagram-note">
        with the reason
      </text>
      <text x={410} y={lanes.reject + 4} className="diagram-label" fill={RED}>
        Reject
      </text>
      <text x={410} y={lanes.reject + 18} className="diagram-note">
        nothing stored
      </text>
      <text x={26} y={226} className="diagram-note">
        In doubt, generate: a wrong reuse reaches a learner,
      </text>
      <text x={26} y={242} className="diagram-note">
        a wrong refusal only costs a duplicate.
      </text>
      {VERDICTS.map((v, i) => (
        <circle
          key={v.at}
          ref={(el) => {
            dots.current[i] = el;
          }}
          r={6}
          cx={40}
          cy={140}
        />
      ))}
    </svg>
  );
}

/* ─── Written for a smart ten-year-old ──────────────────────────────────────────────── */

const BEFORE: readonly { w: string; bad?: boolean }[] = [
  { w: 'Leverage', bad: true },
  { w: 'the' },
  { w: 'retention' },
  { w: 'view' },
  { w: 'in' },
  { w: 'models/churn.sql', bad: true },
  { w: 'to' },
  { w: 'compute' },
  { w: 'the' },
  { w: 'cohort' },
  { w: 'delta,', bad: true },
  { w: 'ensuring' },
  { w: 'idempotent', bad: true },
  { w: 'aggregation', bad: true },
  { w: 'across' },
  { w: 'partitions.', bad: true },
];
const AFTER = ['Count how many customers left in March.'.split(' '), 'You will use that number in your chart.'.split(' ')] as const;
const RULES = ['Under 22 words a sentence', 'Five new terms, at most', 'No file paths', 'Says what it is for'];
const PLAIN_LOOP = 10;

/** A sentence that breaks the rules is rewritten, word by word, and every rule ticks. */
export function Plain() {
  const words = useRef<(SVGTSpanElement | null)[]>([]);
  const after = useRef<(SVGTSpanElement | null)[]>([]);
  const ticks = useRef<(SVGCircleElement | null)[]>([]);
  const strike = useRef<SVGLineElement>(null);
  useClock((t) => {
    const lt = t % PLAIN_LOOP;
    words.current.forEach((el, k) => el?.setAttribute('fill', BEFORE[k]?.bad && lt > 1.4 ? RED : CREAM));
    strike.current?.setAttribute('stroke-opacity', lt > 2.8 ? '0.7' : '0');
    after.current.forEach((el, k) => el?.setAttribute('opacity', lt > 3.2 + k * 0.14 ? '1' : '0'));
    ticks.current.forEach((el, k) => el?.setAttribute('fill', lt > 5.6 + k * 0.45 ? LIME : 'rgb(246 241 234 / 0.2)'));
  });
  const line = (from: number, to: number, y: number) => (
    <text x="26" y={y} className="plain-text">
      {BEFORE.slice(from, to).map((p, j) => (
        <tspan
          key={p.w + (from + j)}
          ref={(el) => {
            words.current[from + j] = el;
          }}
        >
          {p.w}{' '}
        </tspan>
      ))}
    </text>
  );
  return (
    <svg viewBox="0 0 540 268" className="diagram-svg" role="img" aria-label="Plain writing: a jargon sentence with a file path is rewritten as two short sentences that say what the answer is for.">
      <Frame w={540} h={268} title="Written for a smart ten-year-old" />
      <text x="26" y="66" className="diagram-note">
        before
      </text>
      {line(0, 9, 86)}
      {line(9, BEFORE.length, 106)}
      <line ref={strike} x1={26} x2={500} y1={96} y2={96} stroke={RED} strokeWidth={1.4} strokeOpacity={0} />
      <text x="26" y="140" className="diagram-note">
        after
      </text>
      {AFTER.map((sentence, row) => (
        <text key={row} x="26" y={160 + row * 22} className="plain-text plain-after">
          {sentence.map((w, j) => {
            const k = row * AFTER[0].length + j;
            return (
              <tspan
                key={k}
                ref={(el) => {
                  after.current[k] = el;
                }}
                opacity={0}
              >
                {w}{' '}
              </tspan>
            );
          })}
        </text>
      ))}
      {RULES.map((r, k) => (
        <g key={r} transform={`translate(${34 + (k % 2) * 250} ${214 + Math.floor(k / 2) * 22})`}>
          <circle
            ref={(el) => {
              ticks.current[k] = el;
            }}
            r={6}
            fill="rgb(246 241 234 / 0.2)"
          />
          <text x={14} y={4} className="diagram-note">
            {r}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── The machinery: a ladder of models ─────────────────────────────────────────────── */

const RUNGS = ['Bedrock', 'Other providers', 'Anthropic', 'Gemini'] as const;
const ROWS = ['Easy', 'Normal', 'Hard', 'Grading'] as const;
const LADDER_LOOP = 9;

/** A call tries the first rung; if that provider is down it drops a rung, and still answers. */
export function Machinery() {
  const call = useRef<SVGCircleElement>(null);
  const marks = useRef<(SVGTextElement | null)[]>([]);
  const row = useRef<(SVGRectElement | null)[]>([]);
  const rungY = (k: number) => 76 + k * 36;
  useClock((t) => {
    const lt = t % LADDER_LOOP;
    const first = Math.floor(t / LADDER_LOOP) % 2 === 0;
    // Odd rounds the first provider answers; even rounds it is throttled and the call drops a rung.
    const answeredAt = first ? 1 : 0;
    const rung = lt < 1.6 ? 0 : first && lt < 3.4 ? 0 + Math.min(1, (lt - 1.6) / 0.8) : first ? 1 : 0;
    call.current?.setAttribute('cy', rungY(rung).toFixed(1));
    call.current?.setAttribute('cx', (lt < 1.2 ? 150 + lt * 100 : 270).toFixed(1));
    call.current?.setAttribute('opacity', lt > 7.5 ? '0' : '1');
    marks.current.forEach((el, k) => {
      if (!el) return;
      const failed = first && k === 0 && lt > 1.4;
      const answered = k === answeredAt && lt > (first ? 3.4 : 1.6);
      el.textContent = failed ? '✕ throttled' : answered ? '✓ answered' : '';
      el.setAttribute('fill', failed ? RED : LIME);
    });
    row.current.forEach((el, k) => el?.setAttribute('fill-opacity', k === Math.floor(t / LADDER_LOOP) % ROWS.length ? '0.9' : '0.18'));
  });
  return (
    <svg viewBox="0 0 540 250" className="diagram-svg" role="img" aria-label="A ladder of models across providers: when one is throttled the call drops to the next and still answers. Ladders are chosen by difficulty: easy, normal, hard or grading.">
      <Frame w={540} h={250} title="Every call walks a ladder" />
      {RUNGS.map((r, k) => (
        <g key={r}>
          <line x1={140} x2={330} y1={rungY(k)} y2={rungY(k)} stroke={CREAM} strokeOpacity={0.3} strokeWidth={2} />
          <text x={128} y={rungY(k) + 4} textAnchor="end" className="diagram-label">
            {r}
          </text>
          <text
            ref={(el) => {
              marks.current[k] = el;
            }}
            x={340}
            y={rungY(k) + 4}
            className="diagram-label"
          />
        </g>
      ))}
      <line x1={140} x2={140} y1={rungY(0) - 10} y2={rungY(3) + 10} stroke={CREAM} strokeOpacity={0.3} strokeWidth={2} />
      <line x1={330} x2={330} y1={rungY(0) - 10} y2={rungY(3) + 10} stroke={CREAM} strokeOpacity={0.3} strokeWidth={2} />
      <circle ref={call} r={7} cx={150} cy={rungY(0)} fill={CYAN} />
      <text x={26} y={226} className="diagram-note">
        a ladder per difficulty:
      </text>
      {ROWS.map((r, k) => (
        <g key={r} transform={`translate(${190 + k * 80} 214)`}>
          <rect
            ref={(el) => {
              row.current[k] = el;
            }}
            width={70}
            height={18}
            rx={9}
            fill={LIME}
            fillOpacity={0.18}
          />
          <text x={35} y={13} textAnchor="middle" className="diagram-note" fill="#15131a">
            {r}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── The farm's loops, over the world ──────────────────────────────────────────────── */

const FARM_EDGES: readonly Arc[] = [
  { from: 'fields', to: 'barn', label: 'focus map', lift: 0.35, at: 0.3 },
  { from: 'silo', to: 'barn', label: 'reuse', lift: 0.9, at: 0.5 },
  { from: 'barn', to: 'dock', label: 'scenarios', lift: 0.3, at: 0.62 },
  { from: 'dock', to: 'downstream', label: 'to the learners', lift: 0.7, at: 0.62 },
  { from: 'dock', to: 'barn', label: 're-asks', lift: 0.9, at: 0.3, tone: 'redo' },
  { from: 'downstream', to: 'fields', label: 'fixes + playbook rules', lift: 0.62, at: 0.42, tone: 'back' },
];

export const FarmLoops = ({ scene }: { scene: string }) => <WorldArcs scene={scene} edges={FARM_EDGES} />;

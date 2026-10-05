/**
 * The Simulated Learners dive's boards: the personas, a cold read, a chat with the manager,
 * attempts at the grader, the triage of a stumble, a previewed fix, and the re-run.
 */
import { useRef } from 'react';
import { AMBER, CREAM, CYAN, LIME, VIOLET } from './colors.ts';
import { ease, fadeOut, Frame, typed, useClock } from './svg.tsx';

/** The personas' scarf colours, the same as the cohort's in the world. */
const BLUE = '#7fb2e8';
const ORANGE = '#f0a35e';
const PURPLE = '#b892e0';
const GREEN = '#8cc77a';
const GOLD = '#e8c95a';
const CORAL = '#ff8a73';
const INK = '#16131c';
const DIM = 'rgb(246 241 234 / 0.12)';

/** Shows an element from `a` (eased in over `d` seconds), as it rises a little into place. */
const rise = (el: SVGGElement | null, a: number, t: number, d = 0.4) => {
  const k = ease(a, a + d, t);
  el?.setAttribute('opacity', k.toFixed(2));
  el?.setAttribute('transform', `translate(0 ${((1 - k) * 8).toFixed(1)})`);
};

/** A ref callback that stores an element at index `i`. */
const at =
  <T,>(list: { current: (T | null)[] }, i: number) =>
  (el: T | null) => {
    list.current[i] = el;
  };

/* ─── Five learners, five habits ────────────────────────────────────────────────────── */

const PERSONA_LOOP = 10;
const PERSONAS = [
  { name: 'First-timer', habit: 'reads it twice', knows: 0.15, keeps: 0.55, color: BLUE },
  { name: 'Skimmer', habit: 'skips ahead', knows: 0.45, keeps: 0.3, color: ORANGE },
  { name: 'Literalist', habit: 'word for word', knows: 0.4, keeps: 0.85, color: PURPLE },
  { name: 'Switcher', habit: 'new to tools', knows: 0.6, keeps: 0.7, color: GREEN },
  { name: 'Expert', habit: 'wants it short', knows: 0.95, keeps: 0.45, color: GOLD },
] as const;
const RUNS = [6, 6.9, 7.8] as const;

/** Five cards are dealt, their traits fill, then the same five come back run after run. */
export function Personas() {
  const cards = useRef<(SVGGElement | null)[]>([]);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const outlines = useRef<(SVGRectElement | null)[]>([]);
  const runs = useRef<(SVGGElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % PERSONA_LOOP;
    cards.current.forEach((c, i) => rise(c, 0.3 + i * 0.35, t));
    PERSONAS.forEach((p, i) => {
      const k = ease(1.9 + i * 0.15, 3.1 + i * 0.15, t);
      bars.current[i * 2]?.setAttribute('width', (76 * p.knows * k).toFixed(1));
      bars.current[i * 2 + 1]?.setAttribute('width', (76 * p.keeps * k).toFixed(1));
      // Each run, the same learner comes back: its card blinks, unchanged.
      const blink = Math.max(...RUNS.map((r) => 1 - Math.min(1, Math.abs(t - r - 0.12 * i) * 4)));
      outlines.current[i]?.setAttribute('stroke-opacity', (0.25 + 0.75 * blink).toFixed(2));
    });
    runs.current.forEach((r, i) => rise(r, RUNS[i]!, t, 0.3));
    all.current?.setAttribute('opacity', fadeOut(t, PERSONA_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Five simulated learner personas: a first-timer who reads twice, a skimmer, a literalist who reads word for word, a career switcher new to the tools, and a domain expert. Each keeps who it is, run after run.">
      <Frame w={540} h={270} title="Five learners, five habits" />
      <g ref={all}>
        {PERSONAS.map((p, i) => {
          const x = 22 + i * 99;
          const mid = x + 46;
          return (
            <g key={p.name} ref={at(cards, i)} opacity={0}>
              <rect ref={at(outlines, i)} x={x} y={52} width={92} height={160} rx={14} fill="rgb(4 6 12 / 0.55)" stroke={p.color} strokeOpacity={0.25} strokeWidth={1.5} />
              <path d={`M${mid - 17},${108} C${mid - 17},${92} ${mid + 17},${92} ${mid + 17},${108} Z`} fill={p.color} />
              <circle cx={mid} cy={80} r={10} fill="#efd9c3" />
              <text x={mid} y={126} textAnchor="middle" className="diagram-note" fill={CREAM}>
                {p.name}
              </text>
              <text x={mid} y={140} textAnchor="middle" className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
                {p.habit}
              </text>
              {(['knows', 'keeps at it'] as const).map((trait, k) => (
                <g key={trait}>
                  <text x={x + 8} y={160 + k * 24} className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
                    {trait}
                  </text>
                  <rect x={x + 8} y={165 + k * 24} width={76} height={5} rx={2.5} fill={DIM} />
                  <rect ref={at(bars, i * 2 + k)} x={x + 8} y={165 + k * 24} width={0} height={5} rx={2.5} fill={p.color} />
                </g>
              ))}
            </g>
          );
        })}
        <text x="26" y="244" className="diagram-note">
          The same person, run after run
        </text>
        {RUNS.map((_, i) => (
          <g key={i} ref={at(runs, i)} opacity={0}>
            <rect x={250 + i * 66} y={231} width={58} height={20} rx={10} fill="rgb(185 239 46 / 0.12)" stroke={LIME} strokeOpacity={0.6} />
            <text x={279 + i * 66} y={245} textAnchor="middle" className="diagram-tag" fill={LIME}>
              run {i + 1}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ─── The cold read ─────────────────────────────────────────────────────────────────── */

const COLD_LOOP = 13;
const STAGE = ['Send the team a one-page', 'summary of the pilot by', 'Friday, with its cost.'] as const;
const READS = [
  { text: 'A one-page pilot summary', color: BLUE, ok: true },
  { text: 'Mine, or the client’s team?', color: PURPLE, ok: false },
  { text: 'Pilot, cost, by Friday', color: GREEN, ok: true },
] as const;
const MONO = 6.72;

/** The stage is read with no rubric; three paraphrases come back, and one finds a phrase that reads two ways. */
export function ColdRead() {
  const reads = useRef<(SVGTextElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const marks = useRef<(SVGGElement | null)[]>([]);
  const glow = useRef<SVGRectElement>(null);
  const link = useRef<SVGPathElement>(null);
  const verdict = useRef<SVGGElement>(null);
  const chips = useRef<(SVGGElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % COLD_LOOP;
    chips.current.forEach((c, i) => rise(c, 0.4 + i * 0.25, t, 0.3));
    READS.forEach((r, i) => {
      const a = 1.6 + i * 1.3;
      const el = reads.current[i];
      if (el) el.textContent = typed(r.text, a, a + 1, t);
      dots.current[i]?.setAttribute('opacity', ease(a - 0.3, a, t).toFixed(2));
      rise(marks.current[i] ?? null, a + 1.1, t, 0.25);
    });
    const found = ease(6.4, 7, t);
    glow.current?.setAttribute('opacity', (0.9 * found).toFixed(2));
    link.current?.setAttribute('stroke-dashoffset', (260 * (1 - ease(6.4, 7.4, t))).toFixed(1));
    rise(verdict.current, 7.8, t);
    all.current?.setAttribute('opacity', fadeOut(t, COLD_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A stage is read cold, with no rubric and no worked answer. Three learners paraphrase it; one asks whether 'the team' means theirs or the client's, so the phrase is flagged before anyone builds.">
      <Frame w={540} h={270} title="The cold read" />
      <g ref={all}>
        <rect x="26" y="52" width="232" height="120" rx="12" fill="rgb(4 6 12 / 0.6)" stroke={CREAM} strokeOpacity={0.16} />
        <text x="40" y="74" className="diagram-label">
          The stage
        </text>
        <rect ref={glow} x={40 + 5 * MONO - 3} y={86} width={8 * MONO + 6} height={18} rx={4} fill="rgb(255 196 92 / 0.28)" stroke={AMBER} opacity={0} />
        {STAGE.map((line, i) => (
          <text key={line} x="40" y={99 + i * 20} className="diagram-note" fill={CREAM}>
            {line}
          </text>
        ))}

        <text x="282" y="74" className="diagram-label">
          What they think it asks
        </text>
        {READS.map((r, i) => (
          <g key={r.text}>
            <circle ref={at(dots, i)} cx={290} cy={95 + i * 30} r={5} fill={r.color} opacity={0} />
            <text ref={at(reads, i)} x={304} y={99 + i * 30} className="diagram-note" fill={CREAM} />
            <g ref={at(marks, i)} opacity={0}>
              {r.ok ? (
                <path d={`M494,${95 + i * 30} l4,4 l8,-9`} fill="none" stroke={LIME} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <text x={500} y={100 + i * 30} textAnchor="middle" className="diagram-big-s" fill={AMBER}>
                  ?!
                </text>
              )}
            </g>
          </g>
        ))}
        <path ref={link} d="M 298,124 C 240,150 150,140 104,106" fill="none" stroke={AMBER} strokeWidth={1.6} strokeDasharray="260" strokeDashoffset="260" />

        <g ref={verdict} opacity={0}>
          <text x="26" y="200" className="diagram-note" fill={AMBER}>
            “the team” reads two ways: flagged before anyone builds
          </text>
        </g>
        {[
          { text: 'no rubric', color: CREAM, open: false },
          { text: 'no worked answer', color: CREAM, open: false },
          { text: 'the checks, in full', color: LIME, open: true },
        ].map((c, i) => {
          const x = [26, 124, 262][i]!;
          const w = c.text.length * 5.6 + 34;
          return (
            <g key={c.text} ref={at(chips, i)} opacity={0}>
              <rect x={x} y={222} width={w} height={22} rx={11} fill="rgb(4 6 12 / 0.5)" stroke={c.color} strokeOpacity={0.45} />
              <rect x={x + 10} y={232} width={9} height={7} rx={1.5} fill={c.color} fillOpacity={0.8} />
              <path d={c.open ? `M${x + 12},${232} v-3 a3,3 0 0 1 6,0` : `M${x + 11.5},${232} v-2.5 a3,3 0 0 1 6,0 v2.5`} fill="none" stroke={c.color} strokeWidth={1.3} />
              <text x={x + 26} y={237} className="diagram-tag" fill={c.color}>
                {c.text}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ─── Asking the manager ────────────────────────────────────────────────────────────── */

const ASK_LOOP = 12;
const CHAT = [
  { who: 'learner', at: 0.6, x: 40, y: 56, w: 236, lines: ['Who is the summary for: my team,', 'or the client’s?'] },
  { who: 'manager', at: 3.2, x: 290, y: 104, w: 210, lines: ['Your team, the sales leads.', 'One page, the result first.'] },
  { who: 'manager', at: 5.4, x: 300, y: 152, w: 200, lines: ['What would you lead with?'] },
  { who: 'learner', at: 7.4, x: 40, y: 188, w: 252, lines: ['The pilot’s result, then its cost.'] },
] as const;

/** A learner asks the manager in chat; the manager answers in character, then checks back. */
export function AskChat() {
  const bubbles = useRef<(SVGGElement | null)[]>([]);
  const typing = useRef<SVGGElement>(null);
  const footer = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % ASK_LOOP;
    CHAT.forEach((m, i) => rise(bubbles.current[i] ?? null, m.at, t, 0.3));
    const dots = (t > 2 && t < 3.2) || (t > 4.4 && t < 5.4);
    typing.current?.setAttribute('opacity', dots ? (0.55 + 0.45 * Math.sin(time * 9)).toFixed(2) : '0');
    typing.current?.setAttribute('transform', `translate(0 ${t > 4 ? 48 : 0})`);
    rise(footer.current, 9, t);
    all.current?.setAttribute('opacity', fadeOut(t, ASK_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="In chat, a learner asks the manager who the summary is for; the manager answers in character, then asks what the learner would lead with. Both sides are kept as evidence.">
      <Frame w={540} h={270} title="Asking the manager, in chat" />
      <g ref={all}>
        {CHAT.map((m, i) => {
          const mine = m.who === 'learner';
          const h = 14 + m.lines.length * 15;
          return (
            <g key={i} ref={at(bubbles, i)} opacity={0}>
              <rect x={m.x} y={m.y} width={m.w} height={h} rx={12} fill={mine ? PURPLE : LIME} fillOpacity={mine ? 0.9 : 0.92} />
              {m.lines.map((line, k) => (
                <text key={line} x={m.x + 12} y={m.y + 19 + k * 15} className="diagram-note" fill={INK}>
                  {line}
                </text>
              ))}
              {CHAT[i - 1]?.who !== m.who && (
                <text x={mine ? m.x : m.x + m.w} y={m.y - 4} textAnchor={mine ? 'start' : 'end'} className="diagram-tag" fill="rgb(246 241 234 / 0.55)">
                  {mine ? 'learner' : 'manager'}
                </text>
              )}
            </g>
          );
        })}
        <g ref={typing} opacity={0}>
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={476 + k * 10} cy={114} r={3} fill={LIME} />
          ))}
        </g>
        <g ref={footer} opacity={0}>
          <text x="26" y="246" className="diagram-note">
            Both sides are kept. Many questions here mean an unclear line.
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── Real work, really graded ──────────────────────────────────────────────────────── */

const ATTEMPT_LOOP = 13;
const ATTEMPTS = [
  { at: 0.6, pass: false, why: 'the cost is missing' },
  { at: 2.8, pass: false, why: 'the numbers have no source' },
  { at: 5, pass: true, why: 'meets every check' },
] as const;
const CAP_SLOTS = 6;

/** Attempt by attempt to a pass, under a cap; a dropped connection is not counted as one. */
export function Attempts() {
  const rows = useRef<(SVGGElement | null)[]>([]);
  const slots = useRef<(SVGRectElement | null)[]>([]);
  const dropped = useRef<SVGGElement>(null);
  const ghost = useRef<SVGRectElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % ATTEMPT_LOOP;
    ATTEMPTS.forEach((a, i) => {
      rise(rows.current[i] ?? null, a.at, t);
      const filled = t > a.at + 0.9;
      slots.current[i]?.setAttribute('fill', filled ? (a.pass ? LIME : AMBER) : DIM);
    });
    rise(dropped.current, 7.4, t);
    // The dropped connection lights a slot for a moment, then gives it back.
    const flick = ease(8.4, 8.7, t) * (1 - ease(9.4, 9.9, t));
    ghost.current?.setAttribute('opacity', flick.toFixed(2));
    all.current?.setAttribute('opacity', fadeOut(t, ATTEMPT_LOOP).toFixed(2));
  });
  const slotY = (k: number) => 206 - k * 24;
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A learner hands in real work: reworked twice, then a pass, under a cap set for each cohort. A dropped connection is not graded and not counted as an attempt.">
      <Frame w={540} h={270} title="Real work, really graded" />
      <g ref={all}>
        {ATTEMPTS.map((a, i) => {
          const y = 58 + i * 44;
          const color = a.pass ? LIME : AMBER;
          return (
            <g key={i} ref={at(rows, i)} opacity={0}>
              <rect x={30} y={y} width={22} height={28} rx={3} fill={CREAM} fillOpacity={0.9} />
              {[0, 1, 2].map((k) => (
                <rect key={k} x={35} y={y + 7 + k * 6} width={k === 2 ? 7 : 12} height={2.5} fill={INK} fillOpacity={0.55} />
              ))}
              <text x={64} y={y + 18} className="diagram-label">
                Attempt {i + 1}
              </text>
              <path d={`M146,${y + 14} h26 m-6,-5 l6,5 l-6,5`} fill="none" stroke={CREAM} strokeOpacity={0.5} strokeWidth={1.4} />
              <rect x={182} y={y + 3} width={66} height={22} rx={11} fill={color} fillOpacity={0.16} stroke={color} />
              <text x={215} y={y + 18} textAnchor="middle" className="diagram-tag" fill={color}>
                {a.pass ? 'PASS' : 'REWORK'}
              </text>
              <text x={258} y={y + 18} className="diagram-note">
                {a.why}
              </text>
            </g>
          );
        })}
        <g ref={dropped} opacity={0}>
          <path d="M34,206 h8 m4,-6 v12 m4,-12 v12 m4,-6 h8" fill="none" stroke={CYAN} strokeWidth={1.6} strokeLinecap="round" />
          <text x={64} y={210} className="diagram-note" fill={CYAN}>
            A dropped connection: not graded, so not an attempt
          </text>
        </g>

        <text x="438" y="66" className="diagram-label">
          Tries
        </text>
        {Array.from({ length: CAP_SLOTS }, (_, k) => (
          <rect key={k} ref={at(slots, k)} x={444} y={slotY(k)} width={44} height={18} rx={5} fill={DIM} />
        ))}
        <rect ref={ghost} x={444} y={slotY(3)} width={44} height={18} rx={5} fill="none" stroke={CYAN} strokeWidth={1.6} strokeDasharray="4 3" opacity={0} />
        <line x1={436} x2={496} y1={slotY(CAP_SLOTS - 1) - 4} y2={slotY(CAP_SLOTS - 1) - 4} stroke={CREAM} strokeOpacity={0.6} strokeDasharray="5 4" />
        <text x="466" y="244" textAnchor="middle" className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
          cap, per cohort
        </text>
      </g>
    </svg>
  );
}

/* ─── Where they stumble ────────────────────────────────────────────────────────────── */

const TRIAGE_LOOP = 12;
const SIGNALS = ['Readings', 'Questions', 'Verdicts', 'Learning', 'Platform calls'] as const;
const BINS = [
  { name: 'Content', count: 4, color: CORAL, note: '→ becomes a fix' },
  { name: 'Harness', count: 1, color: CYAN, note: 'counted, not a defect' },
  { name: 'Learner', count: 1, color: VIOLET, note: 'counted, not a defect' },
] as const;
const JUDGE = { x: 238, y: 122 };

/** Five kinds of signal stream into one judge; each stumble lands in a bin, and most of the cohort tripping means the content. */
export function Triage() {
  const sparks = useRef<(SVGCircleElement | null)[]>([]);
  const outs = useRef<(SVGCircleElement | null)[]>([]);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const counts = useRef<(SVGTextElement | null)[]>([]);
  const notes = useRef<(SVGGElement | null)[]>([]);
  const judge = useRef<SVGCircleElement>(null);
  const meter = useRef<SVGRectElement>(null);
  const verdict = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % TRIAGE_LOOP;
    // Signals flow in for the first few seconds.
    SIGNALS.forEach((_, i) => {
      const s = sparks.current[i];
      const u = ((time * 0.8 + i * 0.21) % 1) * (t < 4.4 ? 1 : 0);
      const y0 = 70 + i * 30;
      s?.setAttribute('cx', (140 + (JUDGE.x - 26 - 140) * u).toFixed(1));
      s?.setAttribute('cy', (y0 + (JUDGE.y - y0) * u).toFixed(1));
      s?.setAttribute('opacity', t < 4.4 && u > 0.02 ? '0.9' : '0');
    });
    judge.current?.setAttribute('stroke-opacity', (0.4 + 0.6 * Math.abs(Math.sin(time * 3)) * (t > 1 && t < 5 ? 1 : 0.3)).toFixed(2));
    BINS.forEach((b, i) => {
      const a = 2.2 + i * 0.6;
      const k = ease(a, a + 1.2, t);
      bars.current[i]?.setAttribute('width', ((128 * b.count * k) / 5).toFixed(1));
      const c = counts.current[i];
      if (c) c.textContent = String(Math.round(b.count * k));
      const o = outs.current[i];
      const u = ease(a - 0.4, a + 0.2, t);
      const y1 = 72 + i * 46;
      o?.setAttribute('cx', (JUDGE.x + 26 + (322 - JUDGE.x - 26) * u).toFixed(1));
      o?.setAttribute('cy', (JUDGE.y + (y1 - JUDGE.y) * u).toFixed(1));
      o?.setAttribute('opacity', u > 0.02 && u < 0.98 ? '1' : '0');
      rise(notes.current[i] ?? null, a + 1.3, t, 0.3);
    });
    meter.current?.setAttribute('width', (288 * 0.8 * ease(6.2, 7.6, t)).toFixed(1));
    rise(verdict.current, 7.9, t);
    all.current?.setAttribute('opacity', fadeOut(t, TRIAGE_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Readings, questions, verdicts, learning and platform calls flow into one judge, which blames each stumble on content, harness or learner. Only content becomes a fix. Four of five learners tripping on one step means the content is wrong.">
      <Frame w={540} h={270} title="Where they stumble" />
      <g ref={all}>
        {SIGNALS.map((s, i) => (
          <g key={s}>
            <rect x={26} y={60 + i * 30} width={112} height={20} rx={10} fill="rgb(4 6 12 / 0.5)" stroke={CREAM} strokeOpacity={0.25} />
            <text x={36} y={74 + i * 30} className="diagram-tag" fill={CREAM}>
              {s}
            </text>
            <line x1={140} y1={70 + i * 30} x2={JUDGE.x - 26} y2={JUDGE.y} stroke={CREAM} strokeOpacity={0.1} />
            <circle ref={at(sparks, i)} r={2.6} fill={CREAM} opacity={0} />
          </g>
        ))}
        <circle ref={judge} cx={JUDGE.x} cy={JUDGE.y} r={24} fill="rgb(4 6 12 / 0.7)" stroke={LIME} strokeWidth={1.8} />
        <path d={`M${JUDGE.x - 10},${JUDGE.y - 2} h20 M${JUDGE.x},${JUDGE.y - 10} v20 M${JUDGE.x - 10},${JUDGE.y + 6} l-3,-6 l6,0 Z M${JUDGE.x + 10},${JUDGE.y + 6} l-3,-6 l6,0 Z`} fill="none" stroke={LIME} strokeWidth={1.4} strokeLinejoin="round" />
        <text x={JUDGE.x} y={JUDGE.y + 42} textAnchor="middle" className="diagram-tag" fill={LIME}>
          one judge
        </text>
        <text x={JUDGE.x} y={JUDGE.y + 54} textAnchor="middle" className="diagram-tag" fill="rgb(246 241 234 / 0.55)">
          code counts
        </text>
        {BINS.map((b, i) => {
          const y = 66 + i * 46;
          return (
            <g key={b.name}>
              <line x1={JUDGE.x + 26} y1={JUDGE.y} x2={322} y2={y + 6} stroke={b.color} strokeOpacity={0.18} />
              <circle ref={at(outs, i)} r={3} fill={b.color} opacity={0} />
              <text x={330} y={y} className="diagram-label" fill={b.color}>
                {b.name}
              </text>
              <rect x={330} y={y + 6} width={128} height={8} rx={4} fill={DIM} />
              <rect ref={at(bars, i)} x={330} y={y + 6} width={0} height={8} rx={4} fill={b.color} />
              <text ref={at(counts, i)} x={470} y={y + 14} className="diagram-big-s" fill={b.color}>
                0
              </text>
              <g ref={at(notes, i)} opacity={0}>
                <text x={330} y={y + 28} className="diagram-tag" fill={i === 0 ? LIME : 'rgb(246 241 234 / 0.55)'}>
                  {b.note}
                </text>
              </g>
            </g>
          );
        })}
        <text x="26" y="222" className="diagram-note">
          This step: 4 of 5 learners tripped
        </text>
        <rect x={26} y={230} width={288} height={10} rx={5} fill={DIM} />
        <rect ref={meter} x={26} y={230} width={0} height={10} rx={5} fill={CORAL} />
        <line x1={26 + 288 * 0.6} x2={26 + 288 * 0.6} y1={226} y2={244} stroke={CREAM} strokeDasharray="3 2" />
        <text x={26 + 288 * 0.6} y={256} textAnchor="middle" className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
          60%
        </text>
        <g ref={verdict} opacity={0}>
          <text x="330" y="240" className="diagram-note" fill={CORAL}>
            → the content is wrong
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── A fix, previewed ──────────────────────────────────────────────────────────────── */

const FIX_LOOP = 13;
const OLD = '− Send the team a one-page summary of the pilot.';
const NEW = ['+ Send your sales leads a one-page summary', 'of the pilot: the result first, then its cost.'] as const;
const MONO_W = 7.13;
const BUTTONS = [
  { name: 'Preview', color: AMBER },
  { name: 'Apply', color: LIME },
  { name: 'Undo', color: CREAM },
] as const;

/** The diff is previewed, applied exactly as shown, and can be undone; the dial is set to propose. */
export function FixDiff() {
  const strike = useRef<SVGLineElement>(null);
  const added = useRef<(SVGTextElement | null)[]>([]);
  const preview = useRef<SVGGElement>(null);
  const applied = useRef<SVGGElement>(null);
  const buttons = useRef<(SVGRectElement | null)[]>([]);
  const words = useRef<(SVGTextElement | null)[]>([]);
  const notes = useRef<(SVGGElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % FIX_LOOP;
    strike.current?.setAttribute('x2', (40 + (OLD.length * MONO_W - 4) * ease(0.8, 1.6, t)).toFixed(1));
    NEW.forEach((line, i) => {
      const el = added.current[i];
      if (el) el.textContent = typed(line, 1.8 + i * 1.3, 3 + i * 1.3, t);
    });
    const on = ease(5, 5.3, t);
    preview.current?.setAttribute('opacity', (ease(0.3, 0.7, t) * (1 - on)).toFixed(2));
    applied.current?.setAttribute('opacity', on.toFixed(2));
    // Preview is lit while it previews, Apply flashes when pressed, Undo is ready after.
    const lit = [t > 0.3 && t < 5 ? 1 : 0, Math.max(0, 1 - Math.abs(t - 5.1) * 2.5), ease(6, 6.5, t)];
    buttons.current.forEach((b, i) => b?.setAttribute('fill-opacity', (0.08 + 0.84 * lit[i]!).toFixed(2)));
    // A lit button reads dark on its own colour.
    words.current.forEach((w, i) => w?.setAttribute('fill', lit[i]! > 0.5 ? INK : BUTTONS[i]!.color));
    notes.current.forEach((n, i) => rise(n, 6.6 + i * 0.7, t));
    all.current?.setAttribute('opacity', fadeOut(t, FIX_LOOP).toFixed(2));
  });
  const needle = Math.PI * 0.5;
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A fix to the stage's instruction is previewed as a diff, applied exactly as previewed and saved as a revision that can be undone. An autonomy dial, set to propose, could apply fixes on its own under a daily budget.">
      <Frame w={540} h={270} title="A fix, previewed" />
      <g ref={all}>
        <rect x="26" y="52" width="488" height="96" rx="12" fill="rgb(4 6 12 / 0.6)" stroke={CREAM} strokeOpacity={0.16} />
        <g ref={preview} opacity={0}>
          <text x="500" y="70" textAnchor="end" className="diagram-tag" fill={AMBER}>
            PREVIEW · nothing written yet
          </text>
        </g>
        <g ref={applied} opacity={0}>
          <text x="500" y="70" textAnchor="end" className="diagram-tag" fill={LIME}>
            APPLIED · saved as a revision
          </text>
        </g>
        <text x="40" y="70" className="diagram-label">
          Instruction
        </text>
        <text x="40" y="94" className="diagram-mono" fill="rgb(255 106 85 / 0.85)">
          {OLD}
        </text>
        <line ref={strike} x1={40} x2={40} y1={90} y2={90} stroke="rgb(255 106 85 / 0.85)" strokeWidth={1.4} />
        {NEW.map((_, i) => (
          <text key={i} ref={at(added, i)} x={40 + (i ? 2 * MONO_W : 0)} y={116 + i * 18} className="diagram-mono" fill={LIME} />
        ))}

        {BUTTONS.map((b, i) => (
          <g key={b.name}>
            <rect ref={at(buttons, i)} x={26 + i * 92} y={162} width={82} height={26} rx={13} fill={b.color} fillOpacity={0.08} stroke={b.color} strokeOpacity={0.7} />
            <text ref={at(words, i)} x={67 + i * 92} y={179} textAnchor="middle" className="diagram-tag" fill={b.color}>
              {b.name.toUpperCase()}
            </text>
          </g>
        ))}
        {['Apply writes exactly what the preview showed.', 'Every change is a revision you can revert.'].map((line, i) => (
          <g key={line} ref={at(notes, i)} opacity={0}>
            <text x="26" y={218 + i * 18} className="diagram-note">
              {line}
            </text>
          </g>
        ))}

        <g transform="translate(446 222)">
          <path d="M-46,0 A46,46 0 0 1 46,0" fill="none" stroke={CREAM} strokeOpacity={0.16} strokeWidth={8} strokeLinecap="round" />
          <path d="M-46,0 A46,46 0 0 1 0,-46" fill="none" stroke={AMBER} strokeOpacity={0.7} strokeWidth={8} strokeLinecap="round" />
          <line x1={0} y1={0} x2={(-Math.cos(needle) * 36).toFixed(1)} y2={(-Math.sin(needle) * 36).toFixed(1)} stroke={CREAM} strokeWidth={2.2} strokeLinecap="round" />
          <circle r={4} fill={CREAM} />
          <text x={-52} y={18} textAnchor="middle" className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
            off
          </text>
          <text x={0} y={-56} textAnchor="middle" className="diagram-tag" fill={AMBER}>
            propose
          </text>
          <text x={52} y={18} textAnchor="middle" className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
            auto
          </text>
          <text x={0} y={34} textAnchor="middle" className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
            autonomy dial
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── Run it again ──────────────────────────────────────────────────────────────────── */

const RERUN_LOOP = 11;
const FINDINGS = [
  { text: 'Instruction reads two ways', before: 9, after: 2 },
  { text: 'Asked what “done” means', before: 6, after: 1 },
  { text: 'Looked for a file that wasn’t there', before: 4, after: 0 },
] as const;
const UNIT = 300 / 9;

/** The first run's counts, then the next cohort's, on the same stage. */
export function BeforeAfter() {
  const before = useRef<(SVGRectElement | null)[]>([]);
  const after = useRef<(SVGRectElement | null)[]>([]);
  const figures = useRef<(SVGTextElement | null)[]>([]);
  const footer = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % RERUN_LOOP;
    FINDINGS.forEach((f, i) => {
      const b = ease(0.4 + i * 0.2, 1.4 + i * 0.2, t);
      const a = ease(3.2 + i * 0.3, 4.6 + i * 0.3, t);
      before.current[i]?.setAttribute('width', (UNIT * f.before * b).toFixed(1));
      before.current[i]?.setAttribute('fill-opacity', (1 - 0.55 * a).toFixed(2));
      after.current[i]?.setAttribute('width', (UNIT * f.after * a).toFixed(1));
      const el = figures.current[i];
      if (el) el.textContent = a > 0.02 ? `${f.before} → ${Math.round(f.before + (f.after - f.before) * a)}` : b > 0.02 ? `${Math.round(f.before * b)}` : '';
    });
    rise(footer.current, 6.4, t);
    all.current?.setAttribute('opacity', fadeOut(t, RERUN_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="An example re-run report: on the same stage, the next cohort's counts beside the first run's. Instruction reads two ways: 9 to 2. Asked what done means: 6 to 1. Looked for a missing file: 4 to 0.">
      <Frame w={540} h={270} title="Same stage, next cohort" />
      <g ref={all}>
        <rect x={360} y={30} width={10} height={8} rx={2} fill={AMBER} />
        <text x={376} y={38} className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
          first run
        </text>
        <rect x={436} y={30} width={10} height={8} rx={2} fill={LIME} />
        <text x={452} y={38} className="diagram-tag" fill="rgb(246 241 234 / 0.6)">
          after the fix
        </text>
        {FINDINGS.map((f, i) => {
          const y = 70 + i * 54;
          return (
            <g key={f.text}>
              <text x={26} y={y} className="diagram-note" fill={CREAM}>
                {f.text}
              </text>
              <rect x={26} y={y + 8} width={300} height={8} rx={4} fill={DIM} />
              <rect ref={at(before, i)} x={26} y={y + 8} width={0} height={8} rx={4} fill={AMBER} />
              <rect x={26} y={y + 20} width={300} height={8} rx={4} fill={DIM} />
              <rect ref={at(after, i)} x={26} y={y + 20} width={0} height={8} rx={4} fill={LIME} />
              <text ref={at(figures, i)} x={350} y={y + 26} className="diagram-big-s" fill={LIME} />
            </g>
          );
        })}
        <g ref={footer} opacity={0}>
          <text x="26" y="244" className="diagram-note">
            An example report. A fix that moves nothing shows as one.
          </text>
        </g>
      </g>
    </svg>
  );
}

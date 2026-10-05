/**
 * The Voice dive's boards: the race to the first word, the verdict that is never voiced,
 * the sentence gate, the screen-frame gate, teach-then-check, and the stack.
 */
import { useRef } from 'react';
import { AMBER, CREAM, CYAN, LIME, VIOLET } from './colors.ts';
import { ease, fadeOut, Frame, typed, useClock } from './svg.tsx';

const INK = '#16131c';
const DIM = 'rgb(246 241 234 / 0.12)';
const SOFT = 'rgb(246 241 234 / 0.6)';
const GREY = '#9aa0ac';

const rise = (el: SVGGElement | null, a: number, t: number, d = 0.4) => {
  const k = ease(a, a + d, t);
  el?.setAttribute('opacity', k.toFixed(2));
  el?.setAttribute('transform', `translate(0 ${((1 - k) * 8).toFixed(1)})`);
};
const at =
  <T,>(list: { current: (T | null)[] }, i: number) =>
  (el: T | null) => {
    list.current[i] = el;
  };

/** A small speaker, drawn around (x, y). */
const Speaker = ({ x, y, color }: { x: number; y: number; color: string }) => (
  <path d={`M${x - 6},${y - 3} h4 l5,-5 v16 l-5,-5 h-4 Z M${x + 6},${y - 4} q4,4 0,8`} fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
);

/* ─── The race to the first word ────────────────────────────────────────────────────── */

const RACE_LOOP = 10;
const X0 = 130;
const PER_S = 60;
const xs = (s: number) => X0 + s * PER_S;
const ROWS = [
  {
    name: 'Two calls',
    y: 76,
    first: 5.4,
    parts: [
      { from: 0, to: 0.5, label: '', color: DIM },
      { from: 0.5, to: 2.9, label: 'grade', color: GREY },
      { from: 2.9, to: 5.4, label: 'write the reply', color: CREAM },
    ],
  },
  {
    name: 'One call',
    y: 136,
    first: 2.1,
    parts: [
      { from: 0, to: 0.5, label: '', color: DIM },
      { from: 0.5, to: 1.3, label: 'verdict', color: GREY },
      { from: 1.3, to: 2.1, label: 'reply', color: LIME },
    ],
  },
] as const;

/** Two timelines under one playhead: the old pair of calls, and the one streamed call. */
export function TwoCalls() {
  const head = useRef<SVGLineElement>(null);
  const fills = useRef<(SVGRectElement | null)[]>([]);
  const firsts = useRef<(SVGGElement | null)[]>([]);
  const talk = useRef<(SVGRectElement | null)[]>([]);
  const note = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % RACE_LOOP;
    const s = Math.min(6, t * 0.85);
    head.current?.setAttribute('x1', xs(s).toFixed(1));
    head.current?.setAttribute('x2', xs(s).toFixed(1));
    let k = 0;
    for (const row of ROWS)
      for (const p of row.parts) {
        const w = Math.max(0, Math.min(s, p.to) - p.from) * PER_S;
        fills.current[k++]?.setAttribute('width', w.toFixed(1));
      }
    ROWS.forEach((row, i) => {
      rise(firsts.current[i] ?? null, row.first / 0.85, t, 0.3);
      // Once the first sentence is out, the voice keeps going.
      talk.current.forEach((b, j) => {
        if (Math.floor(j / 12) !== i) return;
        const x = xs(row.first) + 8 + (j % 12) * 8;
        const on = s > row.first + (j % 12) * 0.12 && x < xs(6);
        b?.setAttribute('height', on ? (3 + 9 * Math.abs(Math.sin(time * 9 + j))).toFixed(1) : '0');
        b?.setAttribute('y', (row.y + 13 - (on ? (3 + 9 * Math.abs(Math.sin(time * 9 + j))) / 2 : 0)).toFixed(1));
      });
    });
    rise(note.current, 7.2, t);
    all.current?.setAttribute('opacity', fadeOut(t, RACE_LOOP).toFixed(2));
  });
  let k = 0;
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Two timelines: grading then replying in two calls speaks its first sentence at 5.4 seconds; one streamed call with the verdict first speaks at 2.1 seconds.">
      <Frame w={540} h={270} title="The race to the first word" />
      <g ref={all}>
        {ROWS.map((row, i) => (
          <g key={row.name}>
            <text x="26" y={row.y + 17} className="diagram-label" fill={i ? LIME : CREAM}>
              {row.name}
            </text>
            <rect x={X0} y={row.y} width={6 * PER_S} height={26} rx={6} fill="rgb(4 6 12 / 0.5)" />
            {row.parts.map((p) => (
              <g key={p.from}>
                <rect ref={at(fills, k++)} x={xs(p.from)} y={row.y} width={0} height={26} rx={6} fill={p.color} fillOpacity={p.color === DIM ? 1 : 0.85} />
                {p.label && (
                  <text x={xs(p.from) + 8} y={row.y + 17} className="diagram-tag" fill={INK}>
                    {p.label}
                  </text>
                )}
              </g>
            ))}
            {Array.from({ length: 12 }, (_, j) => (
              <rect key={j} ref={at(talk, i * 12 + j)} x={xs(row.first) + 8 + j * 8} y={row.y + 13} width={4} height={0} rx={2} fill={i ? LIME : CREAM} />
            ))}
            <g ref={at(firsts, i)} opacity={0}>
              <line x1={xs(row.first)} x2={xs(row.first)} y1={row.y - 6} y2={row.y + 32} stroke={i ? LIME : CREAM} strokeWidth={2} />
              <text x={xs(row.first)} y={row.y - 10} textAnchor="middle" className="diagram-big-s" fill={i ? LIME : CREAM}>
                {row.first} s
              </text>
            </g>
          </g>
        ))}
        {Array.from({ length: 7 }, (_, s) => (
          <text key={s} x={xs(s)} y={190} textAnchor="middle" className="diagram-tag" fill={SOFT}>
            {s} s
          </text>
        ))}
        <line ref={head} x1={X0} x2={X0} y1={60} y2={176} stroke={CYAN} strokeWidth={1.4} strokeDasharray="3 3" />
        <g ref={note} opacity={0}>
          <text x="26" y="232" className="diagram-note">
            First spoken sentence, after the learner stops talking
          </text>
          <text x="420" y="233" className="diagram-big-s" fill={LIME}>
            −61%
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── The verdict is never voiced ───────────────────────────────────────────────────── */

const VERDICT_LOOP = 12;
const TAG = '<verdict>{"covered": [1, 3]}</verdict>';
const REPLY = ['Nice, you named both risks.', 'What would you cut first?'] as const;

/** The stream: a verdict in a hidden tag goes to the scoreboard; only the reply after it is spoken. */
export function Verdict() {
  const tag = useRef<SVGTextElement>(null);
  const reply = useRef<(SVGTextElement | null)[]>([]);
  const speakers = useRef<(SVGGElement | null)[]>([]);
  const toBoard = useRef<SVGPathElement>(null);
  const board = useRef<SVGGElement>(null);
  const shadow = useRef<(SVGGElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % VERDICT_LOOP;
    if (tag.current) tag.current.textContent = typed(TAG, 0.4, 2.2, t);
    toBoard.current?.setAttribute('stroke-dashoffset', (140 * (1 - ease(2.3, 3, t))).toFixed(1));
    rise(board.current, 2.9, t, 0.3);
    REPLY.forEach((line, i) => {
      const el = reply.current[i];
      if (el) el.textContent = typed(line, 3.4 + i * 1.6, 4.6 + i * 1.6, t);
      // The sentence is spoken once it is whole.
      rise(speakers.current[i] ?? null, 4.6 + i * 1.6, t, 0.25);
    });
    shadow.current.forEach((s, i) => rise(s, 8 + i * 0.8, t));
    all.current?.setAttribute('opacity', fadeOut(t, VERDICT_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A model's stream: a verdict inside a tag goes to the scoreboard and is never spoken; the reply after it is spoken sentence by sentence. A shadow grader checks the verdict and logs disagreements.">
      <Frame w={540} h={270} title="The verdict is never voiced" />
      <g ref={all}>
        <rect x="26" y="54" width="352" height="124" rx={12} fill="rgb(4 6 12 / 0.6)" stroke={CREAM} strokeOpacity={0.16} />
        <text x="40" y="74" className="diagram-label" fill={SOFT}>
          One stream
        </text>
        <text ref={tag} x="40" y="98" className="diagram-mono-s" fill={GREY} />
        <line x1="40" x2="364" y1="112" y2="112" stroke={AMBER} strokeDasharray="4 4" strokeOpacity={0.8} />
        <text x="364" y="108" textAnchor="end" className="diagram-tag" fill={AMBER}>
          nothing above this line is spoken
        </text>
        {REPLY.map((_, i) => (
          <text key={i} ref={at(reply, i)} x="40" y={136 + i * 22} className="diagram-note" fill={LIME} />
        ))}
        {REPLY.map((_, i) => (
          <g key={i} ref={at(speakers, i)} opacity={0}>
            <Speaker x={360} y={131 + i * 22} color={LIME} />
          </g>
        ))}
        <path ref={toBoard} d="M 290,96 C 360,90 400,80 430,74" fill="none" stroke={GREY} strokeWidth={1.6} strokeDasharray="140" strokeDashoffset="140" />
        <g ref={board} opacity={0}>
          <rect x="430" y="56" width="84" height="40" rx={10} fill="rgb(4 6 12 / 0.7)" stroke={GREY} />
          <path d="M447,77 l6,6 l12,-13" fill="none" stroke={LIME} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <text x="472" y="81" className="diagram-tag" fill={CREAM}>
            graded
          </text>
        </g>
        <text x="396" y="140" className="diagram-tag" fill={LIME}>
          → the voice
        </text>
        {['Shadow grader agrees', 'Disagrees → logged, credit unchanged', 'No clean verdict? Two calls, as before'].map((s, i) => (
          <g key={s} ref={at(shadow, i)} opacity={0}>
            <circle cx={34} cy={203 + i * 18} r={3} fill={[LIME, AMBER, CYAN][i]} />
            <text x={44} y={207 + i * 18} className="diagram-note">
              {s}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ─── Speaking while thinking ───────────────────────────────────────────────────────── */

const GATE_LOOP = 11;
const SENTS = [
  { text: 'Nice work.', at: 1.2 },
  { text: 'You named both risks.', at: 2.6 },
  { text: 'One thing to try:', at: 4 },
  { text: 'what would you cut?', at: 5.4 },
] as const;
const HELD = { text: 'Or keep it all…', at: 6.6 } as const;
const CHAR = 6.72;
const boxW = (text: string) => text.length * CHAR + 16;
/** Two sentences a row, each after the one before it; the held text follows the last. */
const BOXES = [...SENTS, HELD].map((_, i, list) => {
  const row = Math.min(1, Math.floor(i / 2));
  const before = list.slice(row * 2, i).reduce((x, p) => x + boxW(p.text) + 8, 0);
  return { x: 26 + before, y: 106 + row * 30 };
});

/** Tokens stream in; whole sentences are let through one at a time; audio starts on the first. */
export function SentenceGate() {
  const tokens = useRef<(SVGCircleElement | null)[]>([]);
  const boxes = useRef<(SVGGElement | null)[]>([]);
  const held = useRef<SVGGElement>(null);
  const waves = useRef<(SVGRectElement | null)[]>([]);
  const note = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % GATE_LOOP;
    tokens.current.forEach((d, i) => {
      const u = (time * 0.6 + i / 16) % 1;
      d?.setAttribute('cx', (26 + u * 488).toFixed(1));
      d?.setAttribute('opacity', t < 7.6 ? (0.35 + 0.65 * Math.sin(u * Math.PI)).toFixed(2) : '0.1');
    });
    SENTS.forEach((s, i) => rise(boxes.current[i] ?? null, s.at, t, 0.3));
    rise(held.current, HELD.at, t, 0.3);
    // Each sentence is spoken from the moment it is whole: its stretch of the waveform moves.
    waves.current.forEach((b, j) => {
      const i = Math.min(SENTS.length - 1, Math.floor(j / 10));
      const on = t > SENTS[i]!.at + 0.3 + (j % 10) * 0.1;
      const h = on ? 3 + 11 * Math.abs(Math.sin(time * 8 + j * 1.3)) : 1.5;
      b?.setAttribute('height', h.toFixed(1));
      b?.setAttribute('y', (206 - h / 2).toFixed(1));
      b?.setAttribute('fill', on ? LIME : DIM);
    });
    rise(note.current, 7.8, t);
    all.current?.setAttribute('opacity', fadeOut(t, GATE_LOOP).toFixed(2));
  });
  const last = BOXES[SENTS.length]!;
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Tokens stream in from the model; each whole sentence passes the gate as soon as it is written and is spoken at once, while the model keeps writing. Text after a question is held.">
      <Frame w={540} h={270} title="Speaking while thinking" />
      <g ref={all}>
        <text x="26" y="62" className="diagram-tag" fill={SOFT}>
          tokens, still being written
        </text>
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} ref={at(tokens, i)} cy={76} r={2.6} fill={CREAM} />
        ))}
        <text x="26" y="98" className="diagram-tag" fill={SOFT}>
          whole sentences, let through one at a time
        </text>
        {SENTS.map((s, i) => (
          <g key={s.text} ref={at(boxes, i)} opacity={0}>
            <rect x={BOXES[i]!.x} y={BOXES[i]!.y} width={boxW(s.text)} height={22} rx={8} fill="rgb(185 239 46 / 0.12)" stroke={LIME} strokeOpacity={0.7} />
            <text x={BOXES[i]!.x + 8} y={BOXES[i]!.y + 15} className="diagram-note" fill={CREAM}>
              {s.text}
            </text>
          </g>
        ))}
        <g ref={held} opacity={0}>
          <rect x={last.x} y={last.y} width={boxW(HELD.text)} height={22} rx={8} fill="rgb(255 196 92 / 0.1)" stroke={AMBER} strokeDasharray="4 3" />
          <text x={last.x + 8} y={last.y + 15} className="diagram-note" fill={AMBER}>
            {HELD.text}
          </text>
          <text x={last.x} y={last.y + 36} className="diagram-tag" fill={AMBER}>
            after a question: held, to see if it should stop
          </text>
        </g>
        <text x="26" y="194" className="diagram-tag" fill={SOFT}>
          audio
        </text>
        {Array.from({ length: SENTS.length * 10 }, (_, j) => (
          <rect key={j} ref={at(waves, j)} x={66 + j * 11.2} y={205} width={5} height={1.5} rx={2.5} fill={DIM} />
        ))}
        <g ref={note} opacity={0}>
          <text x="26" y="244" className="diagram-note">
            Words already spoken are never rewritten, and never sent twice.
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── Seeing the screen ─────────────────────────────────────────────────────────────── */

const FRAME_LOOP = 11;
const SHOTS = [
  { hash: 'a41f', cell: 0, dup: false },
  { hash: 'a41f', cell: 0, dup: true },
  { hash: 'a41f', cell: 0, dup: true },
  { hash: '9c07', cell: 4, dup: false },
  { hash: '9c07', cell: 4, dup: true },
  { hash: 'e2b8', cell: 7, dup: false },
  { hash: 'e2b8', cell: 7, dup: true },
  { hash: 'e2b8', cell: 7, dup: true },
] as const;

/** A frame a second, each fingerprinted: a changed one is sent, a repeat is not. */
export function FrameGate() {
  const shots = useRef<(SVGGElement | null)[]>([]);
  const marks = useRef<(SVGTextElement | null)[]>([]);
  const sent = useRef<SVGTextElement>(null);
  const skipped = useRef<SVGTextElement>(null);
  const notes = useRef<(SVGGElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % FRAME_LOOP;
    let s = 0;
    let k = 0;
    SHOTS.forEach((shot, i) => {
      const a = 0.4 + i * 0.9;
      rise(shots.current[i] ?? null, a, t, 0.25);
      const decided = t > a + 0.45;
      const m = marks.current[i];
      if (m) {
        m.textContent = decided ? (shot.dup ? 'same' : 'sent') : '';
        m.setAttribute('fill', shot.dup ? SOFT : LIME);
      }
      shots.current[i]?.setAttribute('opacity', (Number(shots.current[i]?.getAttribute('opacity') ?? 0) * (decided && shot.dup ? 0.45 : 1)).toFixed(2));
      if (decided) {
        if (shot.dup) k++;
        else s++;
      }
    });
    if (sent.current) sent.current.textContent = String(s);
    if (skipped.current) skipped.current.textContent = String(k);
    notes.current.forEach((n, i) => rise(n, 7.8 + i * 0.7, t));
    all.current?.setAttribute('opacity', fadeOut(t, FRAME_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Screen frames arrive once a second, each with a fingerprint; a changed frame is sent to the model, a repeat is not. One changed pixel is a new frame, with no debounce or delay.">
      <Frame w={540} h={270} title="Seeing the screen" />
      <g ref={all}>
        {SHOTS.map((shot, i) => {
          const x = 26 + i * 62;
          return (
            <g key={i} ref={at(shots, i)} opacity={0}>
              <rect x={x} y={60} width={54} height={38} rx={5} fill="rgb(4 6 12 / 0.7)" stroke={shot.dup ? CREAM : LIME} strokeOpacity={shot.dup ? 0.25 : 0.8} />
              {Array.from({ length: 9 }, (_, c) => (
                <rect key={c} x={x + 6 + (c % 3) * 15} y={66 + Math.floor(c / 3) * 9} width={12} height={6} rx={1.5} fill={c === shot.cell ? CYAN : 'rgb(246 241 234 / 0.25)'} />
              ))}
              <text x={x + 27} y={114} textAnchor="middle" className="diagram-mono-s" fill={SOFT}>
                {shot.hash}
              </text>
              <text ref={at(marks, i)} x={x + 27} y={130} textAnchor="middle" className="diagram-tag" />
            </g>
          );
        })}
        <text x="26" y="166" className="diagram-tag" fill={SOFT}>
          a frame every second, fingerprinted in full
        </text>
        <text x="26" y="196" className="diagram-big-s" fill={LIME} ref={sent}>
          0
        </text>
        <text x="50" y="196" className="diagram-note">
          sent
        </text>
        <text x="110" y="196" className="diagram-big-s" fill={SOFT} ref={skipped}>
          0
        </text>
        <text x="134" y="196" className="diagram-note">
          not sent again
        </text>
        {['One changed pixel is a new frame. No debounce, no delay.', 'Counted as sent only once the push has gone through.'].map((n, i) => (
          <g key={n} ref={at(notes, i)} opacity={0}>
            <text x="26" y={228 + i * 18} className="diagram-note" fill={i ? CYAN : CREAM}>
              {n}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ─── Teach, then check ─────────────────────────────────────────────────────────────── */

const TEACH_LOOP = 13;
const CHAT = [
  { who: 'learner', at: 0.4, lines: ['I don’t get the funnel part.'] },
  { who: 'manager', at: 1.8, lines: ['A funnel counts people at each step.', 'Most drop between sign-up and paying.'] },
  { who: 'manager', at: 3.6, lines: ['So where would you look first?'] },
  { who: 'learner', at: 5.2, lines: ['Between sign-up and paying.'] },
] as const;
/** Stuck turns that got a full explanation, of 40: without it, as a system-prompt block, and in the turn. */
const TAUGHT = [
  { label: 'without it', n: 6, about: false, color: CREAM },
  { label: 'in the system prompt', n: 14, about: true, color: AMBER },
  { label: 'in the turn’s instruction', n: 28, about: false, color: LIME },
] as const;
/** Where each bubble sits: learners on the left, the manager on the right, stacked down. */
const BUBBLES = CHAT.map((m, i) => {
  const w = Math.max(...m.lines.map((l) => l.length)) * 6.72 + 22;
  const h = 12 + m.lines.length * 15;
  const y = 56 + CHAT.slice(0, i).reduce((sum, p) => sum + 12 + p.lines.length * 15 + 8, 0);
  return { x: m.who === 'learner' ? 26 : 300 - w, y, w, h };
});

/** A stuck learner is taught the point, then asked one question that uses it; and the measure. */
export function Teach() {
  const bubbles = useRef<(SVGGElement | null)[]>([]);
  const tick = useRef<SVGGElement>(null);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const counts = useRef<(SVGTextElement | null)[]>([]);
  const cap = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % TEACH_LOOP;
    CHAT.forEach((m, i) => rise(bubbles.current[i] ?? null, m.at, t, 0.3));
    rise(tick.current, 6.2, t, 0.3);
    TAUGHT.forEach((row, i) => {
      const k = ease(6.6 + i * 0.6, 7.6 + i * 0.6, t);
      bars.current[i]?.setAttribute('width', ((row.n / 40) * 120 * k).toFixed(1));
      const c = counts.current[i];
      if (c) c.textContent = k > 0.02 ? `${row.about ? '~' : ''}${Math.round(row.n * k)}` : '';
    });
    rise(cap.current, 9.4, t);
    all.current?.setAttribute('opacity', fadeOut(t, TEACH_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A stuck learner is taught what a funnel counts, then asked where they would look first, and answers. Full explanations: 6 of 40 stuck turns without the instruction, about 14 as a system-prompt block, 28 in the turn's own instruction. After 15 messages, one offer to move on.">
      <Frame w={540} h={270} title="Teach, then check" />
      <g ref={all}>
        {CHAT.map((m, i) => {
          const { x, y, w, h } = BUBBLES[i]!;
          return (
            <g key={i} ref={at(bubbles, i)} opacity={0}>
              <rect x={x} y={y} width={w} height={h} rx={10} fill={m.who === 'learner' ? VIOLET : LIME} fillOpacity={0.9} />
              {m.lines.map((line, k) => (
                <text key={line} x={x + 11} y={y + 18 + k * 15} className="diagram-note" fill={INK}>
                  {line}
                </text>
              ))}
            </g>
          );
        })}
        <g ref={tick} opacity={0}>
          <path d="M276,203 l6,6 l12,-13" fill="none" stroke={LIME} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x="326" y="66" className="diagram-label" fill={SOFT}>
          Stuck turns taught, of 40
        </text>
        {TAUGHT.map((row, i) => (
          <g key={row.label}>
            <text x="326" y={90 + i * 40} className="diagram-tag" fill={SOFT}>
              {row.label}
            </text>
            <rect x="326" y={96 + i * 40} width={120} height={10} rx={5} fill={DIM} />
            <rect ref={at(bars, i)} x="326" y={96 + i * 40} width={0} height={10} rx={5} fill={row.color} />
            <text ref={at(counts, i)} x="456" y={106 + i * 40} className="diagram-big-s" fill={row.color} />
          </g>
        ))}
        <g ref={cap} opacity={0}>
          <text x="326" y="226" className="diagram-note">
            After 15 messages:
          </text>
          <text x="326" y="244" className="diagram-note" fill={LIME}>
            one offer to move on.
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── The stack ─────────────────────────────────────────────────────────────────────── */

const STACK_LOOP = 9;
const HOPS = [
  { name: 'Listen', tech: 'LiveKit · WebRTC' },
  { name: 'Transcribe', tech: 'Deepgram' },
  { name: 'Think', tech: 'Claude · Gemini' },
  { name: 'Speak', tech: 'ElevenLabs' },
  { name: 'Avatar', tech: 'Tavus · HeyGen' },
] as const;

/** A turn travels the stack; every hop it passes is metered and traced. */
export function VoiceStack() {
  const packet = useRef<SVGCircleElement>(null);
  const nodes = useRef<(SVGCircleElement | null)[]>([]);
  const ticks = useRef<(SVGGElement | null)[]>([]);
  const stat = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  const hx = (k: number) => 66 + k * 102;
  useClock((time) => {
    const t = time % STACK_LOOP;
    const u = Math.min(HOPS.length - 1, Math.max(0, (t - 0.5) / 1.1));
    packet.current?.setAttribute('cx', (hx(0) + u * 102).toFixed(1));
    packet.current?.setAttribute('opacity', t > 0.5 && t < 0.5 + 1.1 * (HOPS.length - 1) + 0.4 ? '1' : '0');
    HOPS.forEach((_, k) => {
      const reached = t > 0.5 + k * 1.1;
      nodes.current[k]?.setAttribute('fill', reached ? LIME : 'rgb(4 6 12 / 0.7)');
      rise(ticks.current[k] ?? null, 0.7 + k * 1.1, t, 0.3);
    });
    rise(stat.current, 6.6, t);
    all.current?.setAttribute('opacity', fadeOut(t, STACK_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="The voice stack: listen with LiveKit and WebRTC, transcribe with Deepgram, think with Claude and Gemini, speak with ElevenLabs, and the avatar with Tavus and HeyGen. Every hop is metered and traced. Student engagement up 340%.">
      <Frame w={540} h={270} title="The stack" />
      <g ref={all}>
        <line x1={hx(0)} x2={hx(HOPS.length - 1)} y1={92} y2={92} stroke={LIME} strokeOpacity={0.3} strokeWidth={2} />
        {HOPS.map((h, k) => (
          <g key={h.name}>
            <circle ref={at(nodes, k)} cx={hx(k)} cy={92} r={11} fill="rgb(4 6 12 / 0.7)" stroke={LIME} strokeWidth={1.6} />
            <text x={hx(k)} y={70} textAnchor="middle" className="diagram-label">
              {h.name}
            </text>
            <text x={hx(k)} y={122} textAnchor="middle" className="diagram-tag" fill={CREAM}>
              {h.tech}
            </text>
            <g ref={at(ticks, k)} opacity={0}>
              {['metered', 'traced'].map((m, j) => (
                <g key={m}>
                  <path d={`M${hx(k) - 26},${142 + j * 16} l3,3 l6,-7`} fill="none" stroke={j ? CYAN : LIME} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <text x={hx(k) - 13} y={146 + j * 16} className="diagram-tag" fill={SOFT}>
                    {m}
                  </text>
                </g>
              ))}
            </g>
          </g>
        ))}
        <circle ref={packet} cx={hx(0)} cy={92} r={5} fill={CYAN} opacity={0} />
        <g ref={stat} opacity={0}>
          <text x="26" y="222" className="diagram-big" fill={LIME}>
            +340%
          </text>
          <text x="128" y="214" className="diagram-note">
            student engagement, with live
          </text>
          <text x="128" y="230" className="diagram-note">
            tutoring agents on LiveKit
          </text>
        </g>
      </g>
    </svg>
  );
}

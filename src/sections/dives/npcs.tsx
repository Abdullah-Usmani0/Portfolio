/**
 * The NPCs dive's boards: one manager on every surface, four voices, a voice written as a
 * disposition, one manager per scenario, the check-in gate, and the studio's pipeline.
 */
import { useRef } from 'react';
import { AMBER, CREAM, CYAN, LIME, RED, VIOLET } from './colors.ts';
import { ease, fadeOut, Frame, typed, useClock } from './svg.tsx';

const INK = '#16131c';
const SOFT = 'rgb(246 241 234 / 0.6)';
const SKIN = '#efd9c3';

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

/** A small face: the manager wears a lime scarf. */
const Face = ({ x, y, r, scarf = LIME }: { x: number; y: number; r: number; scarf?: string }) => (
  <g>
    <path d={`M${x - r * 1.5},${y + r * 2.3} C${x - r * 1.5},${y + r * 0.9} ${x + r * 1.5},${y + r * 0.9} ${x + r * 1.5},${y + r * 2.3} Z`} fill={scarf} />
    <circle cx={x} cy={y} r={r} fill={SKIN} />
    <path d={`M${x - r},${y - r * 0.15} A${r},${r} 0 0 1 ${x + r},${y - r * 0.15} Q${x},${y - r * 0.55} ${x - r},${y - r * 0.15} Z`} fill="#4a3428" />
  </g>
);

/* ─── One person, everywhere ────────────────────────────────────────────────────────── */

const EVERY_LOOP = 12;
const SURFACES = [
  { name: 'Chat', line: 'Where are you stuck?' },
  { name: 'Plan mode', line: 'Three parts, one page.' },
  { name: 'Kickoff', line: 'Welcome to the team!' },
  { name: 'Feedback', line: 'Good start. Tighten it.' },
  { name: 'Check-in', line: 'Need a hand, Sam?' },
  { name: 'Live call', line: 'Can you hear me okay?' },
] as const;
const CENTRE = { x: 270, y: 112 };

/** One voice block lights every surface in turn, and each says its line in the same voice. */
export function Everywhere() {
  const wires = useRef<(SVGLineElement | null)[]>([]);
  const sparks = useRef<(SVGCircleElement | null)[]>([]);
  const lines = useRef<(SVGTextElement | null)[]>([]);
  const tiles = useRef<(SVGRectElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % EVERY_LOOP;
    SURFACES.forEach((s, i) => {
      const a = 1 + i * 1.1;
      const u = ease(a, a + 0.6, t);
      const { x, y } = tileAt(i);
      const ex = i < 3 ? x + 176 : x;
      const ey = y + 23;
      const spark = sparks.current[i];
      spark?.setAttribute('cx', (CENTRE.x + (ex - CENTRE.x) * u).toFixed(1));
      spark?.setAttribute('cy', (CENTRE.y + (ey - CENTRE.y) * u).toFixed(1));
      spark?.setAttribute('opacity', u > 0.02 && u < 0.98 ? '1' : '0');
      wires.current[i]?.setAttribute('stroke-opacity', (0.12 + 0.5 * ease(a + 0.5, a + 0.7, t)).toFixed(2));
      tiles.current[i]?.setAttribute('stroke-opacity', (0.2 + 0.6 * ease(a + 0.5, a + 0.7, t)).toFixed(2));
      const el = lines.current[i];
      if (el) el.textContent = typed(s.line, a + 0.6, a + 1.4, t);
    });
    all.current?.setAttribute('opacity', fadeOut(t, EVERY_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="One manager, one voice block, six surfaces: chat, plan mode, the kickoff, feedback, check-ins and live calls each say their line in the same voice.">
      <Frame w={540} h={270} title="One person, everywhere" />
      <g ref={all}>
        {SURFACES.map((s, i) => {
          const { x, y } = tileAt(i);
          return (
            <g key={s.name}>
              <line ref={at(wires, i)} x1={CENTRE.x} y1={CENTRE.y} x2={i < 3 ? x + 176 : x} y2={y + 23} stroke={LIME} strokeOpacity={0.12} strokeWidth={1.4} />
              <rect ref={at(tiles, i)} x={x} y={y} width={176} height={46} rx={10} fill="rgb(4 6 12 / 0.6)" stroke={LIME} strokeOpacity={0.2} />
              <text x={x + 12} y={y + 18} className="diagram-label">
                {s.name}
              </text>
              <text ref={at(lines, i)} x={x + 12} y={y + 35} className="diagram-note" fill={CREAM} />
              <circle ref={at(sparks, i)} r={3} fill={LIME} opacity={0} />
            </g>
          );
        })}
        <circle cx={CENTRE.x} cy={CENTRE.y} r={30} fill="rgb(4 6 12 / 0.8)" stroke={LIME} strokeWidth={1.6} />
        <g clipPath="url(#npc-everywhere-face)">
          <Face x={CENTRE.x} y={CENTRE.y - 4} r={11} />
        </g>
        <clipPath id="npc-everywhere-face">
          <circle cx={CENTRE.x} cy={CENTRE.y} r={29} />
        </clipPath>
        <text x={CENTRE.x} y={CENTRE.y + 50} textAnchor="middle" className="diagram-label" fill={LIME}>
          The manager
        </text>
        <rect x={CENTRE.x - 56} y={CENTRE.y + 60} width={112} height={20} rx={10} fill="rgb(185 239 46 / 0.12)" stroke={LIME} strokeOpacity={0.6} />
        <text x={CENTRE.x} y={CENTRE.y + 74} textAnchor="middle" className="diagram-tag" fill={LIME}>
          one voice block
        </text>
        <text x="26" y="250" className="diagram-note">
          Written once, read by every surface.
        </text>
      </g>
    </svg>
  );
}
function tileAt(i: number) {
  return { x: i < 3 ? 26 : 338, y: 52 + (i % 3) * 58 };
}

/* ─── Four ways to talk ─────────────────────────────────────────────────────────────── */

const VOICES_LOOP = 12;
const VOICES = [
  { style: 'Dry and clipped', color: '#e2a46b', lines: ['Good. Send it over.'], tag: 'dry · “noted.”' },
  { style: 'Warm and hypey', color: '#7fa9d6', lines: ['YES!! Can’t wait', 'to see it!'], tag: 'playful · “love this”' },
  { style: 'Chill, thinks aloud', color: '#c97b8e', lines: ['nice… let me look.', 'maybe tweak the intro?'], tag: 'easygoing · “hmm, okay”' },
  { style: 'Proper but human', color: '#8fbf7a', lines: ['Thank you, Sam. I’ll', 'review it this afternoon.'], tag: 'gentle · “thanks for this”' },
] as const;

/** One message from a learner, and the same reply in each of the four voices. */
export function FourVoices() {
  const ask = useRef<SVGGElement>(null);
  const cards = useRef<(SVGGElement | null)[]>([]);
  const lines = useRef<(SVGTextElement | null)[]>([]);
  const note = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % VOICES_LOOP;
    rise(ask.current, 0.3, t);
    VOICES.forEach((v, i) => {
      const a = 1.4 + i * 1.6;
      rise(cards.current[i] ?? null, a, t, 0.3);
      v.lines.forEach((line, k) => {
        const el = lines.current[i * 2 + k];
        if (el) el.textContent = typed(line, a + 0.3 + k * 0.5, a + 0.8 + k * 0.5, t);
      });
    });
    rise(note.current, 8.4, t);
    all.current?.setAttribute('opacity', fadeOut(t, VOICES_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A learner says they finished the deck; four characters reply, dry and clipped, warm and hypey, chill and thinking aloud, and proper but human. A style is picked once per person and never overwrites one written by hand.">
      <Frame w={540} h={270} title="Four ways to talk" />
      <g ref={all}>
        <g ref={ask} opacity={0}>
          <rect x={344} y={22} width={170} height={24} rx={12} fill={VIOLET} fillOpacity={0.9} />
          <text x={429} y={38} textAnchor="middle" className="diagram-note" fill={INK}>
            I finished the deck.
          </text>
        </g>
        {VOICES.map((v, i) => {
          const x = 26 + (i % 2) * 248;
          const y = 56 + Math.floor(i / 2) * 88;
          return (
            <g key={v.style} ref={at(cards, i)} opacity={0}>
              <rect x={x} y={y} width={240} height={80} rx={12} fill="rgb(4 6 12 / 0.6)" stroke={v.color} strokeOpacity={0.5} />
              <circle cx={x + 18} cy={y + 18} r={5} fill={v.color} />
              <text x={x + 30} y={y + 22} className="diagram-label" fill={v.color}>
                {v.style}
              </text>
              {[0, 1].map((k) => (
                <text key={k} ref={at(lines, i * 2 + k)} x={x + 14} y={y + 42 + k * 15} className="diagram-note" fill={CREAM} />
              ))}
              <text x={x + 14} y={y + 72} className="diagram-tag" fill={SOFT}>
                {v.tag}
              </text>
            </g>
          );
        })}
        <g ref={note} opacity={0}>
          <text x="26" y="250" className="diagram-note">
            Picked once per person. Never over one written by hand.
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── Voice as a disposition ────────────────────────────────────────────────────────── */

const DISP_LOOP = 13;
const FIELDS = ['Vocabulary: casual', 'Pace: fast', 'Humour: sarcastic', 'Formality: low'] as const;
const LIVED = ['You keep things short.', 'You open with the point.', 'Your humour is dry.', 'You say “noted.” a lot.'] as const;
const STACK = ['Who they are', 'The task', 'The rules', 'How you talk', 'The turn'] as const;
const VOICE_SLOT = 3;

/** A list of fields is struck out; a disposition is written; the voice takes its place near the end. */
export function Disposition() {
  const fields = useRef<(SVGGElement | null)[]>([]);
  const strikes = useRef<(SVGLineElement | null)[]>([]);
  const lived = useRef<(SVGTextElement | null)[]>([]);
  const stack = useRef<SVGGElement>(null);
  const chip = useRef<SVGGElement>(null);
  const wrong = useRef<SVGGElement>(null);
  const stat = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  const slotX = (k: number) => 26 + k * 98;
  useClock((time) => {
    const t = time % DISP_LOOP;
    fields.current.forEach((f, i) => rise(f, 0.3 + i * 0.3, t, 0.3));
    strikes.current.forEach((s, i) => s?.setAttribute('x2', (38 + (FIELDS[i]!.length * 5.7 + 4) * ease(2.2 + i * 0.15, 2.6 + i * 0.15, t)).toFixed(1)));
    LIVED.forEach((line, i) => {
      const el = lived.current[i];
      if (el) el.textContent = typed(line, 3 + i * 0.7, 3.6 + i * 0.7, t);
    });
    rise(stack.current, 6.2, t);
    // The voice first tries the front of the prompt (struck out), then settles into its slot.
    const tryFront = ease(6.8, 7.2, t) * (1 - ease(8.2, 8.5, t));
    wrong.current?.setAttribute('opacity', tryFront.toFixed(2));
    const move = ease(8.4, 9.4, t);
    chip.current?.setAttribute('opacity', ease(6.8, 7.1, t).toFixed(2));
    chip.current?.setAttribute('transform', `translate(${(slotX(0) + (slotX(VOICE_SLOT) - slotX(0)) * move).toFixed(1)} 0)`);
    rise(stat.current, 9.8, t);
    all.current?.setAttribute('opacity', fadeOut(t, DISP_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A list of voice fields is struck out and rewritten as a disposition: you keep things short, your humour is dry. The voice goes inside 'how you talk', near the end of the prompt; one block moved to the front took defects per submission from 1.45 to 2.66.">
      <Frame w={540} h={270} title="Voice as a disposition" />
      <g ref={all}>
        <text x="26" y="66" className="diagram-label" fill={SOFT}>
          A list of fields
        </text>
        {FIELDS.map((f, i) => (
          <g key={f} ref={at(fields, i)} opacity={0}>
            <text x="40" y={90 + i * 20} className="diagram-mono-s" fill={CREAM}>
              {f}
            </text>
            <line ref={at(strikes, i)} x1={38} x2={38} y1={87 + i * 20} y2={87 + i * 20} stroke={RED} strokeWidth={1.4} />
          </g>
        ))}
        <text x="282" y="66" className="diagram-label" fill={LIME}>
          A disposition
        </text>
        {LIVED.map((_, i) => (
          <text key={i} ref={at(lived, i)} x="296" y={90 + i * 20} className="diagram-note" fill={CREAM} />
        ))}
        <g ref={stack} opacity={0}>
          {STACK.map((s, k) => (
            <g key={s}>
              <rect x={slotX(k)} y={182} width={90} height={22} rx={6} fill={k === VOICE_SLOT ? 'rgb(185 239 46 / 0.1)' : 'rgb(4 6 12 / 0.55)'} stroke={k === VOICE_SLOT ? LIME : CREAM} strokeOpacity={k === VOICE_SLOT ? 0.6 : 0.2} />
              <text x={slotX(k) + 45} y={197} textAnchor="middle" className="diagram-tag" fill={k === VOICE_SLOT ? LIME : SOFT}>
                {s}
              </text>
            </g>
          ))}
          <text x="26" y="176" className="diagram-tag" fill={SOFT}>
            first
          </text>
          <text x="514" y="176" textAnchor="end" className="diagram-tag" fill={SOFT}>
            last
          </text>
        </g>
        <g ref={wrong} opacity={0}>
          <line x1={slotX(0) + 4} x2={slotX(0) + 86} y1={222} y2={210} stroke={RED} strokeWidth={1.6} />
        </g>
        <g ref={chip} opacity={0}>
          <rect x={4} y={208} width={82} height={18} rx={9} fill={LIME} />
          <text x={45} y={221} textAnchor="middle" className="diagram-tag" fill={INK}>
            the voice
          </text>
        </g>
        <g ref={stat} opacity={0}>
          <text x="26" y="252" className="diagram-note">
            One block moved to the front: defects per submission
          </text>
          <text x="400" y="253" className="diagram-big-s" fill={AMBER}>
            1.45 → 2.66
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ─── One scenario, one manager ─────────────────────────────────────────────────────── */

const ONE_LOOP = 12;
const OBJECTIVES = [110, 270, 430] as const;
const STAGE_DX = [-30, 30] as const;
/** The stage that arrives with no face, until it is filled in. */
const FACELESS = 3;

/** A scenario's tree: the same face on the brief, the team, every objective and stage; a missing one is filled. */
export function OneManager() {
  const faces = useRef<(SVGGElement | null)[]>([]);
  const empty = useRef<SVGCircleElement>(null);
  const pulse = useRef<SVGCircleElement>(null);
  const notes = useRef<(SVGGElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % ONE_LOOP;
    faces.current.forEach((f, i) => {
      if (i === 1 + OBJECTIVES.length + FACELESS) rise(f, 5.6, t, 0.3);
      else rise(f, 0.4 + i * 0.22, t, 0.25);
    });
    empty.current?.setAttribute('opacity', (ease(2.2, 2.5, t) * (1 - ease(5.4, 5.7, t))).toFixed(2));
    const p = ease(4.2, 5.6, t);
    pulse.current?.setAttribute('r', (8 + 240 * p).toFixed(1));
    pulse.current?.setAttribute('stroke-opacity', (p > 0 && p < 1 ? 0.7 * (1 - p) : 0).toFixed(2));
    notes.current.forEach((n, i) => rise(n, 6.4 + i * 0.9, t));
    all.current?.setAttribute('opacity', fadeOut(t, ONE_LOOP).toFixed(2));
  });
  const stageX = (o: number, s: number) => OBJECTIVES[o]! + STAGE_DX[s]!;
  let face = 0;
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A scenario's brief, team, three objectives and six stages all show the same manager. One stage arrives without a face; a check fills it in before it is saved.">
      <Frame w={540} h={270} title="One scenario, one manager" />
      <g ref={all}>
        <circle ref={pulse} cx={270} cy={70} r={8} fill="none" stroke={LIME} strokeWidth={2} strokeOpacity={0} />
        {OBJECTIVES.map((x) => (
          <g key={x}>
            <line x1={270} y1={84} x2={x} y2={118} stroke={CREAM} strokeOpacity={0.2} />
            {STAGE_DX.map((dx) => (
              <line key={dx} x1={x} y1={142} x2={x + dx} y2={172} stroke={CREAM} strokeOpacity={0.2} />
            ))}
          </g>
        ))}
        <rect x={196} y={54} width={148} height={30} rx={10} fill="rgb(4 6 12 / 0.7)" stroke={LIME} strokeOpacity={0.5} />
        <text x={212} y={74} className="diagram-label">
          Brief · team
        </text>
        <g ref={at(faces, face++)} opacity={0}>
          <Face x={322} y={66} r={6} />
        </g>
        {OBJECTIVES.map((x, o) => (
          <g key={x}>
            <rect x={x - 46} y={118} width={92} height={24} rx={8} fill="rgb(4 6 12 / 0.65)" stroke={CREAM} strokeOpacity={0.25} />
            <text x={x - 36} y={134} className="diagram-tag" fill={CREAM}>
              Objective {o + 1}
            </text>
            <g ref={at(faces, face++)} opacity={0}>
              <Face x={x + 34} y={127} r={5} />
            </g>
          </g>
        ))}
        {OBJECTIVES.map((_, o) =>
          STAGE_DX.map((__, s) => {
            const x = stageX(o, s);
            const k = o * 2 + s;
            return (
              <g key={k}>
                <rect x={x - 24} y={172} width={48} height={30} rx={8} fill="rgb(4 6 12 / 0.65)" stroke={CREAM} strokeOpacity={0.25} />
                <text x={x - 16} y={191} className="diagram-tag" fill={SOFT}>
                  S{s + 1}
                </text>
                {k === FACELESS && <circle ref={empty} cx={x + 10} cy={185} r={6} fill="none" stroke={AMBER} strokeDasharray="2 2" strokeWidth={1.4} opacity={0} />}
                <g ref={at(faces, 1 + OBJECTIVES.length + k)} opacity={0}>
                  <Face x={x + 10} y={182} r={5} />
                </g>
              </g>
            );
          }),
        )}
        {['A missing face is filled in before saving.', 'An existing lead always wins.'].map((n, i) => (
          <g key={n} ref={at(notes, i)} opacity={0}>
            <text x={26} y={230 + i * 18} className="diagram-note" fill={i === 0 ? LIME : CREAM}>
              {n}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ─── Check-ins that respect you ────────────────────────────────────────────────────── */

const NUDGE_LOOP = 12;
const CHECKS = ['Kickoff finished', 'In the stage a while', 'Quiet a while', 'Not nudged lately'] as const;
/** Two learners: everything passes for the first; the second is still in the kickoff. */
const CASES = [
  { who: 'Learner A, stage 2', start: 0.4, pass: [true, true, true, true] },
  { who: 'Learner B, in the kickoff', start: 6.4, pass: [false, null, null, null] },
] as const;

/** The gate: every check must pass before the bell rings; one no, or one unknown, holds. */
export function NudgeGate() {
  const who = useRef<SVGTextElement>(null);
  const marks = useRef<(SVGTextElement | null)[]>([]);
  const rows = useRef<(SVGRectElement | null)[]>([]);
  const bell = useRef<SVGGElement>(null);
  const verdict = useRef<SVGTextElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % NUDGE_LOOP;
    const c = t < CASES[1].start ? CASES[0] : CASES[1];
    const local = t - c.start;
    if (who.current) who.current.textContent = c.who;
    CHECKS.forEach((_, i) => {
      const result = c.pass[i];
      const shown = local > 0.8 + i * 0.9;
      const mark = marks.current[i];
      if (mark) {
        mark.textContent = !shown ? '' : result === true ? '✓' : result === false ? '✗' : '·';
        mark.setAttribute('fill', result === true ? LIME : result === false ? AMBER : SOFT);
      }
      rows.current[i]?.setAttribute('stroke-opacity', shown ? (result === null ? '0.15' : '0.55') : '0.15');
      rows.current[i]?.setAttribute('stroke', result === true ? LIME : result === false ? AMBER : CREAM);
    });
    const decided = c === CASES[0] ? local > 4.6 : local > 1.8;
    const ring = c === CASES[0] && decided ? Math.sin(time * 26) * 18 * Math.max(0, 1 - (local - 4.6) / 1.4) : 0;
    bell.current?.setAttribute('transform', `rotate(${ring.toFixed(1)} 430 92)`);
    bell.current?.setAttribute('opacity', decided ? '1' : '0.35');
    if (verdict.current) {
      verdict.current.textContent = !decided ? 'checking…' : c === CASES[0] ? 'Check in' : 'Hold';
      verdict.current.setAttribute('fill', !decided ? SOFT : c === CASES[0] ? LIME : AMBER);
    }
    all.current?.setAttribute('opacity', fadeOut(t, NUDGE_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Before a check-in, four gates: the kickoff is finished, the learner has been in the stage a while, it has been quiet a while, and nobody nudged them lately. All pass: the bell rings. A learner still in the kickoff: hold.">
      <Frame w={540} h={270} title="Check-ins that respect you" />
      <g ref={all}>
        <text ref={who} x="26" y="68" className="diagram-label" fill={CREAM} />
        {CHECKS.map((c, i) => (
          <g key={c}>
            <rect ref={at(rows, i)} x={26} y={80 + i * 34} width={300} height={26} rx={8} fill="rgb(4 6 12 / 0.55)" stroke={CREAM} strokeOpacity={0.15} />
            <text x={42} y={97 + i * 34} className="diagram-note" fill={CREAM}>
              {c}
            </text>
            <text ref={at(marks, i)} x={306} y={98 + i * 34} textAnchor="middle" className="diagram-big-s" />
          </g>
        ))}
        <g ref={bell} opacity={0.35}>
          <path d="M430,92 v6 M412,138 C412,112 418,100 430,100 C442,100 448,112 448,138 Z" fill={AMBER} stroke={AMBER} strokeWidth={2} strokeLinejoin="round" />
          <rect x={406} y={136} width={48} height={6} rx={3} fill={AMBER} />
          <circle cx={430} cy={146} r={4} fill={AMBER} />
        </g>
        <text ref={verdict} x="430" y="180" textAnchor="middle" className="diagram-big-s" fill={SOFT} />
        <text x="26" y="244" className="diagram-note">
          Can’t tell? That counts as a no.
        </text>
        <text x="514" y="244" textAnchor="end" className="diagram-tag" fill={CYAN}>
          then a cooldown
        </text>
      </g>
    </svg>
  );
}

/* ─── Faces and voices ──────────────────────────────────────────────────────────────── */

const FACE_LOOP = 12;
const PIPE = ['Portrait', 'Voice', 'Sheet', 'Keyframes', 'Shots', 'Lip-sync'] as const;

/** The studio's pipeline lights stage by stage while a character takes shape below it. */
export function FacePipe() {
  const nodes = useRef<(SVGCircleElement | null)[]>([]);
  const links = useRef<(SVGLineElement | null)[]>([]);
  const portrait = useRef<SVGGElement>(null);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const sheet = useRef<SVGGElement>(null);
  const film = useRef<SVGGElement>(null);
  const mouth = useRef<SVGEllipseElement>(null);
  const note = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  const lit = (k: number, t: number) => ease(0.6 + k * 1.1, 0.9 + k * 1.1, t);
  useClock((time) => {
    const t = time % FACE_LOOP;
    PIPE.forEach((_, k) => {
      const v = lit(k, t);
      nodes.current[k]?.setAttribute('fill', v > 0.5 ? LIME : 'rgb(4 6 12 / 0.7)');
      links.current[k]?.setAttribute('stroke-opacity', (0.15 + 0.6 * lit(k + 1, t)).toFixed(2));
    });
    rise(portrait.current, 0.7, t);
    // The voice: bars that move once the voice is made.
    bars.current.forEach((b, i) => {
      const h = lit(1, t) * (4 + 10 * Math.abs(Math.sin(time * 5 + i * 1.3)));
      b?.setAttribute('height', h.toFixed(1));
      b?.setAttribute('y', (200 - h / 2).toFixed(1));
    });
    rise(sheet.current, 2.9, t);
    rise(film.current, 4, t);
    // Lip-sync: the mouth moves with the voice.
    mouth.current?.setAttribute('ry', (1 + 3 * lit(5, t) * Math.abs(Math.sin(time * 9))).toFixed(1));
    rise(note.current, 7.4, t);
    all.current?.setAttribute('opacity', fadeOut(t, FACE_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="The studio's pipeline: portrait, voice, character sheet, keyframes, video shots and lip-sync, each stage tracked, while a character takes shape.">
      <Frame w={540} h={270} title="Faces and voices" />
      <g ref={all}>
        {PIPE.map((p, k) => {
          const x = 52 + k * 87;
          return (
            <g key={p}>
              {k < PIPE.length - 1 && <line ref={at(links, k)} x1={x + 12} x2={x + 75} y1={78} y2={78} stroke={LIME} strokeOpacity={0.15} strokeWidth={2} />}
              <circle ref={at(nodes, k)} cx={x} cy={78} r={10} fill="rgb(4 6 12 / 0.7)" stroke={LIME} strokeWidth={1.6} />
              <text x={x} y={106} textAnchor="middle" className="diagram-tag" fill={CREAM}>
                {p}
              </text>
            </g>
          );
        })}
        <g ref={portrait} opacity={0}>
          <rect x={40} y={128} width={92} height={104} rx={10} fill="#2a2433" stroke={LIME} strokeOpacity={0.6} />
          <Face x={86} y={174} r={20} />
          <ellipse ref={mouth} cx={86} cy={184} rx={5} ry={1} fill="#8a3b33" />
        </g>
        <text x="152" y="146" className="diagram-tag" fill={SOFT}>
          voice
        </text>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} ref={at(bars, i)} x={152 + i * 7} y={196} width={4} height={4} rx={2} fill={VIOLET} />
        ))}
        <g ref={sheet} opacity={0}>
          <text x="264" y="146" className="diagram-tag" fill={SOFT}>
            character sheet
          </text>
          {[0, 1, 2].map((k) => (
            <g key={k} transform={`translate(${276 + k * 34} 176) scale(${k === 1 ? -1 : 1} 1)`}>
              <circle cy={-14} r={7} fill={SKIN} />
              <path d="M-10,16 C-10,-2 10,-2 10,16 Z" fill={LIME} />
            </g>
          ))}
        </g>
        <g ref={film} opacity={0}>
          <text x="400" y="146" className="diagram-tag" fill={SOFT}>
            keyframes, shots
          </text>
          <rect x={400} y={156} width={114} height={46} rx={4} fill="rgb(4 6 12 / 0.7)" stroke={CREAM} strokeOpacity={0.3} />
          {[0, 1, 2].map((k) => (
            <rect key={k} x={406 + k * 36} y={164} width={30} height={30} rx={3} fill={['#5a4a6a', '#6a5a4a', '#4a5a6a'][k]} />
          ))}
        </g>
        <g ref={note} opacity={0}>
          <text x="26" y="252" className="diagram-note">
            Every stage is tracked: a failed render says why.
          </text>
        </g>
      </g>
    </svg>
  );
}

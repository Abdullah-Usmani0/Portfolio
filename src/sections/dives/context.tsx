/**
 * The Context Engineering diagrams. Each runs on the same clock as the world's loop for its
 * step (see LOOPS), so a card lights the moment its part happens among the fireflies.
 */
import { useRef } from 'react';
import { FAILURES, LOOPS, failurePhase, loopTime } from '@/content/dives/context.ts';
import { CONTEXT_LAYERS, LAYER_COLORS } from '@/sim/particles/bust.ts';
import { anchorOf } from '@/world/anchors.ts';
import { worldView } from '@/world/view.ts';
import { AMBER, CREAM, LIME, RED } from './colors.ts';
import { useClock } from './svg.tsx';

/** How much a model attends to each position: the start and the end, much more than the middle. */
const attention = (k: number) => {
  const u = (k - (CONTEXT_LAYERS.length - 1) / 2) / ((CONTEXT_LAYERS.length - 1) / 2);
  return 0.16 + 0.84 * u * u;
};

/** Over the world: a bar beside each block of the stack, as long as the attention it gets. */
export function AttentionBars({ scene }: { scene: string }) {
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const notes = useRef<(SVGTextElement | null)[]>([]);
  useClock((t) => {
    const grow = 1 - (1 - Math.min(1, Math.max(0, (t - 1.2) / 1.4))) ** 3;
    CONTEXT_LAYERS.forEach((_, k) => {
      const a = anchorOf(scene, `block${k}`);
      const p = a && worldView.project ? worldView.project(a.group, a.x + a.w / 2, a.y) : null;
      const q = a && worldView.project ? worldView.project(a.group, a.x + a.w / 2, a.y + a.h / 2) : null;
      const bar = bars.current[k];
      if (!bar || !p || !q) return;
      const h = Math.max(4, Math.abs(q.y - p.y) * 1.1);
      const len = 170 * attention(k) * grow * (1 + 0.03 * Math.sin(t * 2.2 + k));
      bar.setAttribute('x', (p.x + 18).toFixed(1));
      bar.setAttribute('y', (p.y - h / 2).toFixed(1));
      bar.setAttribute('width', len.toFixed(1));
      bar.setAttribute('height', h.toFixed(1));
      const note = notes.current[k];
      if (note) {
        note.setAttribute('x', (p.x + 26 + len).toFixed(1));
        note.setAttribute('y', (p.y + 3.5).toFixed(1));
      }
    });
  });
  const tag = (k: number) => (k === 0 ? 'start: read closely' : k === 5 ? 'middle: easy to miss' : k === CONTEXT_LAYERS.length - 1 ? 'end: read closely' : '');
  return (
    <svg className="loops-svg" aria-hidden>
      {CONTEXT_LAYERS.map((name, k) => (
        <g key={name}>
          <rect
            ref={(el) => {
              bars.current[k] = el;
            }}
            rx={3}
            fill={LAYER_COLORS[k]}
            fillOpacity={0.5 + 0.4 * attention(k)}
          />
          <text
            ref={(el) => {
              notes.current[k] = el;
            }}
            className="diagram-label loops-label"
          >
            {tag(k)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** In the sheet on a phone: the same curve as ten bars, start to end. */
export function AttentionCurve() {
  const n = CONTEXT_LAYERS.length;
  return (
    <svg viewBox="0 0 320 132" className="diagram-svg" role="img" aria-label="Attention by position: high at the start and the end of the window, low in the middle.">
      {CONTEXT_LAYERS.map((name, k) => {
        const h = 86 * attention(k);
        return <rect key={name} x={14 + k * 30} y={100 - h} width={20} height={h} rx={3} fill={LAYER_COLORS[k]} fillOpacity={0.85} />;
      })}
      <text x={14} y={122} className="diagram-label">
        Start
      </text>
      <text x={14 + (n / 2 - 0.5) * 30 + 10} y={122} textAnchor="middle" className="diagram-label">
        Middle
      </text>
      <text x={14 + (n - 1) * 30 + 20} y={122} textAnchor="end" className="diagram-label">
        End
      </text>
    </svg>
  );
}

/** Time to the first spoken sentence: grade then reply, against one call with the verdict first. */
export function FirstWord() {
  const head = useRef<SVGLineElement>(null);
  const clock = useRef<SVGTextElement>(null);
  const firsts = useRef<(SVGGElement | null)[]>([]);
  const chunks = useRef<(SVGRectElement | null)[]>([]);
  const x0 = 150;
  const perS = 58;
  const xs = (s: number) => x0 + s * perS;
  useClock((t) => {
    const L = LOOPS.scratch;
    const lt = loopTime(L, t);
    // The playhead runs six seconds of a turn, then rests at the end.
    const s = lt < 0 ? 0 : Math.min(6, lt * 1.05);
    head.current?.setAttribute('x1', xs(s).toFixed(1));
    head.current?.setAttribute('x2', xs(s).toFixed(1));
    if (clock.current) clock.current.textContent = `${s.toFixed(1)} s`;
    [5.4, 2.1].forEach((at, i) => firsts.current[i]?.setAttribute('opacity', s >= at ? '1' : '0.18'));
    chunks.current.forEach((el, j) => el?.setAttribute('opacity', s >= 2.1 + j * 1.1 ? '1' : '0.15'));
  });
  return (
    <svg viewBox="0 0 540 214" className="diagram-svg" role="img" aria-label="Time to the first spoken sentence: 5.4 seconds when grading and replying are two calls, 2.1 seconds with one call that writes its verdict first.">
      <rect x="6" y="6" width="528" height="202" rx="22" fill="rgb(10 12 22 / 0.55)" stroke={CREAM} strokeOpacity={0.14} />
      <text x="26" y="38" className="diagram-label">
        Time to the first spoken word
      </text>
      {[0, 1, 2, 3, 4, 5, 6].map((s) => (
        <g key={s}>
          <line x1={xs(s)} x2={xs(s)} y1={56} y2={168} stroke={CREAM} strokeOpacity={0.08} />
          <text x={xs(s)} y={186} textAnchor="middle" className="diagram-note">
            {s}s
          </text>
        </g>
      ))}
      {/* Two calls: the grade has to finish before the reply can start. */}
      <text x="26" y="82" className="diagram-note">
        grade, then reply
      </text>
      <rect x={xs(0)} y={70} width={5.4 * perS} height={18} rx={5} fill={CREAM} fillOpacity={0.16} stroke={CREAM} strokeOpacity={0.3} />
      <g
        ref={(el) => {
          firsts.current[0] = el;
        }}
      >
        <circle cx={xs(5.4)} cy={79} r={6} fill={AMBER} />
        <text x={xs(5.4) - 10} y={63} textAnchor="end" className="diagram-label" fill={AMBER}>
          5.4 s
        </text>
      </g>
      {/* One call: a short hidden verdict, then sentences spoken as they finish. */}
      <text x="26" y="134" className="diagram-note">
        one call, verdict first
      </text>
      <rect x={xs(0)} y={122} width={1.2 * perS} height={18} rx={5} fill="none" stroke={CREAM} strokeOpacity={0.5} strokeDasharray="3 4" />
      <text x={xs(0.6)} y={159} textAnchor="middle" className="diagram-note">
        verdict, unspoken
      </text>
      {[0, 1, 2, 3].map((j) => (
        <rect
          key={j}
          ref={(el) => {
            chunks.current[j] = el;
          }}
          x={xs(1.25 + j * 1.1)}
          y={122}
          width={0.95 * perS}
          height={18}
          rx={5}
          fill={LIME}
        />
      ))}
      <g
        ref={(el) => {
          firsts.current[1] = el;
        }}
      >
        <circle cx={xs(2.1)} cy={131} r={6} fill={LIME} />
        <text x={xs(2.1)} y={115} textAnchor="middle" className="diagram-label" fill={LIME}>
          2.1 s
        </text>
      </g>
      <line ref={head} y1={52} y2={170} stroke={CREAM} strokeWidth={1.5} />
      <text ref={clock} x={514} y={38} textAnchor="end" className="diagram-label">
        0.0 s
      </text>
    </svg>
  );
}

/** The stage FAQ's bar: where a near miss and a real paraphrase land against 0.95. */
export function FaqMeter() {
  const miss = useRef<SVGGElement>(null);
  const hit = useRef<SVGGElement>(null);
  const verdict = useRef<SVGTextElement>(null);
  const L = LOOPS.select;
  const x0 = 40;
  const x1 = 500;
  const xs = (v: number) => x0 + ((v - 0.74) / (1 - 0.74)) * (x1 - x0);
  useClock((t) => {
    const lt = loopTime(L, t);
    const showMiss = lt >= L.miss + 1.5 && lt < L.hit + 1.5;
    const showHit = lt >= L.hit + 1.5;
    miss.current?.setAttribute('opacity', showMiss ? '1' : '0.15');
    hit.current?.setAttribute('opacity', showHit ? '1' : '0.15');
    if (verdict.current) verdict.current.textContent = showHit ? 'Hit: one fact replaces the big blocks' : showMiss ? 'Miss: fetch from the library instead' : 'A learner asks a question …';
  });
  return (
    <svg viewBox="0 0 540 200" className="diagram-svg" role="img" aria-label="The stage FAQ's similarity bar at 0.95: an unrelated question scores 0.880 and is refused; a real paraphrase scores 0.967 and is answered from the FAQ.">
      <rect x="6" y="6" width="528" height="188" rx="22" fill="rgb(10 12 22 / 0.55)" stroke={CREAM} strokeOpacity={0.14} />
      <text x="26" y="38" className="diagram-label">
        Does this question mean the same as one we know?
      </text>
      <line x1={x0} x2={x1} y1={104} y2={104} stroke={CREAM} strokeOpacity={0.35} strokeWidth={2} />
      {[0.75, 0.8, 0.85, 0.9, 1].map((v) => (
        <text key={v} x={xs(v)} y={128} textAnchor="middle" className="diagram-note">
          {v.toFixed(2)}
        </text>
      ))}
      {/* Small talk and history: nowhere near. */}
      <rect x={xs(0.76)} y={98} width={xs(0.79) - xs(0.76)} height={12} rx={4} fill={CREAM} fillOpacity={0.22} />
      <text x={xs(0.775)} y={88} textAnchor="middle" className="diagram-note">
        chit-chat
      </text>
      {/* The bar. */}
      <rect x={xs(0.95)} y={64} width={xs(1) - xs(0.95)} height={80} fill={LIME} fillOpacity={0.1} />
      <line x1={xs(0.95)} x2={xs(0.95)} y1={60} y2={148} stroke={LIME} strokeWidth={2} />
      <text x={xs(0.95)} y={56} textAnchor="middle" className="diagram-label" fill={LIME}>
        0.95
      </text>
      <g ref={miss} opacity={0.15}>
        <circle cx={xs(L.missAt)} cy={104} r={7} fill={RED} />
        <text x={xs(L.missAt)} y={86} textAnchor="middle" className="diagram-label" fill={RED}>
          near miss 0.880
        </text>
      </g>
      <g ref={hit} opacity={0.15}>
        <circle cx={xs(L.hitAt)} cy={104} r={7} fill={LIME} />
        <text x={xs(L.hitAt) - 4} y={86} textAnchor="end" className="diagram-label" fill={LIME}>
          paraphrase 0.967
        </text>
      </g>
      <text ref={verdict} x="26" y="160" className="diagram-label">
        A learner asks a question …
      </text>
      <text x="26" y="180" className="diagram-note">
        Retrieval-tuned embeddings scored the same paraphrase 0.834: the embedding type mattered.
      </text>
    </svg>
  );
}

/** The four failures as cards; the one the world is showing lights up, then its defence. */
export function Failures({ inline = false }: { inline?: boolean }) {
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  useClock((t) => {
    const lt = loopTime(LOOPS.failures, t);
    const phase = failurePhase(t);
    const lp = lt < 0 ? 0 : lt % LOOPS.failures.phase;
    cards.current.forEach((el, k) => {
      if (el) el.dataset.state = k !== phase ? '' : lp < 1.8 ? 'failing' : 'fixed';
    });
  });
  return (
    <ol className={inline ? 'failures is-inline' : 'failures'} aria-label="Four ways a long context fails, each with its defence">
      {FAILURES.map((f, k) => (
        <li
          key={f.name}
          ref={(el) => {
            cards.current[k] = el;
          }}
          className="failure"
        >
          <p className="failure-name">{f.name}</p>
          <p className="failure-what">{f.what}</p>
          <p className="failure-fix">
            <span aria-hidden style={{ color: LIME }}>
              ✓{' '}
            </span>
            {f.fix}
          </p>
        </li>
      ))}
    </ol>
  );
}

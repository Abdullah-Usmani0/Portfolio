/**
 * The Career dive's boards: what each camp won and built, each drawn as a small animated
 * piece of the work itself (a sign being read, a question becoming SQL, logs explained).
 */
import { useRef } from 'react';
import { AMBER, CREAM, CYAN, LIME, RED, VIOLET } from './colors.ts';
import { Frame, useClock } from './svg.tsx';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 between a and b, eased. */
const ease = (a: number, b: number, t: number) => {
  const u = clamp01((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** The first `n` characters of `s`, n growing from a to b. */
const typed = (s: string, a: number, b: number, t: number) => s.slice(0, Math.round(s.length * clamp01((t - a) / (b - a))));
/** Everything fades out just before a loop starts again. */
const fadeOut = (t: number, loop: number) => 1 - ease(loop - 0.6, loop - 0.1, t);

/* ─── Base camp honours ─────────────────────────────────────────────────────────────── */

const HONOUR_LOOP = 12;
const MEDALS = [
  { title: 'IEEE-HKN', note: 'honor society', color: CYAN, glyph: 'M-6,4 L0,-7 L6,4 Z' },
  { title: 'Top 12%', note: 'Tau Beta Pi', color: LIME, glyph: 'M-7,5 L-3,-1 L1,3 L7,-6' },
  { title: 'Research award', note: 'senior design', color: AMBER, glyph: 'M-5,-6 h10 v12 h-10 Z M-2,-2 h4 M-2,2 h4' },
  { title: '2nd place', note: 'CS capstone', color: VIOLET, glyph: 'M-3,-5 C3,-8 6,-2 0,2 L-4,6 H5' },
] as const;
const star = (cx: number, cy: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
};

/** The GPA gauge fills, six Dean's List stars light, and the medals are hung one by one. */
export function Honours() {
  const arc = useRef<SVGPathElement>(null);
  const gpa = useRef<SVGTextElement>(null);
  const stars = useRef<(SVGPolygonElement | null)[]>([]);
  const chancellor = useRef<SVGPolygonElement>(null);
  const medals = useRef<(SVGGElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  const R = 58;
  const arcLength = Math.PI * R;
  useClock((time) => {
    const t = time % HONOUR_LOOP;
    const fill = ease(0.3, 2.4, t);
    arc.current?.setAttribute('stroke-dashoffset', (arcLength * (1 - fill * (3.73 / 4))).toFixed(1));
    if (gpa.current) gpa.current.textContent = (3.73 * fill).toFixed(2);
    stars.current.forEach((s, i) => s?.setAttribute('fill', t > 2.6 + i * 0.32 ? AMBER : 'rgb(246 241 234 / 0.12)'));
    chancellor.current?.setAttribute('fill', t > 4.8 ? LIME : 'rgb(246 241 234 / 0.12)');
    medals.current.forEach((m, i) => {
      const k = ease(5.2 + i * 0.7, 5.8 + i * 0.7, t);
      m?.setAttribute('opacity', k.toFixed(2));
      m?.setAttribute('transform', `translate(0 ${((1 - k) * 10).toFixed(1)})`);
    });
    all.current?.setAttribute('opacity', fadeOut(t, HONOUR_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Base camp honours: Magna Cum Laude with a 3.73 GPA, the Dean's List six times, the Chancellor's List, IEEE-HKN, the top 12% Engineering Honor Society, an Undergraduate Research Award and 2nd place in the CS capstone.">
      <Frame w={540} h={270} title="Base camp honours" />
      <g ref={all}>
        <g transform="translate(112 168)">
          <path d={`M${-R},0 A${R},${R} 0 0 1 ${R},0`} fill="none" stroke={CREAM} strokeOpacity={0.12} strokeWidth={10} strokeLinecap="round" />
          <path ref={arc} d={`M${-R},0 A${R},${R} 0 0 1 ${R},0`} fill="none" stroke={LIME} strokeWidth={10} strokeLinecap="round" strokeDasharray={arcLength.toFixed(1)} strokeDashoffset={arcLength.toFixed(1)} />
          <text ref={gpa} y="-8" textAnchor="middle" className="diagram-big" fill={CREAM}>
            0.00
          </text>
          <text y="12" textAnchor="middle" className="diagram-note">
            GPA out of 4.00
          </text>
          <text y="40" textAnchor="middle" className="diagram-label" fill={LIME}>
            Magna Cum Laude
          </text>
        </g>
        <text x="214" y="80" className="diagram-label">
          Dean’s List × 6
        </text>
        {Array.from({ length: 6 }, (_, i) => (
          <polygon
            key={i}
            ref={(el) => {
              stars.current[i] = el;
            }}
            points={star(228 + (i % 3) * 34, 108 + Math.floor(i / 3) * 34, 12)}
            fill="rgb(246 241 234 / 0.12)"
          />
        ))}
        <text x="214" y="196" className="diagram-label">
          Chancellor’s List
        </text>
        <polygon ref={chancellor} points={star(228, 222, 12)} fill="rgb(246 241 234 / 0.12)" />
        <text x="248" y="226" className="diagram-note">
          a whole year
        </text>
        {MEDALS.map((m, i) => {
          const x = 370 + (i % 2) * 110;
          const y = 96 + Math.floor(i / 2) * 92;
          return (
            <g
              key={m.title}
              ref={(el) => {
                medals.current[i] = el;
              }}
              opacity={0}
            >
              <path d={`M${x - 9},${y + 12} L${x - 13},${y + 34} L${x - 4},${y + 28} Z M${x + 9},${y + 12} L${x + 13},${y + 34} L${x + 4},${y + 28} Z`} fill={m.color} fillOpacity={0.55} />
              <circle cx={x} cy={y} r={19} fill="rgb(10 12 22 / 0.9)" stroke={m.color} strokeWidth={2} />
              <path d={m.glyph} transform={`translate(${x} ${y})`} fill="none" stroke={m.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <text x={x} y={y + 50} textAnchor="middle" className="diagram-label">
                {m.title}
              </text>
              <text x={x} y={y + 63} textAnchor="middle" className="diagram-note">
                {m.note}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ─── Built at base camp: four research projects ────────────────────────────────────── */

const RESEARCH_LOOP = 10;

/** Four small benches: a sign found and read, a blade's serial read, a hand classified, prices fitted. */
export function Research() {
  const signBox = useRef<SVGRectElement>(null);
  const textBox = useRef<SVGRectElement>(null);
  const signRead = useRef<SVGTextElement>(null);
  const signScore = useRef<SVGTextElement>(null);
  const scan = useRef<SVGLineElement>(null);
  const serial = useRef<(SVGTextElement | null)[]>([]);
  const bladeRead = useRef<SVGTextElement>(null);
  const stroke = useRef<SVGPathElement>(null);
  const layers = useRef<(SVGRectElement | null)[]>([]);
  const classBar = useRef<SVGRectElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const fit = useRef<SVGLineElement>(null);
  const all = useRef<SVGGElement>(null);
  const SERIAL = 'LH 3047-B7';
  // Prices, skewed (as measured), and after a Box-Cox transform (nearly a straight line).
  const pts = Array.from({ length: 14 }, (_, i) => {
    const u = i / 13;
    const wobble = Math.sin(i * 2.7) * 0.06;
    return { x: u, raw: Math.min(1, 0.04 + u ** 2.6 * 0.95 + wobble * 0.5), cooked: Math.min(1, Math.max(0, 0.08 + u * 0.8 + wobble)) };
  });
  useClock((time) => {
    const t = time % RESEARCH_LOOP;
    // The sign: found, its text found, then read.
    const b1 = ease(0.2, 1.2, t);
    signBox.current?.setAttribute('stroke-dashoffset', ((1 - b1) * 360).toFixed(0));
    const b2 = ease(1.4, 2.2, t);
    textBox.current?.setAttribute('stroke-dashoffset', ((1 - b2) * 220).toFixed(0));
    if (signRead.current) signRead.current.textContent = typed('ABU DHABI  120 km', 2.4, 4.4, t);
    signScore.current?.setAttribute('opacity', ease(4.4, 4.9, t).toFixed(2));
    // The blade: a scan line passes and each etched character is read as it does.
    const sx = 288 + 196 * ease(0.6, 4, t);
    scan.current?.setAttribute('x1', sx.toFixed(1));
    scan.current?.setAttribute('x2', sx.toFixed(1));
    scan.current?.setAttribute('opacity', t > 0.5 && t < 4.2 ? '0.9' : '0');
    serial.current.forEach((c, i) => c?.setAttribute('fill', sx > 318 + i * 14 ? LIME : 'rgb(246 241 234 / 0.35)'));
    if (bladeRead.current) bladeRead.current.textContent = t > 4.1 ? `${SERIAL}  read` : '';
    // The hand: a stroke drawn, through a small network, to a confident class.
    stroke.current?.setAttribute('stroke-dashoffset', ((1 - ease(0.4, 2.8, t)) * 300).toFixed(0));
    layers.current.forEach((l, i) => l?.setAttribute('fill-opacity', (0.15 + 0.6 * ease(3 + i * 0.35, 3.3 + i * 0.35, t)).toFixed(2)));
    classBar.current?.setAttribute('width', (62 * ease(4.3, 5.2, t)).toFixed(1));
    // Prices: Box-Cox straightens the skew, then the line fits.
    const bc = ease(1.2, 3, t);
    pts.forEach((p, i) => {
      const y = p.raw + (p.cooked - p.raw) * bc;
      dots.current[i]?.setAttribute('cy', (262 - y * 64).toFixed(1));
    });
    const f = ease(3.3, 4.6, t);
    fit.current?.setAttribute('y2', (262 - (0.08 + 0.8 * f) * 64).toFixed(1));
    fit.current?.setAttribute('opacity', (0.25 + 0.75 * f).toFixed(2));
    all.current?.setAttribute('opacity', fadeOut(t, RESEARCH_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 300" className="diagram-svg" role="img" aria-label="Four research projects: UAE traffic signs found and read (0.92 mAP, 0.89 word accuracy); jet blade serials read for Lufthansa Technik; Arabic handwriting classified from 2,000+ samples; apartment prices fitted after a Box-Cox transform, 8% more accurate.">
      <Frame w={540} h={300} title="Built at base camp" />
      <g ref={all}>
        {/* UAE traffic signs */}
        <text x="26" y="66" className="diagram-label">
          UAE traffic signs
        </text>
        <rect x="40" y="80" width="118" height="56" rx="6" fill="#1f6b46" stroke={CREAM} strokeWidth={1.6} />
        <text x="54" y="102" className="diagram-sign">
          ABU DHABI
        </text>
        <text x="54" y="124" className="diagram-sign">
          120 km
        </text>
        <path d="M128,118 h18 m-6,-6 l6,6 l-6,6" fill="none" stroke={CREAM} strokeWidth={2} />
        <rect ref={signBox} x="34" y="74" width="130" height="68" rx="4" fill="none" stroke={LIME} strokeWidth={1.6} strokeDasharray="360" strokeDashoffset="360" />
        <rect ref={textBox} x="48" y="88" width="76" height="42" rx="3" fill="none" stroke={CYAN} strokeWidth={1.4} strokeDasharray="220" strokeDashoffset="220" />
        <text x="176" y="98" className="diagram-note">
          1 · find the sign
        </text>
        <text x="176" y="112" className="diagram-note">
          2 · find its text
        </text>
        <text x="176" y="126" className="diagram-note">
          3 · read it
        </text>
        <text ref={signRead} x="40" y="156" className="diagram-mono" fill={LIME} />
        <text ref={signScore} x="176" y="156" className="diagram-note" fill={LIME} opacity={0}>
          0.92 mAP · 0.89 words
        </text>

        {/* Jet blade serials */}
        <text x="282" y="66" className="diagram-label">
          Jet blades · Lufthansa Technik
        </text>
        <path d="M290,124 C330,92 420,86 492,100 L494,114 C424,106 340,112 296,136 Z" fill="#8f98a6" fillOpacity={0.55} stroke={CREAM} strokeOpacity={0.4} />
        {[...SERIAL].map((ch, i) => (
          <text
            key={i}
            ref={(el) => {
              serial.current[i] = el;
            }}
            x={318 + i * 14}
            y={112 - i * 0.6}
            className="diagram-etch"
            fill="rgb(246 241 234 / 0.35)"
          >
            {ch}
          </text>
        ))}
        <line ref={scan} y1="82" y2="142" stroke={CYAN} strokeWidth={1.4} opacity={0} />
        <text ref={bladeRead} x="296" y="156" className="diagram-mono" fill={LIME} />

        {/* Arabic handwriting */}
        <text x="26" y="196" className="diagram-label">
          Arabic handwriting · 2,000+
        </text>
        <path
          ref={stroke}
          d="M150,236 C138,250 116,250 112,236 C108,224 124,222 126,234 C128,246 104,252 92,240 L84,226 C80,240 68,248 56,238 C48,230 52,216 64,220"
          fill="none"
          stroke={CREAM}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeDasharray="300"
          strokeDashoffset="300"
        />
        <circle cx="100" cy="258" r="2.4" fill={CREAM} />
        <circle cx="70" cy="214" r="2.4" fill={CREAM} />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            ref={(el) => {
              layers.current[i] = el;
            }}
            x={176 + i * 16}
            y={216 + i * 5}
            width="11"
            height={44 - i * 10}
            rx="2"
            fill={VIOLET}
            fillOpacity={0.15}
          />
        ))}
        <rect x="176" y="268" width="62" height="5" rx="2.5" fill="rgb(246 241 234 / 0.12)" />
        <rect ref={classBar} x="176" y="268" width="0" height="5" rx="2.5" fill={VIOLET} />
        <text x="176" y="210" className="diagram-note">
          features + CNN
        </text>

        {/* Apartment prices */}
        <text x="282" y="196" className="diagram-label">
          Apartment prices · +8%
        </text>
        <line x1="296" y1="262" x2="500" y2="262" stroke={CREAM} strokeOpacity={0.25} />
        <line x1="296" y1="262" x2="296" y2="200" stroke={CREAM} strokeOpacity={0.25} />
        {pts.map((p, i) => (
          <circle
            key={i}
            ref={(el) => {
              dots.current[i] = el;
            }}
            cx={(304 + p.x * 188).toFixed(1)}
            cy={(262 - p.raw * 64).toFixed(1)}
            r="3"
            fill={AMBER}
          />
        ))}
        <line ref={fit} x1="304" y1={(262 - 0.08 * 64).toFixed(1)} x2="492" y2={(262 - 0.08 * 64).toFixed(1)} stroke={LIME} strokeWidth={2} opacity={0.25} />
        <text x="404" y="282" className="diagram-note">
          Box-Cox, then fit
        </text>
      </g>
    </svg>
  );
}

/* ─── Camp I: plain questions in, SQL out ───────────────────────────────────────────── */

const SQL_LOOP = 11;
const QUESTION = ['Which regions grew', 'fastest last quarter?'] as const;
const SQL = ['SELECT region, growth', 'FROM sales', "WHERE quarter = 'Q3'", 'ORDER BY growth DESC', 'LIMIT 3;'];
const SCHEMA = ['sales', 'regions', 'quarters'] as const;
const RESULTS = [
  ['North', 0.92],
  ['East', 0.71],
  ['West', 0.55],
] as const;

/** A question types itself, the schema index finds the tables, the SQL writes itself, the answer appears. */
export function NlSql() {
  const question = useRef<(SVGTextElement | null)[]>([]);
  const chips = useRef<(SVGGElement | null)[]>([]);
  const lines = useRef<(SVGTextElement | null)[]>([]);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % SQL_LOOP;
    QUESTION.forEach((line, i) => {
      const el = question.current[i];
      if (el) el.textContent = typed(line, 0.3 + i * 1.05, 1.35 + i * 1.05, t);
    });
    chips.current.forEach((c, i) => c?.setAttribute('opacity', (0.25 + 0.75 * ease(2.6 + i * 0.25, 2.9 + i * 0.25, t)).toFixed(2)));
    const total = SQL.join('').length;
    let shown = Math.round(total * clamp01((t - 3.6) / 3));
    SQL.forEach((line, i) => {
      const el = lines.current[i];
      if (!el) return;
      el.textContent = line.slice(0, Math.max(0, shown));
      shown -= line.length;
    });
    bars.current.forEach((b, i) => b?.setAttribute('width', (110 * RESULTS[i]![1] * ease(6.8 + i * 0.15, 7.6 + i * 0.15, t)).toFixed(1)));
    all.current?.setAttribute('opacity', fadeOut(t, SQL_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="A plain-English question becomes SQL: the schema is found in a Pinecone index, the model writes the query, the answer comes back. Data exploration up 95%; fine-tuning raised accuracy 30%.">
      <Frame w={540} h={270} title="Plain question in, SQL out" />
      <g ref={all}>
        <rect x="26" y="52" width="262" height="52" rx="16" fill="rgb(246 241 234 / 0.08)" stroke={CREAM} strokeOpacity={0.25} />
        {QUESTION.map((_, i) => (
          <text
            key={i}
            ref={(el) => {
              question.current[i] = el;
            }}
            x="42"
            y={74 + i * 17}
            className="diagram-note"
            fill={CREAM}
          />
        ))}
        <text x="26" y="124" className="diagram-label">
          Schema, from the index
        </text>
        {SCHEMA.map((name, i) => (
          <g
            key={name}
            ref={(el) => {
              chips.current[i] = el;
            }}
            opacity={0.25}
          >
            <rect x={26 + i * 86} y={134} width={78} height={24} rx={12} fill="rgb(106 232 255 / 0.12)" stroke={CYAN} strokeOpacity={0.6} />
            <text x={65 + i * 86} y={150} textAnchor="middle" className="diagram-note" fill={CYAN}>
              {name}
            </text>
          </g>
        ))}
        <rect x="306" y="56" width="208" height="112" rx="10" fill="rgb(4 6 12 / 0.7)" stroke={CREAM} strokeOpacity={0.18} />
        {SQL.map((_, i) => (
          <text
            key={i}
            ref={(el) => {
              lines.current[i] = el;
            }}
            x="318"
            y={78 + i * 19}
            className="diagram-mono"
            fill={i === 0 ? LIME : CREAM}
          />
        ))}
        {RESULTS.map(([name], i) => (
          <g key={name}>
            <text x="318" y={194 + i * 22} className="diagram-note">
              {name}
            </text>
            <rect
              ref={(el) => {
                bars.current[i] = el;
              }}
              x="370"
              y={184 + i * 22}
              width="0"
              height="12"
              rx="3"
              fill={AMBER}
            />
          </g>
        ))}
        <text x="26" y="200" className="diagram-big-s" fill={LIME}>
          +95%
        </text>
        <text x="96" y="200" className="diagram-note">
          data exploration
        </text>
        <text x="26" y="236" className="diagram-big-s" fill={VIOLET}>
          +30%
        </text>
        <text x="96" y="236" className="diagram-note">
          accuracy, fine-tuned
        </text>
      </g>
    </svg>
  );
}

/* ─── Camp II: logs explained, and a support bot ────────────────────────────────────── */

const LOG_LOOP = 10;
const LOG_LINES = [
  '01:58 vm-12 backup start',
  '02:00 disk p95 latency 410ms',
  '02:01 api timeout /orders',
  '02:03 disk p95 latency 512ms',
  '02:05 backup 38% done',
  '02:07 api retry ok',
  '02:09 queue depth 1.2k',
  '02:12 backup 61% done',
] as const;
const INSIGHT = ['Latency spikes while the nightly', 'backup runs. Move it to 04:00.'];

/** Logs scroll, the right two are pulled out, a local model explains them; a chat bot opens a ticket. */
export function Logs() {
  const scroll = useRef<SVGGElement>(null);
  const hits = useRef<(SVGRectElement | null)[]>([]);
  const insight = useRef<(SVGTextElement | null)[]>([]);
  const bubbles = useRef<(SVGGElement | null)[]>([]);
  const dots = useRef<SVGGElement>(null);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % LOG_LOOP;
    scroll.current?.setAttribute('transform', `translate(0 ${(-((time * 6) % 18)).toFixed(1)})`);
    hits.current.forEach((h) => h?.setAttribute('opacity', (0.85 * ease(1.4, 2, t)).toFixed(2)));
    INSIGHT.forEach((line, i) => {
      const el = insight.current[i];
      if (el) el.textContent = typed(line, 2.6 + i * 1.4, 4 + i * 1.4, t);
    });
    bubbles.current.forEach((b, i) => b?.setAttribute('opacity', ease([0.6, 3.4, 4.6][i]!, [1, 3.8, 5][i]!, t).toFixed(2)));
    dots.current?.setAttribute('opacity', t > 1.4 && t < 3.3 ? String(0.5 + 0.5 * Math.sin(time * 9)) : '0');
    all.current?.setAttribute('opacity', fadeOut(t, LOG_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 280" className="diagram-svg" role="img" aria-label="Logs scroll past, a local Mistral model with ChromaDB pulls out the two that matter and explains them: troubleshooting 200% more efficient. A WhatsApp bot for Dell opens a support ticket: response times halved.">
      <Frame w={540} h={280} title="Logs explained, tickets answered" />
      <g ref={all}>
        <rect x="26" y="52" width="282" height="104" rx="10" fill="rgb(4 6 12 / 0.7)" stroke={CREAM} strokeOpacity={0.16} />
        <clipPath id="career-log-clip">
          <rect x="26" y="56" width="282" height="96" rx="8" />
        </clipPath>
        <g clipPath="url(#career-log-clip)">
          <g ref={scroll}>
            {[...LOG_LINES, ...LOG_LINES].map((line, i) => (
              <g key={i}>
                {(i % LOG_LINES.length === 1 || i % LOG_LINES.length === 3) && (
                  <rect
                    ref={(el) => {
                      if (i < LOG_LINES.length) hits.current[i === 1 ? 0 : 1] = el;
                    }}
                    x="30"
                    y={60 + i * 18}
                    width="272"
                    height="15"
                    rx="3"
                    fill="rgb(106 232 255 / 0.18)"
                    opacity={0}
                  />
                )}
                <text x="38" y={71 + i * 18} className="diagram-mono-s" fill="rgb(246 241 234 / 0.62)">
                  {line}
                </text>
              </g>
            ))}
          </g>
        </g>
        <text x="26" y="178" className="diagram-label">
          Local Mistral + ChromaDB
        </text>
        <rect x="26" y="188" width="282" height="46" rx="10" fill="rgb(185 239 46 / 0.08)" stroke={LIME} strokeOpacity={0.4} />
        {INSIGHT.map((_, i) => (
          <text
            key={i}
            ref={(el) => {
              insight.current[i] = el;
            }}
            x="38"
            y={207 + i * 16}
            className="diagram-note"
            fill={CREAM}
          />
        ))}
        <text x="26" y="258" className="diagram-big-s" fill={LIME}>
          +200%
        </text>
        <text x="96" y="258" className="diagram-note">
          troubleshooting
        </text>

        <rect x="330" y="52" width="184" height="182" rx="18" fill="rgb(4 6 12 / 0.6)" stroke={CREAM} strokeOpacity={0.2} />
        <text x="346" y="74" className="diagram-label">
          WhatsApp · Dell
        </text>
        <g
          ref={(el) => {
            bubbles.current[0] = el;
          }}
          opacity={0}
        >
          <rect x="364" y="86" width="140" height="26" rx="10" fill="#2f7d55" />
          <text x="374" y="103" className="diagram-note" fill={CREAM}>
            Laptop won’t charge
          </text>
        </g>
        <g ref={dots} opacity={0}>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={352 + i * 9} cy={130} r={2.6} fill={CREAM} />
          ))}
        </g>
        <g
          ref={(el) => {
            bubbles.current[1] = el;
          }}
          opacity={0}
        >
          <rect x="340" y="122" width="150" height="40" rx="10" fill="rgb(246 241 234 / 0.9)" />
          <text x="350" y="138" className="diagram-note" fill="#15131a">
            Ticket 4821 is open.
          </text>
          <text x="350" y="153" className="diagram-note" fill="#15131a">
            A tech calls today.
          </text>
        </g>
        <g
          ref={(el) => {
            bubbles.current[2] = el;
          }}
          opacity={0}
        >
          <rect x="340" y="172" width="160" height="24" rx="12" fill="rgb(255 196 92 / 0.14)" stroke={AMBER} strokeOpacity={0.7} />
          <text x="352" y="188" className="diagram-note" fill={AMBER}>
            routed · Redis, Twilio
          </text>
        </g>
        <text x="346" y="258" className="diagram-big-s" fill={AMBER}>
          −50%
        </text>
        <text x="410" y="258" className="diagram-note">
          response time
        </text>
      </g>
    </svg>
  );
}

/* ─── Camp III: an ad critic with eyes and ears, and a crew that writes ─────────────── */

const AD_LOOP = 10;
const LANES = [
  { model: 'Whisper', verb: 'hears', color: CYAN, out: '“Fresh all day. Get yours now.”' },
  { model: 'SmolVLM2', verb: 'sees', color: VIOLET, out: 'product 0:01 · face 0:02 · logo 0:04' },
  { model: 'GPT-4', verb: 'judges', color: LIME, out: 'Hook lands; the offer comes too late.' },
] as const;
const CREW = ['Research', 'Write', 'Edit'] as const;

/** An ad plays; its sound, its frames and the whole of it are read by three models; a crew passes a post along. */
export function AdLab() {
  const head = useRef<SVGLineElement>(null);
  const wave = useRef<(SVGRectElement | null)[]>([]);
  const outs = useRef<(SVGTextElement | null)[]>([]);
  const card = useRef<SVGGElement>(null);
  const crew = useRef<(SVGCircleElement | null)[]>([]);
  const all = useRef<SVGGElement>(null);
  useClock((time) => {
    const t = time % AD_LOOP;
    const play = clamp01(t / 4.2);
    head.current?.setAttribute('x1', (30 + play * 168).toFixed(1));
    head.current?.setAttribute('x2', (30 + play * 168).toFixed(1));
    wave.current.forEach((w, i) => {
      const h = 3 + Math.abs(Math.sin(time * 6 + i * 1.3) * Math.sin(time * 2.1 + i * 0.4)) * 14;
      w?.setAttribute('height', h.toFixed(1));
      w?.setAttribute('y', (126 - h / 2).toFixed(1));
    });
    LANES.forEach((lane, i) => {
      const el = outs.current[i];
      if (el) el.textContent = typed(lane.out, 1 + i * 1.4, 2.6 + i * 1.4, t);
    });
    // The post moves from agent to agent, pausing at each, then goes out.
    const x = 80 + 150 * ease(6.4, 7, t) + 150 * ease(7.6, 8.2, t) + 44 * ease(8.6, 9.1, t);
    const stage = t < 7 ? 0 : t < 8.2 ? 1 : 2;
    card.current?.setAttribute('transform', `translate(${x.toFixed(1)} 0)`);
    card.current?.setAttribute('opacity', t > 5.4 ? '1' : '0');
    crew.current.forEach((c, i) => c?.setAttribute('fill-opacity', (0.15 + 0.7 * (t > 5.6 && stage === i ? 1 : 0)).toFixed(2)));
    all.current?.setAttribute('opacity', fadeOut(t, AD_LOOP).toFixed(2));
  });
  return (
    <svg viewBox="0 0 540 290" className="diagram-svg" role="img" aria-label="An ad is analysed by three models: Whisper hears it, SmolVLM2 sees it, GPT-4 judges it, for 70% better campaign insights. A CrewAI crew researches, writes and edits posts, for 80% more throughput.">
      <Frame w={540} h={290} title="An ad critic, and a crew that writes" />
      <g ref={all}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={30 + i * 42} y={56} width={38} height={40} rx={4} fill="rgb(246 241 234 / 0.08)" stroke={CREAM} strokeOpacity={0.3} />
            {i === 0 && <rect x={44} y={64} width={10} height={24} rx={3} fill={AMBER} />}
            {i === 1 && <circle cx={93} cy={74} r={8} fill={CREAM} fillOpacity={0.7} />}
            {i === 2 && <path d="M124,82 l10,-16 l10,16 Z" fill={LIME} fillOpacity={0.8} />}
            {i === 3 && <rect x={160} y={70} width={26} height={12} rx={6} fill={RED} fillOpacity={0.8} />}
          </g>
        ))}
        {Array.from({ length: 28 }, (_, i) => (
          <rect
            key={i}
            ref={(el) => {
              wave.current[i] = el;
            }}
            x={31 + i * 6}
            y={120}
            width={3}
            height={6}
            rx={1.5}
            fill={CYAN}
            fillOpacity={0.7}
          />
        ))}
        <line ref={head} y1="52" y2="140" stroke={CREAM} strokeWidth={1.4} />
        {LANES.map((lane, i) => (
          <g key={lane.model}>
            <path d={`M206,${96 + (i - 1) * 4} C230,${96 + (i - 1) * 4} 230,${70 + i * 30} 250,${70 + i * 30}`} fill="none" stroke={lane.color} strokeOpacity={0.5} />
            <text x="256" y={66 + i * 30} className="diagram-label" fill={lane.color}>
              {`${lane.model} ${lane.verb}`}
            </text>
            <text
              ref={(el) => {
                outs.current[i] = el;
              }}
              x="256"
              y={80 + i * 30}
              className="diagram-note"
              fill={CREAM}
            />
          </g>
        ))}
        <text x="30" y="166" className="diagram-big-s" fill={LIME}>
          +70%
        </text>
        <text x="100" y="166" className="diagram-note">
          campaign insights
        </text>

        <text x="30" y="200" className="diagram-label">
          CrewAI crew
        </text>
        <line x1="80" y1="236" x2="380" y2="236" stroke={CREAM} strokeOpacity={0.2} strokeDasharray="3 5" />
        {CREW.map((name, i) => (
          <g key={name}>
            <circle
              ref={(el) => {
                crew.current[i] = el;
              }}
              cx={80 + i * 150}
              cy={236}
              r={16}
              fill={AMBER}
              fillOpacity={0.15}
              stroke={AMBER}
            />
            <text x={80 + i * 150} y={268} textAnchor="middle" className="diagram-note">
              {name}
            </text>
          </g>
        ))}
        <g ref={card} opacity={0}>
          <rect x="-11" y="216" width="22" height="14" rx="2" fill={CREAM} />
          <line x1="-7" x2="7" y1="221" y2="221" stroke="#15131a" />
          <line x1="-7" x2="3" y1="225" y2="225" stroke="#15131a" />
        </g>
        <text x="430" y="232" className="diagram-big-s" fill={AMBER}>
          +80%
        </text>
        <text x="430" y="250" className="diagram-note">
          posts out
        </text>
      </g>
    </svg>
  );
}

/* ─── Camp IV: Zero ─────────────────────────────────────────────────────────────────── */

const METRICS = [
  { value: 1, format: (v: number) => `${v.toFixed(v < 1 ? 1 : 0)}M+`, label: 'interactions a day', color: LIME },
  { value: 99.8, format: (v: number) => `${v.toFixed(1)}%`, label: 'uptime', color: CYAN },
  { value: 200, format: (v: number) => `<${Math.round(v)} ms`, label: 'latency', color: AMBER, down: true },
  { value: 85, format: (v: number) => `+${Math.round(v)}%`, label: 'learning outcomes', color: VIOLET },
  { value: 340, format: (v: number) => `+${Math.round(v)}%`, label: 'student engagement', color: LIME },
] as const;
const VALLEY = ['Councils', 'Scenarios', 'Learners', 'NPCs', 'Context', 'Voice'] as const;

/** The numbers count up; a heartbeat runs along the uptime line; the work below lights up, scene by scene. */
export function ZeroBoard() {
  const values = useRef<(SVGTextElement | null)[]>([]);
  const pulse = useRef<SVGCircleElement>(null);
  const chips = useRef<(SVGGElement | null)[]>([]);
  useClock((time) => {
    METRICS.forEach((m, i) => {
      const el = values.current[i];
      if (!el) return;
      const k = ease(0.2 + i * 0.25, 1.8 + i * 0.25, time);
      // Latency counts down to its ceiling from a slow start; the rest count up.
      const v = 'down' in m ? 900 - (900 - m.value) * k : m.value * k;
      el.textContent = m.format(v);
    });
    const u = (time * 0.18) % 1;
    const x = 30 + u * 480;
    const beat = Math.max(0, 1 - Math.abs(((x - 30) % 80) - 40) / 6);
    pulse.current?.setAttribute('cx', x.toFixed(1));
    pulse.current?.setAttribute('cy', (194 - beat * 14).toFixed(1));
    chips.current.forEach((c, i) => c?.setAttribute('opacity', (0.3 + 0.7 * ease(2.6 + i * 0.3, 3 + i * 0.3, time)).toFixed(2)));
  });
  const heartbeat = Array.from({ length: 6 }, (_, i) => {
    const x = 30 + i * 80;
    return `M${x},194 h34 l4,-14 l4,22 l4,-8 h34`;
  }).join(' ');
  return (
    <svg viewBox="0 0 540 270" className="diagram-svg" role="img" aria-label="Zero in production: 1M+ learner interactions a day, 99.8% uptime, under 200 ms latency, learning outcomes up 85% and student engagement up 340%. The work: councils, scenarios, simulated learners, NPCs, context engineering and voice.">
      <Frame w={540} h={270} title="Camp IV · Zero, in production" />
      {METRICS.map((m, i) => {
        const x = 30 + (i % 3) * 168;
        const y = 92 + Math.floor(i / 3) * 56;
        return (
          <g key={m.label}>
            <text
              ref={(el) => {
                values.current[i] = el;
              }}
              x={x}
              y={y}
              className="diagram-big"
              fill={m.color}
            >
              {m.format(0)}
            </text>
            <text x={x} y={y + 18} className="diagram-note">
              {m.label}
            </text>
          </g>
        );
      })}
      <path d={heartbeat} fill="none" stroke={CYAN} strokeOpacity={0.35} strokeWidth={1.4} />
      <circle ref={pulse} r="3.5" fill={CYAN} />
      <text x="30" y="228" className="diagram-label">
        The valley below
      </text>
      {VALLEY.map((name, i) => (
        <g
          key={name}
          ref={(el) => {
            chips.current[i] = el;
          }}
          opacity={0.3}
        >
          <rect x={30 + i * 81} y={238} width={74} height={20} rx={10} fill="rgb(185 239 46 / 0.1)" stroke={LIME} strokeOpacity={0.55} />
          <text x={67 + i * 81} y={252} textAnchor="middle" className="diagram-note" fill={CREAM}>
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── The summit: the kit carried up ────────────────────────────────────────────────── */

const CERTS = [
  ['Multi-agent crewAI', '2024'],
  ['Multimodal RAG', '2024'],
  ['Agentic RAG', '2024'],
  ['SAP fundamentals', '2024'],
  ['Supervised ML', '2023'],
  ['Transformers, BERT', '2023'],
  ['LangChain apps', '2023'],
  ['Design thinking', '2022'],
] as const;
const SKILLS = [
  { group: 'Agents', color: LIME, items: ['LangGraph', 'CrewAI', 'AutoGen'] },
  { group: 'Models', color: VIOLET, items: ['PyTorch', 'TensorFlow', 'Whisper'] },
  { group: 'Real time', color: CYAN, items: ['LiveKit', 'WebRTC', 'Redis'] },
  { group: 'Infra', color: AMBER, items: ['Docker', 'Kubernetes', 'AWS ECS'] },
] as const;

/** Eight certifications pinned up one by one, and the kit carried to the top. */
export function Kit() {
  const certs = useRef<(SVGGElement | null)[]>([]);
  const tags = useRef<(SVGGElement | null)[]>([]);
  useClock((time) => {
    certs.current.forEach((c, i) => c?.setAttribute('opacity', ease(0.2 + i * 0.22, 0.6 + i * 0.22, time).toFixed(2)));
    tags.current.forEach((g, i) => g?.setAttribute('opacity', ease(2 + i * 0.35, 2.5 + i * 0.35, time).toFixed(2)));
  });
  return (
    <svg viewBox="0 0 540 280" className="diagram-svg" role="img" aria-label={`Eight certifications: ${CERTS.map((c) => c[0]).join(', ')}. Skills: ${SKILLS.map((s) => `${s.group}: ${s.items.join(', ')}`).join('; ')}.`}>
      <Frame w={540} h={280} title="The kit, carried to the top" />
      {CERTS.map(([name, year], i) => {
        const y = 62 + i * 25;
        return (
          <g
            key={name}
            ref={(el) => {
              certs.current[i] = el;
            }}
            opacity={0}
          >
            <path d={`M38,${y - 9} l7,4 v8 l-7,4 l-7,-4 v-8 Z`} fill="rgb(185 239 46 / 0.12)" stroke={LIME} strokeOpacity={0.7} />
            <text x="54" y={y + 3} className="diagram-note" fill={CREAM}>
              {name}
            </text>
            <text x="262" y={y + 3} textAnchor="end" className="diagram-note">
              {year}
            </text>
          </g>
        );
      })}
      {SKILLS.map((s, i) => {
        let x = 290;
        return (
          <g
            key={s.group}
            ref={(el) => {
              tags.current[i] = el;
            }}
            opacity={0}
          >
            <text x="290" y={66 + i * 52} className="diagram-label" fill={s.color}>
              {s.group}
            </text>
            {s.items.map((item) => {
              const w = 14 + item.length * 5.7;
              const at = x;
              x += w + 5;
              return (
                <g key={item}>
                  <rect x={at} y={74 + i * 52} width={w} height={20} rx={10} fill="rgb(246 241 234 / 0.06)" stroke={s.color} strokeOpacity={0.5} />
                  <text x={at + w / 2} y={88 + i * 52} textAnchor="middle" className="diagram-tag" fill={CREAM}>
                    {item}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

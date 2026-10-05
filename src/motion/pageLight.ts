/**
 * Page light: the page lives through one day as you scroll. Every section holds a look
 * (its hour of the day); between two sections the colours ease from one look to the next,
 * holding still while a section sits in the middle of the screen.
 *
 * Pure (no DOM), so continuity and text contrast are unit-tested. Colours mix in OKLab so a
 * golden afternoon fades into dusk without passing through mud.
 */

export type LookName = 'dawn' | 'morning' | 'day' | 'afternoon' | 'golden' | 'dusk' | 'night' | 'lateNight' | 'sunrise';

export interface Look {
  /** Shown in the nav, e.g. "Dawn". */
  label: string;
  /** Shown in the nav, e.g. "05:40". */
  clock: string;
  /** The page ground. */
  bg: string;
  /** The sun or moon glow over the ground. */
  glow: string;
  /** Glow centre, as a percentage of the viewport height (100 = on the bottom edge). */
  glowY: number;
}

export const LOOKS: Readonly<Record<LookName, Look>> = {
  dawn: { label: 'Dawn', clock: '05:40', bg: '#e8e4ec', glow: '#f5c9b3', glowY: 108 },
  morning: { label: 'Morning', clock: '09:00', bg: '#ebedf0', glow: '#f2e2cb', glowY: 64 },
  day: { label: 'Midday', clock: '12:00', bg: '#edf1f4', glow: '#d2e4f4', glowY: -12 },
  afternoon: { label: 'Afternoon', clock: '15:00', bg: '#efede8', glow: '#eedbbd', glowY: 18 },
  golden: { label: 'Golden hour', clock: '17:30', bg: '#f1e6d7', glow: '#f2c38a', glowY: 96 },
  dusk: { label: 'Dusk', clock: '19:10', bg: '#28233a', glow: '#9a627e', glowY: 112 },
  night: { label: 'Night', clock: '22:30', bg: '#0b0d14', glow: '#1b2742', glowY: -18 },
  lateNight: { label: 'Small hours', clock: '02:10', bg: '#08090e', glow: '#141c31', glowY: 120 },
  sunrise: { label: 'Sunrise', clock: '05:52', bg: '#ede2dc', glow: '#ffb684', glowY: 104 },
};

/** Text colours for the light and dark halves of the day. */
export const INK = {
  light: { ink: '#111114', muted: '#5c5a65' },
  dark: { ink: '#eceef3', muted: '#9ca1af' },
} as const;

/** Grounds darker than this read with light text. */
export const DARK_LUMINANCE = 0.18;

/** How much of the way between two sections the light holds still at each end. */
export const HOLD = 0.16;

export interface PageLight {
  bg: string;
  /** `r g b` (0–255) for `rgb(var(--bg-rgb) / a)`. */
  bgRgb: string;
  glow: string;
  glowY: number;
  dark: boolean;
  ink: string;
  muted: string;
  /** The look of the section nearest the middle of the screen. */
  look: Look;
}

type Rgb = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const to = (c: number) =>
    Math.round(clamp01(c) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

function toOklab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Mix two hex colours in OKLab; k = 0 gives `a`, 1 gives `b`. */
export function mixHex(a: string, b: string, k: number): string {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const A = toOklab(hexToRgb(a));
  const B = toOklab(hexToRgb(b));
  return rgbToHex(fromOklab([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]));
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The light at section position `s` (0 = first section centred, 1 = second, …).
 * Between sections the mix holds at each end, then eases with smootherstep. Crossing from a
 * light look to a dark one the middle is squeezed, so the page spends as little scroll as
 * possible in mid-tones where neither ink reads well.
 */
export function lightAt(sections: readonly Look[], s: number): PageLight {
  const n = sections.length;
  if (n === 0) throw new Error('lightAt needs at least one section');
  const pos = Math.min(n - 1, Math.max(0, s));
  const i = Math.min(n - 2, Math.floor(pos));
  const a = sections[Math.max(0, i)]!;
  const b = sections[Math.min(n - 1, i + 1)]!;
  let k = n === 1 ? 0 : smootherstep((pos - i - HOLD) / (1 - 2 * HOLD));
  const flips = luminance(a.bg) > DARK_LUMINANCE !== luminance(b.bg) > DARK_LUMINANCE;
  if (flips) k = smootherstep((k - 0.3) / 0.4);

  const bg = mixHex(a.bg, b.bg, k);
  const dark = luminance(bg) < DARK_LUMINANCE;
  const [r, g, bl] = hexToRgb(bg).map((c) => Math.round(c * 255)) as Rgb;
  return {
    bg,
    bgRgb: `${r} ${g} ${bl}`,
    glow: mixHex(a.glow, b.glow, k),
    glowY: a.glowY + (b.glowY - a.glowY) * k,
    dark,
    ...(dark ? INK.dark : INK.light),
    look: sections[Math.round(pos)]!,
  };
}

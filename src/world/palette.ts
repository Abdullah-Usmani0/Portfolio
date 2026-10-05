/**
 * The world's light through one day. Every layer of the landscape takes its colour from
 * here: far layers lean to the haze, near layers to the shade, so the scene reads as one
 * painted picture at any hour. Pure, so continuity can be tested.
 */
import { luminance, mixHex, smootherstep } from '@/motion/color.ts';

export type WorldLookName = 'dawn' | 'morning' | 'day' | 'afternoon' | 'golden' | 'dusk' | 'night' | 'lateNight' | 'sunrise';

export interface WorldLook {
  label: string;
  clock: string;
  skyTop: string;
  skyHorizon: string;
  /** Sun or moon colour. */
  sun: string;
  /** Sun height above the horizon line, in view heights (−0.2 … 0.9). */
  sunY: number;
  /** Sun position across the view (−1 left … 1 right). */
  sunX: number;
  /** The colour distance fades to. */
  haze: string;
  /** The colour of the nearest silhouettes. */
  shade: string;
  /** Lit snow on the high peaks (alpenglow at the ends of the day). */
  snow: string;
  /** River and lake body. */
  water: string;
  /** Vegetation tint, mixed into the nearer layers. */
  leaf: string;
  /** 0–1: lit windows and lanterns. */
  windows: number;
  /** 0–1: stars and fireflies. */
  stars: number;
  /** 0–1: valley mist. */
  mist: number;
}

export const WORLD_LOOKS: Readonly<Record<WorldLookName, WorldLook>> = {
  dawn: {
    label: 'Dawn', clock: '05:40',
    skyTop: '#7d7fb4', skyHorizon: '#f7c2a2', sun: '#ffe3c6', sunY: 0.02, sunX: -0.35,
    haze: '#e8b4ab', shade: '#2b2140', snow: '#ffeee2', water: '#c3a6c3', leaf: '#4a5d4f',
    windows: 0.55, stars: 0.12, mist: 0.75,
  },
  morning: {
    label: 'Morning', clock: '09:00',
    skyTop: '#86acd6', skyHorizon: '#f1e2cc', sun: '#fff5df', sunY: 0.36, sunX: -0.45,
    haze: '#c8d1db', shade: '#1f3229', snow: '#ffffff', water: '#8fb2c8', leaf: '#3f6a4b',
    windows: 0, stars: 0, mist: 0.45,
  },
  day: {
    label: 'Midday', clock: '12:00',
    skyTop: '#6aa3d8', skyHorizon: '#d6e8f2', sun: '#ffffff', sunY: 0.78, sunX: 0.05,
    haze: '#bed2e1', shade: '#1b3428', snow: '#ffffff', water: '#6d9fc1', leaf: '#3c7048',
    windows: 0, stars: 0, mist: 0.18,
  },
  afternoon: {
    label: 'Afternoon', clock: '15:00',
    skyTop: '#76a2d0', skyHorizon: '#eedec4', sun: '#fff0d4', sunY: 0.5, sunX: 0.45,
    haze: '#d5ccbd', shade: '#263124', snow: '#fff8ec', water: '#7ea1b7', leaf: '#4f6d3f',
    windows: 0, stars: 0, mist: 0.22,
  },
  golden: {
    label: 'Golden hour', clock: '17:30',
    skyTop: '#6a7aad', skyHorizon: '#f7c486', sun: '#ffd28c', sunY: 0.12, sunX: 0.62,
    haze: '#e6b78a', shade: '#372720', snow: '#ffe1b4', water: '#d3a37a', leaf: '#6d6a35',
    windows: 0.2, stars: 0, mist: 0.35,
  },
  dusk: {
    label: 'Dusk', clock: '19:10',
    skyTop: '#2c305e', skyHorizon: '#c47a8a', sun: '#ff9f8c', sunY: -0.08, sunX: 0.7,
    haze: '#8c6587', shade: '#1b152c', snow: '#f4b5c1', water: '#6e5986', leaf: '#3b3a4f',
    windows: 1, stars: 0.4, mist: 0.4,
  },
  night: {
    label: 'Night', clock: '22:30',
    skyTop: '#060a19', skyHorizon: '#1b2646', sun: '#dde6ff', sunY: 0.74, sunX: -0.5,
    haze: '#29355a', shade: '#060910', snow: '#a2b3d8', water: '#1d2a49', leaf: '#16213a',
    windows: 1, stars: 1, mist: 0.3,
  },
  lateNight: {
    label: 'Small hours', clock: '02:10',
    skyTop: '#03050e', skyHorizon: '#111933', sun: '#cfdaf7', sunY: 0.8, sunX: -0.62,
    haze: '#1d2744', shade: '#04060c', snow: '#8698c0', water: '#131c34', leaf: '#111a2e',
    windows: 0.7, stars: 1, mist: 0.35,
  },
  sunrise: {
    label: 'Sunrise', clock: '05:52',
    skyTop: '#4b5891', skyHorizon: '#ffb689', sun: '#ffe1b2', sunY: 0.04, sunX: 0.1,
    haze: '#e6a79c', shade: '#291f37', snow: '#ffe8d8', water: '#c89aa7', leaf: '#4b4d52',
    windows: 0.3, stars: 0.05, mist: 0.85,
  },
};

const COLOR_KEYS = ['skyTop', 'skyHorizon', 'sun', 'haze', 'shade', 'snow', 'water', 'leaf'] as const;
const NUMBER_KEYS = ['sunY', 'sunX', 'windows', 'stars', 'mist'] as const;

/** Mix two looks; colours in OKLab, numbers linearly. Labels come from the nearer look. */
export function mixLooks(a: WorldLook, b: WorldLook, k: number): WorldLook {
  const out = { ...(k < 0.5 ? a : b) };
  for (const key of COLOR_KEYS) out[key] = mixHex(a[key], b[key], k);
  for (const key of NUMBER_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

/** How long the light holds still around each scene, as a fraction of the way between two. */
export const HOLD = 0.18;

/** The look at scene position `s` (0 = first scene centred), holding near each scene. */
export function lookAt(scenes: readonly WorldLook[], s: number): WorldLook {
  const n = scenes.length;
  const pos = Math.min(n - 1, Math.max(0, s));
  const i = Math.max(0, Math.min(n - 2, Math.floor(pos)));
  if (n === 1) return scenes[0]!;
  const k = smootherstep((pos - i - HOLD) / (1 - 2 * HOLD));
  return mixLooks(scenes[i]!, scenes[i + 1]!, k);
}

/** UI text over the sky flips to light when the sky is dark. */
export const skyIsDark = (look: WorldLook) => luminance(look.skyTop) < 0.12;

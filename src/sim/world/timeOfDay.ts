/**
 * Time of day: one number drives the whole world's light.
 *
 * t = 0 dawn → 0.3 day → 0.55 golden hour → 0.78 dusk (alpenglow) → 1 night.
 * Pure and renderer-agnostic: colours are linear-sRGB triples so the stage can
 * hand them straight to three.js, and tests can pin continuity.
 */
export type Rgb = readonly [number, number, number];

export interface Light {
  /** Sun (or moon) elevation in degrees above the horizon. */
  sunElev: number;
  /** Sun azimuth in degrees; 0 = straight up the valley (towards K2), 90 = right. */
  sunAzim: number;
  sunColor: Rgb;
  sunIntensity: number;
  skyTop: Rgb;
  skyHorizon: Rgb;
  /** Ground bounce for the hemisphere light. */
  ground: Rgb;
  hemiIntensity: number;
  hazeColor: Rgb;
  /** 0..1 — how much of the haze colour the far distance reaches. */
  hazeMax: number;
  /** Metres for the haze to reach ~63% of hazeMax. */
  hazeDist: number;
  /** Emissive multipliers. */
  windows: number;
  lanterns: number;
  fireflies: number;
  stars: number;
  /** Pink/gold glow on high snow. */
  alpenglow: number;
  alpenglowColor: Rgb;
  bloom: number;
  exposure: number;
}

export type LookName = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';

/** Where each look sits on the 0..1 dial. */
export const LOOK_STOPS: Readonly<Record<LookName, number>> = {
  dawn: 0,
  day: 0.3,
  golden: 0.55,
  dusk: 0.78,
  night: 1,
};

const hex = (h: string): Rgb => {
  const n = Number.parseInt(h.replace('#', ''), 16);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [toLin((n >> 16) & 255), toLin((n >> 8) & 255), toLin(n & 255)];
};

export const LOOKS: Readonly<Record<LookName, Light>> = {
  dawn: {
    sunElev: 6, sunAzim: 75, sunColor: hex('#ffbf94'), sunIntensity: 2.1,
    skyTop: hex('#a1b4d6'), skyHorizon: hex('#e4d6d6'), ground: hex('#6b7f5a'), hemiIntensity: 1.85,
    hazeColor: hex('#b8bccb'), hazeMax: 0.36, hazeDist: 1700,
    windows: 0.6, lanterns: 1.2, fireflies: 0, stars: 0.05, alpenglow: 0.55, alpenglowColor: hex('#ffb38c'),
    bloom: 0.35, exposure: 1.0,
  },
  day: {
    sunElev: 48, sunAzim: 145, sunColor: hex('#fff4e6'), sunIntensity: 3.2,
    skyTop: hex('#7db0e8'), skyHorizon: hex('#d3e5f3'), ground: hex('#7d955f'), hemiIntensity: 2.0,
    hazeColor: hex('#a9c8e6'), hazeMax: 0.42, hazeDist: 3200,
    windows: 0, lanterns: 0, fireflies: 0, stars: 0, alpenglow: 0, alpenglowColor: hex('#ffffff'),
    bloom: 0.15, exposure: 1.2,
  },
  golden: {
    sunElev: 10, sunAzim: 245, sunColor: hex('#ffb766'), sunIntensity: 3.1,
    skyTop: hex('#86a6d4'), skyHorizon: hex('#f3d3a1'), ground: hex('#7a7c4f'), hemiIntensity: 1.7,
    hazeColor: hex('#e2c193'), hazeMax: 0.42, hazeDist: 1800,
    windows: 0.4, lanterns: 0.6, fireflies: 0, stars: 0, alpenglow: 0.45, alpenglowColor: hex('#ffc56e'),
    bloom: 0.3, exposure: 1.1,
  },
  dusk: {
    sunElev: 1.8, sunAzim: 262, sunColor: hex('#ff8f8a'), sunIntensity: 1.5,
    skyTop: hex('#4b4f86'), skyHorizon: hex('#bfa1b0'), ground: hex('#4b4a5c'), hemiIntensity: 1.55,
    hazeColor: hex('#77739a'), hazeMax: 0.46, hazeDist: 1500,
    windows: 4, lanterns: 5, fireflies: 1.5, stars: 0.25, alpenglow: 1.0, alpenglowColor: hex('#ff9db0'),
    bloom: 0.75, exposure: 1.05,
  },
  night: {
    sunElev: 30, sunAzim: 215, sunColor: hex('#b3c4ff'), sunIntensity: 0.7,
    skyTop: hex('#0a1022'), skyHorizon: hex('#2b3e6b'), ground: hex('#1b2233'), hemiIntensity: 1.6,
    hazeColor: hex('#1c2748'), hazeMax: 0.45, hazeDist: 1500,
    windows: 8, lanterns: 9, fireflies: 8, stars: 1, alpenglow: 0.12, alpenglowColor: hex('#c9d6ff'),
    bloom: 1.0, exposure: 1.15,
  },
};

const ORDER: readonly LookName[] = ['dawn', 'day', 'golden', 'dusk', 'night'];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Smootherstep: zero first and second derivative at the ends — light never "kinks" between stops. */
const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Interpolate azimuth the short way round. */
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + 540) % 360) - 180;
  if (d === -180) d = 180;
  return a + d * t;
};

/** Which two stops bracket t, and how far between them. */
export function bracket(t: number): { from: LookName; to: LookName; k: number } {
  const x = clamp01(t);
  for (let i = 0; i < ORDER.length - 1; i++) {
    const from = ORDER[i] as LookName;
    const to = ORDER[i + 1] as LookName;
    const a = LOOK_STOPS[from];
    const b = LOOK_STOPS[to];
    if (x <= b) return { from, to, k: b === a ? 0 : (x - a) / (b - a) };
  }
  return { from: 'dusk', to: 'night', k: 1 };
}

/** The light at dial position t ∈ [0, 1]. */
export function lightAt(t: number): Light {
  const { from, to, k } = bracket(t);
  const a = LOOKS[from];
  const b = LOOKS[to];
  const e = ease(k);
  return {
    sunElev: lerp(a.sunElev, b.sunElev, e),
    sunAzim: lerpAngle(a.sunAzim, b.sunAzim, e),
    sunColor: lerpRgb(a.sunColor, b.sunColor, e),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, e),
    skyTop: lerpRgb(a.skyTop, b.skyTop, e),
    skyHorizon: lerpRgb(a.skyHorizon, b.skyHorizon, e),
    ground: lerpRgb(a.ground, b.ground, e),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, e),
    hazeColor: lerpRgb(a.hazeColor, b.hazeColor, e),
    hazeMax: lerp(a.hazeMax, b.hazeMax, e),
    hazeDist: lerp(a.hazeDist, b.hazeDist, e),
    windows: lerp(a.windows, b.windows, e),
    lanterns: lerp(a.lanterns, b.lanterns, e),
    fireflies: lerp(a.fireflies, b.fireflies, e),
    stars: lerp(a.stars, b.stars, e),
    alpenglow: lerp(a.alpenglow, b.alpenglow, e),
    alpenglowColor: lerpRgb(a.alpenglowColor, b.alpenglowColor, e),
    bloom: lerp(a.bloom, b.bloom, e),
    exposure: lerp(a.exposure, b.exposure, e),
  };
}

/** Unit vector pointing *towards* the sun, in three's frame (y up, -z = up the valley towards K2). */
export function sunDirection(light: Pick<Light, 'sunElev' | 'sunAzim'>): [number, number, number] {
  const el = (light.sunElev * Math.PI) / 180;
  const az = (light.sunAzim * Math.PI) / 180;
  // Blender frame: x right, y up-valley, z up.  three: (x, z, -y).
  const bx = Math.sin(az) * Math.cos(el);
  const by = Math.cos(az) * Math.cos(el);
  const bz = Math.sin(el);
  return [bx, bz, -by];
}

/** The nearest named look — for the sun dial's labels. */
export function nearestLook(t: number): LookName {
  let best: LookName = 'dawn';
  let bestD = Infinity;
  for (const name of ORDER) {
    const d = Math.abs(LOOK_STOPS[name] - clamp01(t));
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/**
 * The sky's fill light: a cosine-weighted sky is mostly zenith, so the fill leans towards the
 * top colour — which keeps foliage cool and green rather than olive under a warm low sun.
 */
export function fillColor(l: Pick<Light, 'skyTop' | 'skyHorizon'>): Rgb {
  return [
    l.skyTop[0] * 0.7 + l.skyHorizon[0] * 0.3,
    l.skyTop[1] * 0.7 + l.skyHorizon[1] * 0.3,
    l.skyTop[2] * 0.7 + l.skyHorizon[2] * 0.3,
  ];
}


/**
 * How much each look contributes at dial position t, in LOOK order (dawn … night), with
 * the same easing as `lightAt` — so baked per-look data (shadows) blends in step with the light.
 */
export function lookWeights(t: number): [number, number, number, number, number] {
  const { from, to, k } = bracket(t);
  const e = ease(k);
  const w: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  w[ORDER.indexOf(from)]! += 1 - e;
  w[ORDER.indexOf(to)]! += e;
  return w;
}

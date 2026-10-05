/**
 * Quality tiers. The boot heuristic picks one; the frame-rate monitor can only step it down.
 * `static` means no WebGL at all: Blender posters + DOM.
 */
export type Tier = 'high' | 'mid' | 'low' | 'static';

export const TIERS: readonly Tier[] = ['high', 'mid', 'low', 'static'];

export interface DeviceHints {
  /** `?tier=` override from the URL, if any. */
  override?: string | null;
  webgl2: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  coarsePointer: boolean;
  cores: number;
  memoryGb?: number;
  viewportWidth: number;
  /** UNMASKED_RENDERER_WEBGL, when the browser shares it. */
  renderer?: string;
}

export interface TierBudget {
  dpr: number;
  grass: number;
  trees: number;
  shadows: boolean;
  bloom: boolean;
  tiltShift: boolean;
  bustPoints: number;
}

export const BUDGETS: Readonly<Record<Tier, TierBudget>> = {
  high: { dpr: 1.75, grass: 60000, trees: 2600, shadows: true, bloom: true, tiltShift: true, bustPoints: 120000 },
  mid: { dpr: 1.5, grass: 24000, trees: 2600, shadows: false, bloom: true, tiltShift: true, bustPoints: 60000 },
  low: { dpr: 1, grass: 0, trees: 1300, shadows: false, bloom: false, tiltShift: false, bustPoints: 25000 },
  static: { dpr: 1, grass: 0, trees: 0, shadows: false, bloom: false, tiltShift: false, bustPoints: 0 },
};

const isTier = (v: unknown): v is Tier => typeof v === 'string' && (TIERS as readonly string[]).includes(v);

const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render/i;
const STRONG_GPU = /nvidia|geforce|rtx|radeon rx|apple m[1-9]|apple gpu/i;

/** Pick a starting tier. Never throws; when unsure it picks the cheaper option. */
export function pickTier(h: DeviceHints): Tier {
  if (isTier(h.override)) return h.override;
  if (!h.webgl2 || h.saveData) return 'static';
  if (h.renderer && SOFTWARE_GPU.test(h.renderer)) return 'low';
  if (h.coarsePointer || h.viewportWidth < 820) return h.cores >= 8 && (h.memoryGb ?? 4) >= 6 ? 'mid' : 'low';
  if (h.renderer && STRONG_GPU.test(h.renderer) && h.cores >= 8) return 'high';
  if (h.cores <= 4 || (h.memoryGb ?? 8) < 4) return 'low';
  return 'mid';
}

/** One step cheaper, used by the frame-rate monitor. `static` is never reached by degradation. */
export function stepDown(tier: Tier): Tier {
  if (tier === 'high') return 'mid';
  if (tier === 'mid') return 'low';
  return tier;
}

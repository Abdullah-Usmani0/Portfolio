import { pickTier, type DeviceHints, type Tier } from '@/sim/device/tier.ts';

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Probe WebGL2 once with a throwaway canvas; report the GPU string when the browser shares it. */
function probeGl(): { webgl2: boolean; renderer?: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return { webgl2: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : undefined;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return renderer ? { webgl2: true, renderer } : { webgl2: true };
  } catch {
    return { webgl2: false };
  }
}

/** Gather what the browser tells us and let the pure policy decide. Never throws. */
export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'static';
  const nav = navigator as Navigator & NavigatorHints;
  const hints: DeviceHints = {
    override: new URLSearchParams(window.location.search).get('tier'),
    ...probeGl(),
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: nav.connection?.saveData ?? false,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    cores: nav.hardwareConcurrency || 4,
    viewportWidth: window.innerWidth,
    ...(nav.deviceMemory ? { memoryGb: nav.deviceMemory } : {}),
  };
  return pickTier(hints);
}

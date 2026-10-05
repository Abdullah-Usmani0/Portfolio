import { ShaderChunk } from 'three';

let installed = false;

/** Height (m) of the valley floor, where the haze is thickest. */
export const HAZE_BASE = 0;
/** Scale height (m): every 650 m of altitude the haze thins by a factor of e. */
export const HAZE_SCALE_HEIGHT = 650;

/**
 * Atmospheric perspective with altitude: the valley sits in haze while K2's summit stands
 * clear above it. It extends the Blender look-dev's haze node,
 *   haze = hazeMax * (1 - exp(-opticalDepth / hazeDist)),
 * where the optical depth integrates an exponential-height density along the view ray
 * (analytically — no ray marching). Three's linear Fog uniforms carry the look:
 * `fog.near` is hazeMax and `fog.far` is hazeDist. Patching the shared chunks once gives
 * every built-in and custom material the same haze.
 */
export function installHaze(): void {
  if (installed) return;
  installed = true;
  const linear = 'float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );';
  const parsV = 'varying float vFogDepth;';
  const vert = 'vFogDepth = - mvPosition.z;';
  if (
    !ShaderChunk.fog_fragment.includes(linear) ||
    !ShaderChunk.fog_pars_vertex.includes(parsV) ||
    !ShaderChunk.fog_pars_fragment.includes(parsV) ||
    !ShaderChunk.fog_vertex.includes(vert)
  ) {
    console.warn('[haze] three fog chunks changed; falling back to linear fog');
    return;
  }
  ShaderChunk.fog_pars_vertex = ShaderChunk.fog_pars_vertex.replace(parsV, `${parsV}\n\tvarying float vFogHeight;`);
  ShaderChunk.fog_pars_fragment = ShaderChunk.fog_pars_fragment.replace(parsV, `${parsV}\n\tvarying float vFogHeight;`);
  // World height from the view-space position: w = Rᵀ (v − t) for a view matrix [R | t].
  ShaderChunk.fog_vertex = ShaderChunk.fog_vertex.replace(
    vert,
    `${vert}\n\tvFogHeight = ( transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) ).y;`,
  );
  ShaderChunk.fog_fragment = ShaderChunk.fog_fragment.replace(
    linear,
    /* glsl */ `
	float hzA = max( cameraPosition.y - ${HAZE_BASE.toFixed(1)}, 0.0 );
	float hzB = max( vFogHeight - ${HAZE_BASE.toFixed(1)}, 0.0 );
	float hzDh = hzB - hzA;
	float hzK = abs( hzDh ) > 1.0
		? ( exp( - hzA / ${HAZE_SCALE_HEIGHT.toFixed(1)} ) - exp( - hzB / ${HAZE_SCALE_HEIGHT.toFixed(1)} ) ) * ${HAZE_SCALE_HEIGHT.toFixed(1)} / hzDh
		: exp( - hzA / ${HAZE_SCALE_HEIGHT.toFixed(1)} );
	float fogFactor = fogNear * ( 1.0 - exp( - vFogDepth * hzK / max( fogFar, 1.0 ) ) );`,
  );
}

/** The same haze in TypeScript — for tests, and for anything that needs it on the CPU. */
export function hazeAt(hazeMax: number, hazeDist: number, distance: number, camY: number, pointY: number): number {
  const a = Math.max(camY - HAZE_BASE, 0);
  const b = Math.max(pointY - HAZE_BASE, 0);
  const dh = b - a;
  const k = Math.abs(dh) > 1 ? ((Math.exp(-a / HAZE_SCALE_HEIGHT) - Math.exp(-b / HAZE_SCALE_HEIGHT)) * HAZE_SCALE_HEIGHT) / dh : Math.exp(-a / HAZE_SCALE_HEIGHT);
  return hazeMax * (1 - Math.exp((-distance * k) / Math.max(hazeDist, 1)));
}

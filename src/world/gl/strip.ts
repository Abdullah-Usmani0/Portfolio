import * as THREE from 'three';
import type { Relight } from '../scenery/relight.ts';
import { shared } from './flat.ts';

/** How a rendered strip is drawn: its depth's haze, its wind, and how far down it darkens. */
export interface StripLook {
  /** Share of the haze's colour the strip takes (aerial perspective). */
  haze: number;
  /** How far its treetops sway, in world units. */
  sway: number;
  /** Below the edge it darkens from `shadeY1` (none) to `shadeY0` (to `shadeFloor`), measured from the ground's lift. */
  shadeY0: number;
  shadeY1: number;
  shadeFloor: number;
  /** Degrees above eye level the strip stands at, for the low sun's last light (see relight.glowDeg). */
  deg: number;
  /** How far below its edge (`aEdge`) the strip fades out into the painted ground, from–to; none if unset. */
  fade?: [number, number];
}

/**
 * One tile of a foreground layer rendered in Blender (blender/foreground_render.py), relit for
 * the hour. Its light texture holds the tile lit three ways, stacked top to bottom (a low sun
 * from the left, one from the right, the open sky), as the square roots of linear light; its
 * mask stacks coverage and how far each point sways. Light is premultiplied by coverage.
 * `rows` is one image's height and `pad` the gap between them, in pixels. With `aLift` on its
 * vertices (the ground's climb), the shade gradient follows the ground up the mountain; with
 * `aEdge` (the ground's edge), it fades out a set depth below the edge (StripLook.fade).
 */
export function stripMaterial(light: THREE.Texture, mask: THREE.Texture, o: { scale: number; rows: number; pad: number; width: number; look: StripLook }) {
  const lightTotal = 3 * o.rows + 2 * o.pad;
  const maskTotal = 2 * o.rows + o.pad;
  const uniforms = {
    uLight: { value: light },
    uMask: { value: mask },
    uScale: { value: o.scale },
    uSun: { value: new THREE.Vector3() },
    uSky: { value: new THREE.Vector3() },
    uSide: { value: new THREE.Vector2(0.5, 0.5) },
    uHaze: { value: new THREE.Vector3() },
    uHazeAmount: { value: o.look.haze },
    uLit: { value: 1 },
    uShade: { value: new THREE.Vector3(o.look.shadeY0, o.look.shadeY1, o.look.shadeFloor) },
    uFade: { value: new THREE.Vector2(...(o.look.fade ?? [0, 0])) },
    uSway: { value: o.look.sway / o.width },
    uOpacity: { value: 0 },
    uTime: shared.uTime,
    uLightSlot: { value: new THREE.Vector2(o.rows / lightTotal, (o.rows + o.pad) / lightTotal) },
    uMaskSlot: { value: new THREE.Vector2(o.rows / maskTotal, (o.rows + o.pad) / maskTotal) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aLift;
      attribute float aEdge;
      varying vec2 vUv;
      varying vec2 vPos;
      varying float vLift;
      varying float vEdge;
      void main() {
        vUv = uv;
        vPos = position.xy;
        vLift = aLift;
        vEdge = aEdge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLight;
      uniform sampler2D uMask;
      uniform float uScale;
      uniform vec3 uSun;
      uniform vec3 uSky;
      uniform vec2 uSide;
      uniform vec3 uHaze;
      uniform float uHazeAmount;
      uniform float uLit;
      uniform vec3 uShade;
      uniform vec2 uFade;
      uniform float uSway;
      uniform float uOpacity;
      uniform float uTime;
      uniform vec2 uLightSlot;
      uniform vec2 uMaskSlot;
      varying vec2 vUv;
      varying vec2 vPos;
      varying float vLift;
      varying float vEdge;
      // The k-th image of a stack (0 the top), at uv; slot = (one image's share, step to the next).
      vec4 slot(sampler2D tex, vec2 s, float k, vec2 uv) {
        return texture2D(tex, vec2(uv.x, 1.0 - k * s.y - (1.0 - uv.y) * s.x));
      }
      vec3 srgb(vec3 c) {
        c = max(c, 0.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        // The wind: what sways is drawn from a little upwind, more the higher up a tree it is.
        float w = slot(uMask, uMaskSlot, 1.0, vUv).r;
        float gust = sin(uTime * 0.9 + vPos.x * 0.004) * 0.6 + 0.4;
        vec2 uv = vUv - vec2(w * uSway * gust * sin(uTime * 1.7 + vPos.x * 0.05), 0.0);
        float m = slot(uMask, uMaskSlot, 0.0, uv).r;
        float a = m * uOpacity;
        // Deep below its edge the strip gives way to the painted ground, along a line that
        // follows the edge, so no tile's lower end ever shows.
        if (uFade.y > 0.0) a *= 1.0 - smoothstep(uFade.x, uFade.y, vEdge - vPos.y);
        if (a < 0.003) discard;
        vec3 l = slot(uLight, uLightSlot, 0.0, uv).rgb;
        vec3 r = slot(uLight, uLightSlot, 1.0, uv).rgb;
        vec3 s = slot(uLight, uLightSlot, 2.0, uv).rgb;
        l = l * l * uScale;
        r = r * r * uScale;
        s = s * s * uScale;
        vec3 c = uSun * (uSide.x * l + uSide.y * r) * uLit + uSky * s;
        // Down the bank's face, away from its lit edge, the ground falls into shade.
        float down = smoothstep(uShade.x, uShade.y, vPos.y - vLift);
        vec3 u = c / max(m, 0.004) * mix(uShade.z, 1.0, down);
        u = mix(u, uHaze, uHazeAmount);
        u = srgb(u);
        u = mix(u, u * u * (3.0 - 2.0 * u), 0.35);
        u += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(u * a, a);
      }`,
  });
  return {
    material,
    uniforms,
    /** Light the tile for the hour; `deg` is how high the strip stands (see StripLook.deg). */
    set(r: Relight, haze: number, deg: number) {
      uniforms.uSun.value.set(...r.sun);
      uniforms.uSky.value.set(...r.sky);
      uniforms.uSide.value.set(r.left, r.right);
      uniforms.uHaze.value.set(...r.haze);
      uniforms.uHazeAmount.value = haze;
      // The low sun's last light leaves the valley before the summits.
      const t = Math.min(1, Math.max(0, (deg - (r.glowDeg - 2.5)) / 5));
      uniforms.uLit.value = t * t * (3 - 2 * t);
    },
  };
}

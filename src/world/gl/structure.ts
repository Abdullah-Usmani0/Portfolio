import * as THREE from 'three';
import type { Relight } from '../scenery/relight.ts';

/** Where the k-th image of a stack is read (0 the top); textures are stored top row first. */
const SLOT = /* glsl */ `
  vec4 slot(sampler2D tex, float k) {
    return texture2D(tex, vec2(vUv.x, k * uSlot.y + (1.0 - vUv.y) * uSlot.x));
  }`;

/** A stack of `count` images `rows` high, `pad` rows apart: one image's height, and the step to the next. */
const slotUniform = (rows: number, pad: number, count: number) => {
  const total = count * rows + (count - 1) * pad;
  return new THREE.Vector2(rows / total, (rows + pad) / total);
};

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** How lit the low sun leaves something standing at `deg` (see StripLook.deg): 0 once it has set there. */
const sunLit = (r: Relight, deg: number) => {
  const t = Math.min(1, Math.max(0, (deg - (r.glowDeg - 2.5)) / 5));
  return t * t * (3 - 2 * t);
};

/**
 * A building rendered in Blender (blender/structures_render.py), relit for the hour. Its light
 * texture stacks four images top to bottom: lit by a low sun from the left, from the right, by
 * the open sky, and by its own windows (as square roots of linear light, premultiplied by how
 * much of the texel it covers, which is the alpha). `rows` is one image's height and `pad` the
 * gap between them, in pixels.
 */
export function structureMaterial(light: THREE.Texture, o: { scale: number; rows: number; pad: number }) {
  const uniforms = {
    uLight: { value: light },
    uScale: { value: o.scale },
    uSun: { value: new THREE.Vector3() },
    uSky: { value: new THREE.Vector3() },
    uWin: { value: new THREE.Vector3() },
    uSide: { value: new THREE.Vector2(0.5, 0.5) },
    uLit: { value: 1 },
    uOpacity: { value: 0 },
    uSlot: { value: slotUniform(o.rows, o.pad, 4) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    vertexShader: VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLight;
      uniform float uScale;
      uniform vec3 uSun;
      uniform vec3 uSky;
      uniform vec3 uWin;
      uniform vec2 uSide;
      uniform float uLit;
      uniform float uOpacity;
      uniform vec2 uSlot;
      varying vec2 vUv;
      ${SLOT}
      vec3 light(vec4 v) { return v.rgb * v.rgb * uScale; }
      vec3 srgb(vec3 c) {
        c = max(c, 0.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        vec4 left = slot(uLight, 0.0);
        float cover = left.a;
        float a = cover * uOpacity;
        if (a < 0.003) discard;
        vec3 c = uSun * (uSide.x * light(left) + uSide.y * light(slot(uLight, 1.0))) * uLit + uSky * light(slot(uLight, 2.0)) + uWin * light(slot(uLight, 3.0));
        vec3 u = srgb(c / max(cover, 0.004));
        u = mix(u, u * u * (3.0 - 2.0 * u), 0.35);
        u += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(u * a, a);
      }`,
  });
  return {
    material,
    uniforms,
    /** Light it for the hour; `deg` is how high it stands (see StripLook.deg), `windows` how lit its windows are. */
    set(r: Relight, deg: number, windows: THREE.Color) {
      uniforms.uSun.value.set(...r.sun);
      uniforms.uSky.value.set(...r.sky);
      uniforms.uSide.value.set(r.left, r.right);
      uniforms.uWin.value.set(windows.r, windows.g, windows.b);
      uniforms.uLit.value = sunLit(r, deg);
    },
  };
}

/**
 * The shadows a rendered building casts on the ground around it, drawn as darkening. Its
 * texture stacks how much of the left sun, the right sun and the sky the ground still gets
 * there (1 in the open); `ground` is how bright open ground is under the sun and under the
 * sky, which weighs one against the other.
 */
export function shadowMaterial(mask: THREE.Texture, o: { rows: number; pad: number; ground: { sun: number; sky: number } }) {
  const uniforms = {
    uMask: { value: mask },
    uSun: { value: 0 },
    uSky: { value: 0 },
    uSide: { value: new THREE.Vector2(0.5, 0.5) },
    uGround: { value: new THREE.Vector2(o.ground.sun, o.ground.sky) },
    uShadow: { value: 0.8 },
    uOpacity: { value: 0 },
    uSlot: { value: slotUniform(o.rows, o.pad, 3) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    vertexShader: VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMask;
      uniform float uSun;
      uniform float uSky;
      uniform vec2 uSide;
      uniform vec2 uGround;
      uniform float uShadow;
      uniform float uOpacity;
      uniform vec2 uSlot;
      varying vec2 vUv;
      ${SLOT}
      void main() {
        float sunW = uSun * uGround.x;
        float skyW = uSky * uGround.y;
        float ratio = (sunW * (uSide.x * slot(uMask, 0.0).r + uSide.y * slot(uMask, 1.0).r) + skyW * slot(uMask, 2.0).r) / max(sunW + skyW, 1e-5);
        float a = (1.0 - ratio) * uShadow * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
      }`,
  });
  const lum = (c: readonly [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return {
    material,
    uniforms,
    /** Weigh the sun's shadows against the sky's for the hour, as the building is lit. */
    set(r: Relight, deg: number) {
      uniforms.uSun.value = lum(r.sun) * sunLit(r, deg);
      uniforms.uSky.value = lum(r.sky);
      uniforms.uSide.value.set(r.left, r.right);
    },
  };
}

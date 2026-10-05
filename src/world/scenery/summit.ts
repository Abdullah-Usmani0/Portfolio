import * as THREE from 'three';
import { mixHex } from '@/motion/color.ts';
import { shared } from '../gl/flat.ts';
import { pointScale } from '../gl/sprites.ts';
import { cutUniform, Painter, paletteMaterial } from './cutaway.ts';
import { summitRidgeY } from './climbLayout.ts';
import type { Frame } from './types.ts';

const LIME = '#b9ef2e';
const FLAG = { w: 46, h: 27, pole: 84, cols: 14 } as const;

/** Snow torn off the summit by the wind, streaming downwind and thinning out. */
function plume(x: number, y: number, count = 70) {
  const origin = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    origin.set([x - 8 + (i % 7) * 3, y + 2 + (i % 5) * 2, 0], i * 3);
    seed[i] = i / count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(origin, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0.3 }, uTime: shared.uTime, uScale: pointScale };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vLife;
      void main() {
        float t = fract(uTime * 0.045 + aSeed);
        vLife = t;
        vec3 p = position;
        p.x += t * 300.0 + sin(aSeed * 91.0) * 10.0 * t;
        p.y += t * 26.0 + sin(t * 6.0 + aSeed * 37.0) * 9.0 * t - t * t * 40.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (5.0 + t * 54.0) * uScale;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * smoothstep(0.0, 0.08, vLife) * (1.0 - vLife) * uAlpha;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  return { points, uniforms };
}

/**
 * On top of the world at sunrise: a lime flag snapping in the wind on the summit, a climber
 * beside it with an ice axe raised, and a plume of snow blowing off the top.
 */
export function summitProps(group: THREE.Group, peak: { x: number; y: number }) {
  // The pole and the climber, painted flat; the hour picks their colours.
  const SLOT = { dark: 0, jacket: 1, pack: 2, metal: 3 } as const;
  const paint = new Painter(() => false);
  const ground = (x: number) => summitRidgeY(x);
  paint.rect(peak.x - 1.3, peak.y - 3, peak.x + 1.3, peak.y + FLAG.pole, SLOT.metal);
  paint.disc(peak.x, peak.y + FLAG.pole + 1.5, 2.4, SLOT.metal, 10);

  const cx = peak.x - 36;
  const g = ground(cx);
  // Legs braced on the slope, boots on the snow.
  paint.bar(cx - 1.5, g + 15, cx - 6, ground(cx - 6) + 1, 4.4, SLOT.dark);
  paint.bar(cx + 1.5, g + 15, cx + 5, ground(cx + 5) + 1, 4.4, SLOT.dark);
  // Body in a down suit, a pack on the back, a hood.
  paint.bar(cx, g + 14, cx + 0.6, g + 27, 9, SLOT.jacket);
  paint.rect(cx - 9, g + 15, cx - 3.5, g + 27, SLOT.pack);
  paint.disc(cx + 0.8, g + 31, 3.9, SLOT.jacket, 12);
  // One arm down, one raised with the axe.
  paint.bar(cx - 2, g + 25, cx - 5, g + 15, 3.2, SLOT.jacket);
  paint.bar(cx + 2.5, g + 25.5, cx + 9, g + 37, 3.2, SLOT.jacket);
  paint.bar(cx + 9, g + 35, cx + 11, g + 49, 1.6, SLOT.metal);
  paint.bar(cx + 7, g + 48.5, cx + 15.5, g + 47, 2, SLOT.metal);

  const cut = cutUniform(1);
  const palette = paletteMaterial(cut, 4);
  const props = paint.mesh(palette.material);
  props.position.z = 0.3;
  group.add(props);

  // The flag: a strip of cloth whose free end ripples in the wind, shaded in its folds.
  const n = FLAG.cols;
  const pos = new Float32Array(n * 2 * 3);
  const col = new Float32Array(n * 2 * 3);
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  flagGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  flagGeo.setIndex(index);
  const flagMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.frustumCulled = false;
  flag.position.z = 0.31;
  group.add(flag);
  const lime = new THREE.Color();
  const shade = new THREE.Color();
  const tmp = new THREE.Color();

  const snow = plume(peak.x + 4, peak.y + 4);
  snow.points.position.z = 0.25;
  group.add(snow.points);

  return (f: Frame) => {
    const { look, time } = f;
    // Only worth drawing when the summit is near the screen.
    const near = Math.abs(f.camX - peak.x) < f.viewW * 1.2;
    props.visible = flag.visible = snow.points.visible = near;
    if (!near) return;
    palette.colors[SLOT.dark]!.set(mixHex(look.shade, '#000000', 0.15));
    palette.colors[SLOT.jacket]!.set(mixHex('#c2402c', look.shade, 0.62));
    palette.colors[SLOT.pack]!.set(mixHex('#d98b2b', look.shade, 0.66));
    palette.colors[SLOT.metal]!.set(mixHex(look.shade, look.snow, 0.25));

    // The first sun catches the flag; at night it still glows a little.
    lime.set(mixHex(LIME, look.sun, 0.12));
    shade.set(mixHex(LIME, look.shade, 0.5));
    const top = peak.y + FLAG.pole;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const phase = time * 5.4 - u * 6.2;
      const wave = Math.sin(phase) * 4.4 * u + Math.sin(time * 11 - u * 13) * 1.2 * u;
      const x = peak.x + 1.3 + u * FLAG.w - u * u * 2.5 * (1 + Math.sin(phase));
      const droop = u * u * 3;
      pos.set([x, top + wave - droop * 0.4, 0, x, top - FLAG.h + wave - droop], i * 6);
      tmp.copy(shade).lerp(lime, 0.62 + 0.38 * Math.cos(phase));
      col.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], i * 6);
    }
    flagGeo.getAttribute('position').needsUpdate = true;
    flagGeo.getAttribute('color').needsUpdate = true;

    snow.uniforms.uColor.value.set(mixHex(look.snow, look.skyHorizon, 0.35));
    snow.uniforms.uAlpha.value = 0.34;
  };
}

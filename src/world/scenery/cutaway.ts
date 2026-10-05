import * as THREE from 'three';
import type { Anchor } from '../anchors.ts';

/**
 * Buildings whose front wall can fall away. Everything is painted into one mesh with a
 * small palette of colour slots the hour re-tints; each triangle remembers which building's
 * cutaway hides it, so a dive can open one building and leave the rest standing.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Painter {
  pos: number[] = [];
  slot: number[] = [];
  /** Per vertex: the building (index + 1) whose cutaway hides it, or 0. */
  cut: number[] = [];
  /** The building being painted (index + 1), and each one's frame for the camera. */
  private building = 0;
  boxes: Box[] = [];
  /** Off while painting things the camera should not frame, like a radio mast. */
  framing = true;

  /** `opens` says which slots are front wall, and fall away in a cutaway. */
  constructor(private readonly opens: (slot: number) => boolean) {}

  begin(k: number) {
    this.building = k + 1;
    this.boxes[k] = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  }

  /** Stop painting into a building: what follows never falls away. */
  end() {
    this.building = 0;
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, s: number, opens = this.opens(s)) {
    // Wind every triangle anticlockwise, so it faces the camera whichever way it was given.
    if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) this.pos.push(ax, ay, 0, cx, cy, 0, bx, by, 0);
    else this.pos.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
    this.slot.push(s, s, s);
    const c = opens ? this.building : 0;
    this.cut.push(c, c, c);
    const box = this.building && this.framing ? this.boxes[this.building - 1] : undefined;
    if (box) {
      box.x0 = Math.min(box.x0, ax, bx, cx);
      box.x1 = Math.max(box.x1, ax, bx, cx);
      box.y0 = Math.min(box.y0, ay, by, cy);
      box.y1 = Math.max(box.y1, ay, by, cy);
    }
  }

  rect(x0: number, y0: number, x1: number, y1: number, s: number, opens = this.opens(s)) {
    this.tri(x0, y0, x1, y0, x1, y1, s, opens);
    this.tri(x0, y0, x1, y1, x0, y1, s, opens);
  }

  /** A half-disc (dome) sitting on y. */
  dome(cx: number, y: number, r: number, s: number, opens = this.opens(s)) {
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a0 = (Math.PI * i) / n;
      const a1 = (Math.PI * (i + 1)) / n;
      this.tri(cx, y, cx + Math.cos(a0) * r, y + Math.sin(a0) * r, cx + Math.cos(a1) * r, y + Math.sin(a1) * r, s, opens);
    }
  }

  quadPoints(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, s: number, opens = this.opens(s)) {
    this.tri(ax, ay, bx, by, cx, cy, s, opens);
    this.tri(ax, ay, cx, cy, dx, dy, s, opens);
  }

  /** A thin bar from a to b. */
  bar(ax: number, ay: number, bx: number, by: number, w: number, s: number, opens = this.opens(s)) {
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * (w / 2);
    const ny = (dx / l) * (w / 2);
    this.quadPoints(ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny, s, opens);
  }

  disc(cx: number, cy: number, r: number, s: number, n = 16, opens = this.opens(s)) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.tri(cx, cy, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, s, opens);
    }
  }

  mesh(material: THREE.ShaderMaterial) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aSlot', new THREE.Float32BufferAttribute(this.slot, 1));
    g.setAttribute('aCut', new THREE.Float32BufferAttribute(this.cut, 1));
    return new THREE.Mesh(g, material);
  }
}

/** How open each building's cutaway is (0 = shut, 1 = the front wall gone). */
export const cutUniform = (buildings: number) => ({ value: Array.from({ length: buildings }, () => 0) });

/** GLSL: how far this vertex's wall has fallen away. */
export const cutGlsl = (buildings: number) => /* glsl */ `
  attribute float aCut;
  uniform float uCut[${buildings}];
  float openness() { return aCut > 0.5 ? uCut[int(aCut - 0.5)] : 0.0; }`;

/** Flat colours by slot, with front walls fading to a ghost of themselves as they open. */
export function paletteMaterial(cut: { value: number[] }, slots: number) {
  const colors = Array.from({ length: slots }, () => new THREE.Color());
  const material = new THREE.ShaderMaterial({
    uniforms: { uColors: { value: colors }, uCut: cut },
    transparent: true,
    vertexShader: /* glsl */ `
      attribute float aSlot;
      uniform vec3 uColors[${slots}];
      ${cutGlsl(cut.value.length)}
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = uColors[int(aSlot + 0.5)];
        vAlpha = 1.0 - 0.95 * openness();
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() { gl_FragColor = vec4(vColor, vAlpha); }`,
  });
  return { material, colors };
}

/** A box as a camera anchor: its centre and size. */
export const anchorOfBox = (b: Box): Anchor => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, h: b.y1 - b.y0 });

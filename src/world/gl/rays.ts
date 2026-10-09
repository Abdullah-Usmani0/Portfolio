import * as THREE from 'three';

/** The rays are worked out at this fraction of the screen's CSS size, each way: they are soft. */
export const RAY_SCALE = 1 / 3;
/** Steps from each pixel towards the sun. */
const SAMPLES = 40;

/** A screen-filling triangle pair, drawn straight to clip space. */
function pass(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, blend?: THREE.ShaderMaterialParameters) {
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader,
    ...blend,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, material };
}

export interface SunRays {
  resize: (cssW: number, cssH: number) => void;
  /**
   * Before the picture is drawn: draws, small, everything that stands between the viewer and
   * the sky, and streams the sky's light past it, away from the sun. `sun` is where the sun
   * is on screen, 0–1 across and up.
   */
  prepare: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, sky: THREE.Object3D, sun: { x: number; y: number }, time: number) => void;
  /** After the picture is drawn: lays the rays over it, in the sun's colour. */
  composite: (renderer: THREE.WebGLRenderer, color: THREE.Color, strength: number) => void;
  dispose: () => void;
}

/**
 * Light shafts: the sun's light, scattered by the air, streaming out past whatever is in
 * the way. Everything in front of the sky is drawn into a small target as coverage alone;
 * each pixel then looks back along the line to the sun and gathers the open, sunlit sky it
 * crosses, so the shafts take their shape from the real ridges and the gaps between clouds.
 */
export function sunRays(): SunRays {
  const occlusion = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const rays = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  occlusion.texture.minFilter = occlusion.texture.magFilter = THREE.LinearFilter;
  rays.texture.minFilter = rays.texture.magFilter = THREE.LinearFilter;
  occlusion.texture.generateMipmaps = rays.texture.generateMipmaps = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const march = pass(
    /* glsl */ `
      uniform sampler2D uOcclusion;
      uniform vec2 uSun;
      uniform float uAspect;
      uniform float uTime;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(float x) {
        float i = floor(x);
        float f = fract(x);
        return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
      }
      void main() {
        vec2 stride = (uSun - vUv) / float(${SAMPLES}) * 0.94;
        // A different start on neighbouring pixels breaks the steps into grain, not bands.
        vec2 uv = vUv + stride * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        float light = 0.0;
        float weight = 1.0;
        float total = 0.0;
        for (int i = 0; i < ${SAMPLES}; i++) {
          uv += stride;
          vec2 d = (uv - uSun) * vec2(uAspect, 1.0);
          // The bright air round the sun gives off the light: a hot core and a wide warm
          // apron, so a sun behind a ridge still lights the sky above it.
          float glow = exp(-dot(d, d) * 22.0) + 0.45 * exp(-length(d) * 3.2);
          float open = 1.0 - texture2D(uOcclusion, uv).a;
          light += open * glow * weight;
          total += weight;
          weight *= 0.962;
        }
        light /= total;
        // A touch of structure round the sun, slowly turning, where the air is uneven.
        vec2 fromSun = (vUv - uSun) * vec2(uAspect, 1.0);
        float a = atan(fromSun.y, fromSun.x);
        float streaks = 0.78 + 0.22 * noise(a * 18.0 + uTime * 0.05) * noise(a * 7.0 - uTime * 0.03 + 3.0);
        // Seen through haze, faint light carries further than its share: a sun deep behind a
        // ridge still throws its rays over it.
        gl_FragColor = vec4(vec3(pow(light, 0.6) * streaks), 1.0);
      }`,
    {
      uOcclusion: { value: occlusion.texture },
      uSun: { value: new THREE.Vector2() },
      uAspect: { value: 1 },
      uTime: { value: 0 },
    },
  );

  const over = pass(
    /* glsl */ `
      uniform sampler2D uRays;
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float r = texture2D(uRays, vUv).r * uStrength;
        // Dither, so the soft falloff never bands.
        r += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(uColor * max(r, 0.0), 1.0);
      }`,
    {
      uRays: { value: rays.texture },
      uColor: { value: new THREE.Color() },
      uStrength: { value: 0 },
    },
    // Screen blending: the light lifts what is under it and never clips to white.
    {
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneMinusDstColorFactor,
      blendDst: THREE.OneFactor,
    },
  );

  const clear = new THREE.Color();

  return {
    resize(cssW, cssH) {
      const w = Math.max(8, Math.round(cssW * RAY_SCALE));
      const h = Math.max(8, Math.round(cssH * RAY_SCALE));
      occlusion.setSize(w, h);
      rays.setSize(w, h);
      march.material.uniforms.uAspect!.value = cssW / Math.max(1, cssH);
    },
    prepare(renderer, scene, cam, sky, sun, time) {
      renderer.getClearColor(clear);
      const alpha = renderer.getClearAlpha();
      // The sky is left out and the target starts empty: what is drawn is what is in the way.
      sky.visible = false;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(occlusion);
      renderer.render(scene, cam);
      sky.visible = true;
      renderer.setClearColor(clear, alpha);
      march.material.uniforms.uSun!.value.set(sun.x, sun.y);
      march.material.uniforms.uTime!.value = time;
      renderer.setRenderTarget(rays);
      renderer.render(march.scene, camera);
      renderer.setRenderTarget(null);
    },
    composite(renderer, color, strength) {
      over.material.uniforms.uColor!.value.copy(color);
      over.material.uniforms.uStrength!.value = strength;
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(over.scene, camera);
      renderer.autoClear = auto;
    },
    dispose() {
      occlusion.dispose();
      rays.dispose();
      for (const p of [march, over]) {
        p.material.dispose();
        p.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
    },
  };
}

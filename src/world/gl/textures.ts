import * as THREE from 'three';

/**
 * Loading the rendered layers' textures without stalling the page.
 *
 * They are data, not pictures (light, coverage, sway), and there are a lot of them, so:
 * - each is decoded off the main thread (createImageBitmap) where the browser can, and never
 *   colour-managed, so the numbers in it arrive as they were written;
 * - it is stored top row first (flipY off), so shaders read v from the top of the image;
 * - a greyscale one is stored as one 8-bit channel, a quarter of the memory of RGBA;
 * - downloads wait in one queue, nearest the view first, a few at a time, so what is on
 *   screen arrives before what is not, and a texture no longer wanted is dropped unfetched;
 * - and only a few new textures go to the GPU each frame (see `admit`).
 */

/** Downloads in flight at once. */
const IN_FLIGHT = 6;
/**
 * New textures shown (and so uploaded to the GPU) per second, across every layer, and the
 * most in any one frame: two a frame at 60 frames a second; more on a slow frame, so a slow
 * device is not starved, but never all at once.
 */
const PER_SECOND = 120;
const PER_FRAME_MAX = 6;

interface Pending {
  url: string;
  priority: () => number;
  start: () => void;
  cancelled: boolean;
}

const queue: Pending[] = [];
let running = 0;

function pump() {
  while (running < IN_FLIGHT) {
    let best = -1;
    let bestP = Infinity;
    for (let k = queue.length - 1; k >= 0; k--) {
      const q = queue[k]!;
      if (q.cancelled) {
        queue.splice(k, 1);
        continue;
      }
      const p = q.priority();
      if (p <= bestP) {
        bestP = p;
        best = k;
      }
    }
    if (best < 0) return;
    const [next] = queue.splice(best, 1);
    running++;
    next!.start();
  }
}

function settle() {
  running--;
  pump();
}

async function decode(url: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      const blob = await (await fetch(url)).blob();
      return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    } catch {
      // A page whose policy refuses fetch (or an old browser) falls back to an image element.
    }
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

export interface Loading {
  texture: THREE.Texture;
  /** Whether its pixels are in. */
  ready: () => boolean;
  /** Stop waiting for it and free it. */
  dispose: () => void;
}

/**
 * A data texture from `url`. `grey` stores one channel; `mipmaps` keeps them (for a texture
 * drawn smaller than its size). `priority` is asked each time a download slot frees: lower
 * goes first (say, distance from the view).
 */
export function loadTexture(url: string, o: { grey: boolean; mipmaps?: boolean; priority?: () => number }): Loading {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  if (o.grey) texture.format = THREE.RedFormat;
  texture.generateMipmaps = !!o.mipmaps;
  texture.minFilter = o.mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  // Once on the GPU, a decoded bitmap is only a second copy: let it go.
  texture.onUpdate = () => {
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close();
  };
  let ready = false;
  let gone = false;
  const pending: Pending = {
    url,
    priority: o.priority ?? (() => 0),
    cancelled: false,
    start: () => {
      decode(url)
        .then((img) => {
          if (gone) {
            if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
            return;
          }
          texture.image = img;
          texture.needsUpdate = true;
          ready = true;
        })
        .catch(() => {
          // Left unloaded: the painted layer under it keeps showing.
        })
        .finally(settle);
    },
  };
  queue.push(pending);
  pump();
  return {
    texture,
    ready: () => ready,
    dispose() {
      gone = true;
      pending.cancelled = true;
      texture.dispose();
    },
  };
}

let budgetAt = -1;
let budget = 0;

/**
 * May one more loaded texture pair be shown this frame? A shown texture goes to the GPU on
 * the next draw; letting a handful through per frame spreads the uploads instead of
 * stalling one frame for all of them. `time` (seconds) identifies the frame.
 */
export function admit(time: number): boolean {
  if (time !== budgetAt) {
    const dt = budgetAt < 0 ? 1 / 60 : time - budgetAt;
    budgetAt = time;
    budget = Math.min(PER_FRAME_MAX, Math.max(2, Math.round(dt * PER_SECOND)));
  }
  if (budget <= 0) return false;
  budget--;
  return true;
}

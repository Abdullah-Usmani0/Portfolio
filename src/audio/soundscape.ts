/**
 * The valley's sound, drawn in code like everything else: noise shaped into wind, water and a
 * turning windmill, and small synthesized voices for birds, crickets, an owl and the village
 * bell. No files. It runs on a live AudioContext, or on an OfflineAudioContext to render a
 * sample to listen to.
 */
import { LAYERS, type Layer, type Levels } from './mix.ts';

/** How loud each layer is at full level, so that their mix, not their raw noise, decides the balance. */
const VOICE: Readonly<Record<Layer, number>> = {
  wind: 1.0,
  river: 0.7,
  waterfall: 0.7,
  windmill: 1.15,
  birds: 0.8,
  crickets: 0.045,
  lake: 0.95,
  owl: 0.22,
  bell: 0.18,
  pad: 0.11,
};

/** How much of each layer reaches the shared reverb: the valley's air. */
const WET: Readonly<Record<Layer, number>> = {
  wind: 0,
  river: 0.06,
  waterfall: 0.05,
  windmill: 0.25,
  birds: 0.3,
  crickets: 0.25,
  lake: 0.15,
  owl: 0.55,
  bell: 0.6,
  pad: 0.2,
};

/** The windmill's sails turn at 0.6 rad/s (the farm scenery), four sails to a turn. */
const SAIL_TURN = (2 * Math.PI) / 0.6;
const SAILS = 4;

/** Seconds of noise in each looping buffer: long enough that the loop is never heard. */
const NOISE_SECONDS = 8;
/** A layer this quiet schedules no voices at all. */
const AUDIBLE = 0.03;

type Ctx = BaseAudioContext;
type Rand = () => number;

/** A noise buffer whose end runs into its start, so it loops without a click. */
function seamless(ctx: Ctx, fill: (d: Float32Array) => void): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const m = Math.floor(ctx.sampleRate * 0.25);
  const raw = new Float32Array(n);
  fill(raw);
  const buf = ctx.createBuffer(1, n - m, ctx.sampleRate);
  const out = buf.getChannelData(0);
  for (let i = 0; i < n - m; i++) {
    if (i < m) {
      const k = i / m;
      out[i] = raw[i]! * k + raw[n - m + i]! * (1 - k);
    } else out[i] = raw[i]!;
  }
  return buf;
}

function noise(ctx: Ctx, rand: Rand) {
  const white = seamless(ctx, (d) => {
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
  });
  // Paul Kellet's pink filter.
  const pink = seamless(ctx, (d) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  });
  const brown = seamless(ctx, (d) => {
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (rand() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
  });
  return { white, pink, brown };
}

/** A shared reverb: noise that dies away over a few seconds, like sound in a valley at night. */
function air(ctx: Ctx, rand: Rand): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * 2.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

export interface Soundscape {
  /** Move every layer toward its level; `dark` also closes the pad, for night. */
  setMix(mix: { master: number; levels: Levels; dark: boolean }, at?: number, ease?: number): void;
  /** Schedule the valley's voices (birds, crickets, bubbles, creaks, waves, owl, bell) between two times. */
  schedule(from: number, to: number): void;
}

/** Builds the whole soundscape into `ctx`, silent until the first mix. */
export function createSoundscape(ctx: Ctx, rand: Rand = Math.random): Soundscape {
  const t0 = ctx.currentTime;
  const { white, pink, brown } = noise(ctx, rand);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -20;
  limiter.knee.value = 18;
  limiter.ratio.value = 3;
  limiter.attack.value = 0.01;
  limiter.release.value = 0.4;
  limiter.connect(ctx.destination);
  const clear = ctx.createBiquadFilter();
  clear.type = 'highpass';
  clear.frequency.value = 110;
  clear.Q.value = 0.6;
  clear.connect(limiter);
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(clear);
  const reverb = air(ctx, rand);
  const wet = ctx.createGain();
  wet.gain.value = 0.9;
  reverb.connect(wet).connect(master);

  const layer = Object.fromEntries(
    LAYERS.map((k) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      const send = ctx.createGain();
      send.gain.value = WET[k];
      g.connect(send).connect(reverb);
      return [k, g];
    }),
  ) as Record<Layer, GainNode>;
  let levels: Levels = Object.fromEntries(LAYERS.map((k) => [k, 0])) as Record<Layer, number>;

  const loop = (buf: AudioBuffer, offset: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start(t0, offset % buf.duration);
    return src;
  };
  const lfo = (rate: number, depth: number, param: AudioParam, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = rate;
    const amt = ctx.createGain();
    amt.gain.value = depth;
    osc.connect(amt).connect(param);
    osc.start(t0);
  };
  const filter = (type: BiquadFilterType, frequency: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  };
  const panner = (pan: number) => {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    return p;
  };
  const gain = (value: number) => {
    const g = ctx.createGain();
    g.gain.value = value;
    return g;
  };

  // Wind: pink noise through a soft low-pass whose colour and strength drift, in gusts.
  {
    const lp = filter('lowpass', 520, 0.5);
    lfo(0.067, 280, lp.frequency);
    lfo(0.029, 140, lp.frequency);
    const gust = gain(0.62);
    lfo(0.113, 0.22, gust.gain);
    lfo(0.041, 0.16, gust.gain);
    const pan = panner(0);
    lfo(0.05, 0.4, pan.pan);
    loop(pink, 0.4).connect(lp).connect(gust).connect(pan).connect(layer.wind);
  }

  // River: a low body of water, and three babbling bands whose centres wander, on each side.
  for (const [side, offset] of [
    [-0.55, 1.3],
    [0.55, 4.7],
  ] as const) {
    const pan = panner(side);
    pan.connect(layer.river);
    loop(brown, offset).connect(filter('lowpass', 480, 0.4)).connect(gain(0.32)).connect(pan);
    const src = loop(pink, offset + 2.1);
    for (const [hz, q, rate, amp] of [
      [420, 1.8, 0.37, 0.75],
      [930, 2.4, 0.53, 0.68],
      [1750, 3.2, 0.91, 0.48],
    ] as const) {
      const bp = filter('bandpass', hz, q);
      lfo(rate * (side < 0 ? 1 : 1.17), hz * 0.28, bp.frequency);
      const flick = gain(amp);
      lfo(rate * 2.3, amp * 0.35, flick.gain);
      src.connect(bp).connect(flick).connect(pan);
    }
  }

  // Waterfall: a wide, steady roar with a little spray on top.
  for (const [side, offset] of [
    [-0.7, 0.9],
    [0.7, 5.3],
  ] as const) {
    const pan = panner(side);
    const roar = gain(0.8);
    lfo(0.07, 0.08, roar.gain);
    loop(pink, offset).connect(filter('highpass', 160)).connect(filter('lowpass', 5200)).connect(roar).connect(pan);
    loop(white, offset + 1.7).connect(filter('bandpass', 3800, 0.8)).connect(gain(0.05)).connect(pan);
    pan.connect(layer.waterfall);
  }

  // Windmill: the sails' whoosh, swelling as each of the four passes.
  {
    const bp = filter('bandpass', 620, 0.9);
    const swell = gain(0.5);
    lfo(SAILS / SAIL_TURN, 0.34, swell.gain);
    loop(pink, 3.3).connect(bp).connect(swell).connect(panner(0.25)).connect(layer.windmill);
  }

  // Lake: slow water lapping at the stage, raised wave by wave below.
  const lap = gain(0.2);
  loop(brown, 2.6).connect(filter('lowpass', 360, 0.5)).connect(lap).connect(layer.lake);

  // Pad: an open chord (D, A, E) on soft detuned triangles, breathing; darker at night.
  const padTone = filter('lowpass', 640, 0.4);
  {
    lfo(0.047, 150, padTone.frequency);
    const breath = gain(0.75);
    lfo(0.033, 0.22, breath.gain);
    padTone.connect(breath).connect(layer.pad);
    for (const hz of [146.83, 220.0, 329.63]) {
      for (const cents of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = hz;
        osc.detune.value = cents;
        osc.connect(gain(0.14)).connect(padTone);
        osc.start(t0);
      }
    }
  }

  // ── Voices: short sounds scheduled ahead of time, each into its layer. ──

  /** A pitched blip with a swept pitch and a quick envelope: the bones of every small voice. */
  const tone = (at: number, dest: AudioNode, o: { f0: number; f1: number; dur: number; amp: number; pan: number; type?: OscillatorType; attack?: number }) => {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f0, at);
    osc.frequency.exponentialRampToValueAtTime(o.f1, at + o.dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(o.amp, at + (o.attack ?? 0.006));
    env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
    osc.connect(env).connect(panner(o.pan)).connect(dest);
    osc.start(at);
    osc.stop(at + o.dur + 0.02);
  };

  const between = (a: number, b: number) => a + (b - a) * rand();
  const wait = (mean: number) => -Math.log(1 - rand() * 0.999) * mean;

  /** Bubbles in the river: tiny rising notes, the sound that makes noise read as water. */
  const bubble = (at: number) => {
    const f = 380 + rand() ** 2 * 1100;
    tone(at, layer.river, { f0: f, f1: f * between(1.5, 2.3), dur: between(0.04, 0.09), amp: between(0.06, 0.18), pan: between(-0.8, 0.8), attack: 0.003 });
  };

  /** A wooden creak as the sails come round: a slow buzz through a narrow, rising resonance. */
  const creak = (at: number) => {
    const dur = between(0.4, 0.75);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const hz = between(26, 36);
    osc.frequency.setValueAtTime(hz, at);
    osc.frequency.linearRampToValueAtTime(hz * between(1.3, 1.8), at + dur);
    const bp = filter('bandpass', between(480, 620), 9);
    bp.frequency.linearRampToValueAtTime(between(700, 900), at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.5, at + 0.07);
    env.gain.setTargetAtTime(0.0001, at + dur * 0.55, dur * 0.18);
    osc.connect(bp).connect(env).connect(panner(0.3)).connect(layer.windmill);
    osc.start(at);
    osc.stop(at + dur + 0.3);
  };

  /** A bird: a few quick tweets, a falling trill, or a soft two-note whistle. */
  const bird = (at: number) => {
    const pan = between(-0.85, 0.85);
    const near = between(0.35, 1);
    const kind = rand();
    if (kind < 0.45) {
      const f = between(2600, 3500);
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) tone(at + i * between(0.08, 0.12), layer.birds, { f0: f, f1: f * between(1.25, 1.45), dur: 0.055, amp: 0.4 * near, pan });
    } else if (kind < 0.75) {
      const f = between(4200, 5200);
      const n = 6 + Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) tone(at + i * 0.062, layer.birds, { f0: f * (1 - i * 0.01), f1: f * 0.76, dur: 0.038, amp: 0.3 * near, pan });
    } else {
      const f = between(1900, 2600);
      tone(at, layer.birds, { f0: f, f1: f * 1.06, dur: 0.24, amp: 0.35 * near, pan, attack: 0.03 });
      tone(at + 0.34, layer.birds, { f0: f * 0.84, f1: f * 0.8, dur: 0.3, amp: 0.3 * near, pan, attack: 0.03 });
    }
  };

  /** A cricket chirp: four fast pulses of one high note. Three crickets, each with its own pitch and pace. */
  const crickets = [
    { hz: 4480, every: 0.74, pan: -0.6 },
    { hz: 4820, every: 0.59, pan: 0.55 },
    { hz: 4230, every: 0.88, pan: 0.05 },
  ];
  const chirp = (at: number, c: (typeof crickets)[number]) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = c.hz + between(-25, 25);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    for (let p = 0; p < 4; p++) {
      const s = at + p * 0.034;
      env.gain.setValueAtTime(0, s);
      env.gain.linearRampToValueAtTime(1, s + 0.005);
      env.gain.linearRampToValueAtTime(0, s + 0.022);
    }
    osc.connect(env).connect(panner(c.pan)).connect(layer.crickets);
    osc.start(at);
    osc.stop(at + 0.16);
  };

  /** A wave reaching the stage: the lapping swells, then settles, with a small splash. */
  const wave = (at: number) => {
    lap.gain.setTargetAtTime(1, at, 0.42);
    lap.gain.setTargetAtTime(0.2, at + 1.1, 0.75);
    const src = ctx.createBufferSource();
    src.buffer = pink;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at + 0.85);
    env.gain.exponentialRampToValueAtTime(0.18, at + 0.95);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.5);
    src.connect(filter('bandpass', between(900, 1400), 1.1)).connect(env).connect(panner(between(-0.4, 0.4))).connect(layer.lake);
    src.start(at + 0.85, rand() * 4);
    src.stop(at + 1.6);
  };

  /** An owl, far off: a long hoot, a pause, then two short and one long. */
  const owl = (at: number) => {
    const pan = between(-0.7, 0.7);
    const hoot = (s: number, hz: number, dur: number) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      // A slight waver in the voice, which lives and dies with the hoot.
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.5;
      vibrato.connect(gain(3)).connect(osc.frequency);
      vibrato.start(s);
      vibrato.stop(s + dur + 0.05);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, s);
      env.gain.exponentialRampToValueAtTime(0.5, s + 0.07);
      env.gain.setValueAtTime(0.5, s + dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      osc.connect(filter('lowpass', 900)).connect(env).connect(panner(pan)).connect(layer.owl);
      osc.start(s);
      osc.stop(s + dur + 0.05);
    };
    hoot(at, 385, 0.55);
    hoot(at + 1.15, 350, 0.22);
    hoot(at + 1.45, 350, 0.22);
    hoot(at + 1.78, 372, 0.8);
  };

  /** The village bell: struck three times, its partials dying away at their own rates. */
  const PARTIALS = [
    [0.5, 0.45, 5.0],
    [1.0, 1.0, 3.6],
    [1.19, 0.4, 2.4],
    [1.5, 0.32, 2.0],
    [2.0, 0.45, 1.8],
    [2.51, 0.22, 1.2],
    [3.01, 0.16, 1.0],
    [4.18, 0.1, 0.7],
  ] as const;
  const bell = (at: number) => {
    const base = 318;
    for (let k = 0; k < 3; k++) {
      const s = at + k * 2.4;
      for (const [ratio, amp, decay] of PARTIALS) {
        const osc = ctx.createOscillator();
        osc.frequency.value = base * ratio * (1 + between(-0.002, 0.002));
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, s);
        env.gain.linearRampToValueAtTime(amp * 0.25, s + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, s + decay * 1.6);
        osc.connect(env).connect(panner(-0.35)).connect(layer.bell);
        osc.start(s);
        osc.stop(s + decay * 1.6 + 0.05);
      }
    }
  };

  /** Each voice's next time, and how long to wait after it. */
  const voices: { layer: Layer; next: number; after: () => number; play: (at: number) => void }[] = [
    { layer: 'river', next: t0 + 0.2, after: () => wait(0.11), play: bubble },
    { layer: 'windmill', next: t0 + 1.5, after: () => SAIL_TURN / 2 + between(-0.4, 0.4), play: creak },
    { layer: 'birds', next: t0 + 0.6, after: () => wait(1.9), play: bird },
    ...crickets.map((c, i) => ({ layer: 'crickets' as const, next: t0 + i * 0.21, after: () => c.every * between(0.92, 1.08), play: (at: number) => chirp(at, c) })),
    { layer: 'lake', next: t0 + 0.5, after: () => between(3.2, 5.6), play: wave },
    { layer: 'owl', next: t0 + 4, after: () => between(16, 34), play: owl },
    { layer: 'bell', next: t0 + 6, after: () => between(38, 70), play: bell },
  ];

  return {
    setMix({ master: m, levels: next, dark }, at = ctx.currentTime, ease = 0.8) {
      levels = next;
      master.gain.setTargetAtTime(m, at, ease);
      for (const k of LAYERS) layer[k].gain.setTargetAtTime(next[k] * VOICE[k], at, ease);
      padTone.frequency.setTargetAtTime(dark ? 420 : 680, at, 3);
    },
    schedule(from, to) {
      for (const v of voices) {
        if (v.next < from) v.next = from + rand() * 0.2;
        while (v.next < to) {
          if (levels[v.layer] > AUDIBLE) v.play(v.next);
          v.next += Math.max(0.03, v.after());
        }
      }
    },
  };
}

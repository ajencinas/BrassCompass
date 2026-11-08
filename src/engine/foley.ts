/**
 * Foley: the small sounds of a place and of moving through it, synthesised sample by sample.
 *
 * Everything here is a pure function of its parameters and a seeded random source, so the
 * designs below are plain data that the game renders into AudioBuffers once and the unit tests
 * can measure without Web Audio. A design is a list of layers (a thump, a knock, a scuff...),
 * each a source, an optional filter and an envelope; a rendered sound is normalised to a peak of
 * 1, so the gain tables below are what decide how loud each sound plays.
 */

/** What a floor sounds like underfoot. */
export type Surface = "wood" | "deck" | "stone" | "sand" | "earth";
/** A sound that belongs to a place: a fire, water against a hull, a drip, a creaking ship. */
export type EmitterSound = "crackle" | "lapping" | "drip" | "creak";
/** The sound of going through an exit; `none` for an open-air walk. */
export type DoorKind = "door" | "hatch" | "stairs" | "none";

export interface Filter {
  type: "lowpass" | "highpass" | "bandpass";
  f: number;
  q?: number;
  /** Level of this band when several are summed (parallel resonances). */
  gain?: number;
}

export interface Layer {
  /**
   * noise: white noise. sine: a tone gliding from `f` toward `f2`. grains: sparse random
   * impulses (crunch, crinkle). pulses: an impulse train at `f` gliding toward `f2` with
   * `jitter`, the stick-slip of a creak or a hinge.
   */
  src: "noise" | "sine" | "grains" | "pulses";
  f?: number;
  f2?: number;
  /** Time constant of the glide from `f` to `f2`, seconds. */
  glide?: number;
  /** Grains per second. */
  density?: number;
  /** Pulse-to-pulse variation of period and strength, 0..1. */
  jitter?: number;
  /** One filter, or several in parallel (summed resonances). */
  filter?: Filter | Filter[];
  /** Onset, seconds from the start of the sound. */
  at?: number;
  attack?: number;
  hold?: number;
  /** Exponential decay time constant, seconds; the layer runs ~7 of them (-60 dB). */
  decay: number;
  /** Peak contribution of the layer before the whole sound is normalised. */
  amp: number;
}

/** A sound design: given a random source (for per-variant differences), its layers. */
export type Design = (r: () => number) => Layer[];

/** mulberry32: small, fast and good enough for noise; seeded so variants are reproducible. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ biquad, in place. Bandpass is the constant 0 dB peak form. */
export function biquad(x: Float32Array, filter: Filter, rate: number): Float32Array {
  const w = (2 * Math.PI * Math.min(filter.f, rate * 0.45)) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * (filter.q ?? Math.SQRT1_2));
  let b0: number, b1: number, b2: number;
  if (filter.type === "lowpass") { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
  else if (filter.type === "highpass") { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; }
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
  return x;
}

function peakOf(x: Float32Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; }
  return p;
}

const DEFAULT_ATTACK = 0.001;

/** Seconds from the start of the sound to the end of a layer's tail (-52 dB). */
function layerEnd(l: Layer): number {
  return (l.at ?? 0) + (l.attack ?? DEFAULT_ATTACK) + (l.hold ?? 0) + l.decay * 6;
}

function addLayer(out: Float32Array, l: Layer, rate: number, random: () => number): void {
  const start = Math.floor((l.at ?? 0) * rate);
  const n = Math.min(out.length - start, Math.ceil((layerEnd(l) - (l.at ?? 0)) * rate));
  if (n <= 0) return;
  let src = new Float32Array(n);
  const f = l.f ?? 440;
  const f2 = l.f2 ?? f;
  // The glide toward f2 is exponential: one multiply per sample rather than an exp().
  const glide = Math.exp(-1 / (rate * (l.glide ?? Math.max(0.001, l.decay / 2))));
  let towards = 1;
  if (l.src === "noise") {
    for (let i = 0; i < n; i++) src[i] = random() * 2 - 1;
  } else if (l.src === "grains") {
    const p = (l.density ?? 1000) / rate;
    for (let i = 0; i < n; i++) src[i] = random() < p ? random() * 2 - 1 : 0;
  } else if (l.src === "pulses") {
    const jitter = l.jitter ?? 0;
    let phase = 0;
    let spread = 1;
    for (let i = 0; i < n; i++) {
      phase += ((f2 + (f - f2) * towards) * spread) / rate;
      towards *= glide;
      if (phase >= 1) {
        phase -= 1;
        spread = 1 + jitter * (random() - 0.5);
        src[i] = 1 - jitter * 0.5 + jitter * random();
      }
    }
  } else {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      src[i] = Math.sin(phase);
      phase += (2 * Math.PI * (f2 + (f - f2) * towards)) / rate;
      towards *= glide;
    }
  }
  if (l.filter) {
    const filters = Array.isArray(l.filter) ? l.filter : [l.filter];
    if (filters.length === 1) {
      biquad(src, filters[0], rate);
    } else {
      const sum = new Float32Array(n);
      for (const fl of filters) {
        const band = biquad(Float32Array.from(src), fl, rate);
        const g = fl.gain ?? 1;
        for (let i = 0; i < n; i++) sum[i] += band[i] * g;
      }
      src = sum;
    }
  }
  // Tones keep their own level; noise-like sources are scaled to a unit peak so `amp` means
  // the same thing whatever the filter took away.
  const scale = l.src === "sine" ? 1 : 1 / (peakOf(src) || 1);
  const attack = Math.max(1, Math.round((l.attack ?? DEFAULT_ATTACK) * rate));
  const hold = Math.round((l.hold ?? 0) * rate);
  const fall = Math.exp(-1 / Math.max(1e-6, l.decay * rate));
  const gain = scale * l.amp;
  let tail = 1;
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i >= attack + hold) { env = tail; tail *= fall; }
    out[start + i] += src[i] * gain * env;
  }
}

/** Render a layer list to mono samples, normalised to a peak of 1 with a click-free end. */
export function renderLayers(layers: Layer[], rate: number, random: () => number): Float32Array {
  const end = layers.reduce((e, l) => Math.max(e, layerEnd(l)), 0);
  const out = new Float32Array(Math.max(1, Math.ceil(end * rate)));
  for (const l of layers) addLayer(out, l, rate, random);
  const peak = peakOf(out);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  const fade = Math.min(out.length, Math.round(rate * 0.003));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

/** Render variant `seed` of a design. The same seed always gives the same samples. */
export function renderSound(design: Design, rate: number, seed: number): Float32Array {
  const r = seeded(seed * 7919 + 17);
  return renderLayers(design(r), rate, seeded(seed * 104729 + 3));
}

const between = (r: () => number, lo: number, hi: number): number => lo + (hi - lo) * r();

// ------------------------------------------------------------------ footsteps

/**
 * One footfall per surface: heel then toe. `gain` is the peak level of a near, walking step;
 * every surface sits well under the interface sounds (see the unit tests).
 */
export const STEPS: Record<Surface, { design: Design; gain: number }> = {
  // Indoor floorboards: a hollow knock over a low thump, a sole click, a lighter toe.
  wood: {
    gain: 0.026,
    design: (r) => [
      { src: "sine", f: between(r, 140, 165), f2: 90, glide: 0.015, attack: 0.002, decay: 0.02, amp: 0.4 },
      { src: "noise", filter: { type: "bandpass", f: between(r, 480, 560), q: 1.6 }, attack: 0.0015, decay: 0.024, amp: 1 },
      { src: "noise", filter: { type: "highpass", f: 2800 }, attack: 0.0003, decay: 0.003, amp: 0.4 },
      { src: "noise", filter: { type: "bandpass", f: 750, q: 1.4 }, at: between(r, 0.05, 0.062), attack: 0.002, decay: 0.014, amp: 0.45 },
    ],
  },
  // A ship's deck: thicker, duller planks over a hollow hull, so lower and boomier.
  deck: {
    gain: 0.023,
    design: (r) => [
      { src: "sine", f: between(r, 105, 125), f2: 66, glide: 0.02, attack: 0.003, decay: 0.032, amp: 0.5 },
      { src: "noise", filter: { type: "bandpass", f: between(r, 320, 380), q: 1.4 }, attack: 0.002, decay: 0.03, amp: 1 },
      { src: "noise", filter: { type: "highpass", f: 2200 }, attack: 0.0004, decay: 0.0025, amp: 0.22 },
      { src: "noise", filter: { type: "bandpass", f: 600, q: 1.3 }, at: between(r, 0.06, 0.075), attack: 0.003, decay: 0.018, amp: 0.42 },
    ],
  },
  // Cobbles: a hard, bright heel click with a little grit, and a sharp toe.
  stone: {
    gain: 0.036,
    design: (r) => [
      { src: "noise", filter: { type: "bandpass", f: between(r, 2100, 2700), q: 0.9 }, attack: 0.0003, decay: 0.005, amp: 1 },
      { src: "noise", filter: { type: "lowpass", f: 1000 }, attack: 0.0008, decay: 0.01, amp: 0.5 },
      { src: "sine", f: 170, f2: 110, glide: 0.006, attack: 0.001, decay: 0.01, amp: 0.28 },
      { src: "grains", density: 3000, filter: { type: "highpass", f: 3200 }, at: 0.006, attack: 0.006, decay: 0.018, amp: 0.25 },
      { src: "noise", filter: { type: "bandpass", f: between(r, 2800, 3400), q: 1 }, at: between(r, 0.04, 0.05), attack: 0.0003, decay: 0.004, amp: 0.45 },
    ],
  },
  // Sand: no knock at all, a soft crunch that rolls from heel to toe.
  sand: {
    gain: 0.025,
    design: (r) => [
      { src: "grains", density: 4000, filter: { type: "bandpass", f: between(r, 1300, 1700), q: 0.7 }, attack: 0.012, decay: 0.05, amp: 1 },
      { src: "noise", filter: { type: "lowpass", f: 260 }, attack: 0.005, decay: 0.04, amp: 0.6 },
      { src: "grains", density: 2500, filter: { type: "bandpass", f: between(r, 2100, 2500), q: 0.8 }, at: between(r, 0.06, 0.08), attack: 0.01, decay: 0.035, amp: 0.5 },
    ],
  },
  // Packed earth: a dull thud and a pinch of grit.
  earth: {
    gain: 0.025,
    design: (r) => [
      { src: "sine", f: between(r, 88, 100), f2: 55, glide: 0.015, attack: 0.003, decay: 0.026, amp: 0.45 },
      { src: "noise", filter: { type: "lowpass", f: between(r, 560, 680) }, attack: 0.003, decay: 0.026, amp: 1 },
      { src: "grains", density: 1200, filter: { type: "highpass", f: 2000 }, at: 0.004, attack: 0.004, decay: 0.028, amp: 0.3 },
      { src: "noise", filter: { type: "lowpass", f: 800 }, at: between(r, 0.055, 0.07), attack: 0.003, decay: 0.015, amp: 0.4 },
    ],
  },
};

/**
 * How one footstep sits in the mix. `pan` is Fenn's place across the screen (-1 left edge,
 * 1 right edge); `depth` 0 at the front of the stage to 1 at the horizon; feet alternate
 * (`foot` ±1) by a 3% shift in rate, so a walk is a left-right gait rather than a loop.
 * A running step is louder and loses its toe (`hold`: seconds before the tail is damped).
 */
export function stepMix(pan: number, depth: number, run: boolean, foot: 1 | -1): { pan: number; gain: number; rate: number; hold: number } {
  const p = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
  const d = Math.max(0, Math.min(1, Number.isFinite(depth) ? depth : 0));
  return {
    pan: p * 0.5,
    gain: (1 - 0.6 * d) * (run ? 1.3 : 1),
    rate: (1 + 0.03 * foot) * (run ? 1.08 : 1),
    hold: run ? 0.045 : Infinity,
  };
}

// ------------------------------------------------------------------ interface

/** The interface click: a soft wooden tick, like a pencil on a desk, not a beep. */
export const TICK: Design = () => [
  { src: "noise", filter: { type: "bandpass", f: 1700, q: 4 }, attack: 0.0004, decay: 0.007, amp: 0.8 },
  { src: "sine", f: 1250, f2: 1180, glide: 0.01, attack: 0.0006, decay: 0.011, amp: 0.7 },
  { src: "sine", f: 560, f2: 520, glide: 0.01, attack: 0.001, decay: 0.009, amp: 0.3 },
  { src: "noise", filter: { type: "highpass", f: 4000 }, attack: 0.0003, decay: 0.0015, amp: 0.12 },
];

/** A page turned: a papery swish with crinkles, landing softly. */
export const PAGE: Design = (r) => [
  { src: "noise", filter: { type: "bandpass", f: between(r, 2500, 3200), q: 0.5 }, attack: 0.07, decay: 0.07, amp: 0.45 },
  { src: "grains", density: 300, filter: { type: "bandpass", f: between(r, 4000, 5000), q: 1.5 }, attack: 0.03, hold: 0.04, decay: 0.07, amp: 1 },
  { src: "grains", density: 150, filter: { type: "bandpass", f: 3200, q: 1.2 }, at: 0.1, attack: 0.01, decay: 0.05, amp: 0.5 },
  { src: "noise", filter: { type: "lowpass", f: 1100 }, at: between(r, 0.12, 0.15), attack: 0.008, decay: 0.035, amp: 0.4 },
];

/** Something going into the satchel: canvas and leather rustling, then it settles. */
export const SATCHEL: Design = (r) => [
  { src: "noise", filter: { type: "bandpass", f: between(r, 900, 1100), q: 0.6 }, attack: 0.05, decay: 0.07, amp: 0.6 },
  { src: "grains", density: 220, filter: { type: "bandpass", f: 1300, q: 1.1 }, attack: 0.02, hold: 0.03, decay: 0.07, amp: 0.9 },
  { src: "sine", f: 150, f2: 95, glide: 0.012, at: 0.16, attack: 0.002, decay: 0.03, amp: 0.55 },
  { src: "noise", filter: { type: "lowpass", f: 500 }, at: 0.16, attack: 0.002, decay: 0.028, amp: 0.45 },
  { src: "sine", f: between(r, 2400, 2800), at: 0.17, attack: 0.0005, decay: 0.012, amp: 0.06 },
];

/**
 * Peak levels of the one-shots. The tick is heard constantly: as loud as the old square-wave
 * click (K-weighted), but a short wooden knock without its edge.
 */
export const LEVEL = {
  tick: 0.085, page: 0.05, satchel: 0.05, hatch: 0.1, stairs: 0.07, stamp: 0.11, bell: 0.09,
  /**
   * The compass motif and the note-filed stinger are quiet, dialogue-level sounds. The motif's
   * peak sits 10 dB under the interface tick's — the loudest routine one-shot, and this game's
   * stand-in for a dialogue level, since there is no voice track — and its 1.9 s sustain never
   * reads louder than the tick K-weighted.
   */
  motif: 0.027,
  note: 0.03,
  /** The cue under a cinematic with no soundtrack: above the ducked bed, under a line. */
  actBreak: 0.2,
};

// ------------------------------------------------------------------ score

/**
 * The compass motif: root, fifth, octave, and the sixth above it. It rises like a needle and
 * settles off the root, because the compass has never once pointed at north. Four notes, under
 * two seconds, the same shape in every act — only the key changes.
 */
export const MOTIF = [0, 7, 12, 9] as const;

/** Each act's root, in semitones above C. Act IV comes home to C, where the ending resolves. */
export const ACT_ROOT = [2, 4, 7, 0] as const;

const C4 = 261.6255653005986;
/** Equal-tempered frequency `semitones` above C4. */
function pitch(semitones: number): number {
  return C4 * 2 ** (semitones / 12);
}
/** An act number, clamped, as a root in semitones above C4. */
function actRoot(act: number): number {
  const i = Number.isFinite(act) ? Math.max(1, Math.min(ACT_ROOT.length, Math.round(act))) - 1 : 0;
  return ACT_ROOT[i];
}

/** One note of the motif: a small struck bar of brass, fundamental and its inharmonic partial. */
function bell(f: number, at: number, decay: number, amp = 1): Layer[] {
  return [
    { src: "sine", f, at, attack: 0.006, decay, amp },
    { src: "sine", f: f * 2.756, at, attack: 0.003, decay: decay * 0.5, amp: amp * 0.16 },
  ];
}

/** The motif's four notes, starting at `at` and scaled by `amp` (for a cue that quotes it). */
function motifLayers(root: number, at: number, amp: number): Layer[] {
  return MOTIF.flatMap((n, i) => {
    const last = i === MOTIF.length - 1;
    return bell(pitch(root + n), at + i * 0.28, last ? 0.17 : 0.14, (last ? 1 : 0.92) * amp);
  });
}

/**
 * The compass leitmotif, transposed to `act`'s key. About 1.9 s from the first strike to the
 * last ring; `octave` lifts it for the ending, where it sits inside the resolving chord.
 */
export function compassMotif(act: number, octave = 0): Design {
  const root = actRoot(act) + octave * 12;
  return () => motifLayers(root, 0.04, 1);
}

/** The motif's frequencies for `act`, for a caller that voices it with its own synth (the ending). */
export function motifNotes(act: number, octave = 0): number[] {
  const root = actRoot(act) + octave * 12;
  return MOTIF.map((n) => pitch(root + n));
}

/**
 * A note filed in the casebook: a page turned over a low, warm chime. The page is the same
 * paper as the casebook's own; the chime is two soft bars a fifth apart, low enough to land
 * under a line of dialogue rather than over it.
 */
export const NOTE_STINGER: Design = (r) => [
  ...PAGE(r).map((l) => ({ ...l, amp: l.amp * 0.42 })),
  { src: "sine", f: 196, at: 0.09, attack: 0.012, decay: 0.28, amp: 0.65 },
  { src: "sine", f: 392, at: 0.09, attack: 0.01, decay: 0.16, amp: 0.16 },
  { src: "sine", f: 293.66, at: 0.2, attack: 0.02, decay: 0.34, amp: 0.5 },
  { src: "sine", f: 587.33, at: 0.2, attack: 0.015, decay: 0.18, amp: 0.1 },
];

/**
 * What plays under a cinematic with no soundtrack of its own. `seconds` is the video's length:
 * a low drone that breathes for the whole of it, the compass motif near the start and again
 * near the end, and a last low root that rings out as the next act's music comes up. It is
 * deliberately not a tune — more weather than melody.
 */
export function actBreakCue(act: number, seconds: number): Design {
  const length = Number.isFinite(seconds) ? Math.max(4, Math.min(14, seconds)) : 8;
  const root = actRoot(act) - 12;   // an octave below the motif: the hold, not the needle
  return () => {
    const end = length - 0.6;
    return [
      // A drone in root and fifth that swells in and settles out.
      { src: "sine", f: pitch(root), attack: 1.1, hold: Math.max(0.2, length - 2.4), decay: 0.34, amp: 0.55 },
      { src: "sine", f: pitch(root + 7), attack: 1.8, hold: Math.max(0.1, length - 3.0), decay: 0.3, amp: 0.22 },
      { src: "sine", f: pitch(root + 12), attack: 2.4, hold: Math.max(0.1, length - 3.8), decay: 0.4, amp: 0.08 },
      // The motif as the act opens, and again as it closes...
      ...motifLayers(actRoot(act), 0.75, 0.34),
      ...motifLayers(actRoot(act), Math.max(1.2, end - 2.2), 0.26),
      // ...then the low root under the last of it, ringing into the next act.
      { src: "sine", f: pitch(root), at: end, attack: 0.02, decay: 0.34, amp: 0.5 },
    ];
  };
}

/**
 * The date stamp: a brass base driven into a paper page on a wooden desk. The paper cracks
 * first, the desk takes the weight, and a little brass rings on after both.
 */
export const STAMP: Design = (r) => [
  { src: "noise", filter: { type: "bandpass", f: between(r, 1700, 2400), q: 0.7 }, attack: 0.0008, decay: 0.022, amp: 0.85 },
  { src: "sine", f: between(r, 140, 165), f2: 78, glide: 0.02, attack: 0.001, decay: 0.07, amp: 0.9 },
  { src: "sine", f: between(r, 62, 74), f2: 48, glide: 0.03, attack: 0.002, decay: 0.13, amp: 1 },
  { src: "noise", filter: { type: "lowpass", f: between(r, 380, 520) }, attack: 0.001, decay: 0.05, amp: 0.7 },
  { src: "sine", f: between(r, 1750, 1980), f2: 1680, glide: 0.04, attack: 0.0006, decay: 0.075, amp: 0.11 },
  { src: "sine", f: between(r, 2650, 2900), glide: 0.03, attack: 0.0005, decay: 0.045, amp: 0.06 },
  { src: "grains", density: 900, filter: { type: "highpass", f: 2600 }, at: between(r, 0.012, 0.03), attack: 0.004, decay: 0.035, amp: 0.18 },
];

/**
 * A brass hand-bell above a harbour door: struck once, then left to ring. Small bells are
 * inharmonic, so the partials are not whole multiples of the fundamental and do not line up.
 */
export const BELL: Design = (r) => {
  const f = between(r, 820, 900);
  const partials: [number, number, number][] = [
    // [ratio, decay, amp]
    [1, 0.65, 1],
    [2.01, 0.45, 0.55],
    [2.72, 0.35, 0.4],
    [4.18, 0.24, 0.22],
    [5.43, 0.18, 0.16],
    [7.1, 0.12, 0.08],
  ];
  return [
    { src: "noise", filter: { type: "highpass", f: 3200 }, attack: 0.0004, decay: 0.006, amp: 0.5 },
    { src: "noise", filter: { type: "bandpass", f: between(r, 1400, 1800), q: 2 }, attack: 0.0008, decay: 0.02, amp: 0.3 },
    ...partials.map(([ratio, decay, amp]) => ({
      src: "sine" as const, f: f * ratio, f2: f * ratio * 0.997, glide: 0.3,
      attack: 0.0015, hold: 0.01, decay, amp,
    })),
  ];
};

// ------------------------------------------------------------------ doors

/** A wooden hatch or shutter: a short hinge squeal, then the clunk of it falling to. */
export const HATCH: Design = (r) => [
  {
    src: "pulses", f: between(r, 200, 240), f2: between(r, 300, 360), glide: 0.08, jitter: 0.2,
    filter: [{ type: "bandpass", f: 1250, q: 7 }, { type: "bandpass", f: 2600, q: 6, gain: 0.6 }],
    attack: 0.02, hold: 0.06, decay: 0.05, amp: 0.45,
  },
  { src: "sine", f: 105, f2: 62, glide: 0.02, at: 0.17, attack: 0.002, decay: 0.07, amp: 1 },
  { src: "noise", filter: { type: "lowpass", f: 650 }, at: 0.17, attack: 0.0015, decay: 0.05, amp: 0.75 },
  { src: "noise", filter: { type: "bandpass", f: 420, q: 2 }, at: 0.17, attack: 0.001, decay: 0.03, amp: 0.6 },
  { src: "noise", filter: { type: "bandpass", f: 1500, q: 2 }, at: 0.19, attack: 0.001, decay: 0.012, amp: 0.25 },
];

// ------------------------------------------------------------------ place sounds

/** One crackle of a fire: a tiny bright snap with a little body. */
export const POP: Design = (r) => [
  { src: "noise", filter: { type: "bandpass", f: between(r, 1800, 4000), q: 0.8 }, attack: 0.0002, decay: between(r, 0.0015, 0.004), amp: 1 },
  { src: "noise", filter: { type: "lowpass", f: between(r, 800, 1500) }, attack: 0.0004, decay: 0.005, amp: between(r, 0.3, 0.6) },
];

/** A fire breathing: a soft flare of hiss with a few sparks in it. */
export const HISS: Design = (r) => [
  { src: "noise", filter: { type: "bandpass", f: between(r, 600, 900), q: 0.5 }, attack: 0.18, hold: 0.05, decay: 0.22, amp: 1 },
  { src: "grains", density: 60, filter: { type: "bandpass", f: 3000, q: 1 }, at: 0.05, attack: 0.05, decay: 0.2, amp: 0.5 },
];

/** Water slapping a hull or a pier: a low swell, a brighter crest, a few bubbles. */
export const LAP: Design = (r) => {
  const crest = between(r, 0.28, 0.42);
  const layers: Layer[] = [
    { src: "noise", filter: { type: "lowpass", f: between(r, 330, 480), q: 0.9 }, attack: between(r, 0.3, 0.5), hold: 0.05, decay: 0.28, amp: 1 },
    { src: "noise", filter: { type: "bandpass", f: between(r, 800, 1100), q: 0.8 }, at: crest, attack: 0.12, decay: 0.2, amp: 0.45 },
  ];
  const bubbles = 2 + Math.floor(r() * 3);
  for (let i = 0; i < bubbles; i++) {
    const f = between(r, 500, 900);
    layers.push({ src: "sine", f, f2: f * 1.7, glide: 0.01, at: crest + between(r, 0.02, 0.35), attack: 0.002, decay: 0.012, amp: between(r, 0.08, 0.16) });
  }
  return layers;
};

/** A drip: a rising plink, the tick of it landing, and a faint echo off the walls. */
export const DRIP: Design = (r) => {
  const f = between(r, 700, 1200);
  return [
    { src: "sine", f, f2: f * 1.9, glide: 0.01, attack: 0.0008, decay: 0.03, amp: 1 },
    { src: "noise", filter: { type: "highpass", f: 2500 }, attack: 0.0003, decay: 0.0012, amp: 0.25 },
    { src: "sine", f, f2: f * 1.9, glide: 0.01, at: between(r, 0.1, 0.14), attack: 0.002, decay: 0.03, amp: 0.15 },
  ];
};

/** A timber or a rope taking strain: stick-slip pulses through the wood's resonances. */
export const CREAK: Design = (r) => {
  const f = between(r, 55, 115);
  return [{
    src: "pulses", f, f2: f * between(r, 0.7, 1.5), glide: between(r, 0.2, 0.4), jitter: 0.3,
    filter: [
      { type: "bandpass", f: between(r, 450, 680), q: 12 },
      { type: "bandpass", f: between(r, 1000, 1400), q: 9, gain: 0.7 },
      { type: "bandpass", f: 2300, q: 6, gain: 0.3 },
    ],
    attack: between(r, 0.15, 0.3), hold: between(r, 0.1, 0.3), decay: between(r, 0.2, 0.35), amp: 1,
  }];
};

/**
 * How often each place sound comes round (`every`, seconds between events) and how loud it is
 * when the camera is on top of it (peak of one event). Measured over a run of events, they sit
 * about 10 dB under the sea bed (drips lower still) and 25 dB under the music: there if you
 * listen, never in the way.
 */
export const PLACE: Record<EmitterSound, { every: [number, number]; gain: number }> = {
  crackle: { every: [0.25, 0.9], gain: 0.09 },
  lapping: { every: [1.8, 4.2], gain: 0.041 },
  drip: { every: [1.6, 6], gain: 0.034 },
  creak: { every: [4, 12], gain: 0.085 },
};

/** Gulls over a harbour: the first call soon after arriving, then now and again. */
export const GULLS = { first: [0.9, 1.5] as [number, number], every: [20, 40] as [number, number] };

/**
 * Where a place sound sits for a listener at the camera's centre: panned toward its side and
 * quieter the further away it is, but never gone while the room is on screen.
 * `dx` is the sound's world x minus the camera centre's.
 */
export function emitterMix(dx: number): { pan: number; gain: number } {
  const d = Number.isFinite(dx) ? dx : 0;
  return {
    pan: Math.max(-0.8, Math.min(0.8, d / 1500)),
    gain: 1 / (1 + (d / 1300) ** 2),
  };
}

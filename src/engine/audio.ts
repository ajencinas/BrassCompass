/**
 * Audio — looping music with crossfade, plus procedurally synthesised SFX.
 * Music comes from generated tracks; SFX are synthesised so they stay crisp
 * and cost nothing.
 *
 * Everything audible goes through one Web Audio graph ending in `master`, so mute and volume
 * work everywhere (iOS ignores HTMLMediaElement.volume) and fades are sample-accurate
 * AudioParam ramps rather than timers that background tabs throttle.
 *
 *   music tracks → track gain → musicBus (Music slider) → musicDuck → master (Master, mute)
 *   interface sounds and one-shots → sfxBus (Effects slider) ──────→ master
 *   footsteps → stepPan → sfxBus
 *   the room: ambience bed, place sounds, gulls → envBus → sfxBus
 *   score cues → cueBus (Music slider, before the duck) ─────────→ master
 *
 * `musicDuck` and `envBus` are the only levels the game moves by itself: a cinematic pulls the
 * music and the room down under the video's own soundtrack (or part-way down, under a cue,
 * when the video has no soundtrack), and a conversation dips the music a little. The sliders
 * sit on other nodes, so they still work while ducked and the two multiply. Interface sounds
 * are never ducked, so whatever the game does as a video ends (the ending's chord) is heard at
 * once. The cue bus shares the Music slider but sits before the duck: the cue is the score, so
 * it must not be pulled down by the duck that makes room for it.
 */

import type { Assets } from "./assets";
import {
  STEPS, TICK, PAGE, SATCHEL, HATCH, POP, HISS, LAP, DRIP, CREAK, STAMP, BELL, PLACE, GULLS, LEVEL,
  compassMotif, actBreakCue, NOTE_STINGER, motifNotes,
  renderSound, stepMix, emitterMix,
  type Design, type Surface, type EmitterSound, type DoorKind,
} from "./foley";

type AmbienceKind = "sea" | "wind" | "tavern";

/** What a room asks of the audio: its bed (or gulls), its floor, and the sounds that belong to it. */
export interface RoomSound {
  ambience?: AmbienceKind | "gulls";
  /** Defaults to wood. */
  footsteps?: Surface;
  /** Placed at `at` (world coordinates), or everywhere in the room when it is omitted. */
  emitters?: readonly { kind: EmitterSound; at?: { x: number; y: number } }[];
}

interface Ambience {
  src: AudioBufferSourceNode;
  lfo: OscillatorNode;
  /** Ambience output: fades in on start and out on stop, independent of the LFO swell. */
  out: GainNode;
  nodes: AudioNode[];
  timer: number | null;
}

/** A sound that belongs to the room: a fire, the water, a drip, a creak, the gulls overhead. */
interface Voice {
  kind: EmitterSound | "gulls";
  /** World position; null for everywhere, when each event is placed at random instead. */
  at: { x: number; y: number } | null;
  /** Distance attenuation, then the voice's own panner, into the room bus. */
  out: GainNode;
  pan: StereoPannerNode | null;
  mix: { pan: number; gain: number };
  timer: number | null;
}

interface ToneOptions {
  /** Where to send the sound; defaults to the effects bus. */
  dest?: AudioNode;
  /** Start this many seconds from now. */
  delay?: number;
  /** Attack time in seconds. */
  attack?: number;
}

interface PlayOptions {
  /** Where to send the sound; defaults to the effects bus. */
  dest?: AudioNode;
  /** Start at this audio-clock time, or this many seconds from now. */
  at?: number;
  delay?: number;
  rate?: number;
  /** Damp the tail from this many seconds after the start (a running step loses its toe). */
  hold?: number;
}

/** The composed cue under a cinematic that has no soundtrack of its own. */
interface Cue {
  src: AudioBufferSourceNode;
  gain: GainNode;
  /** Safety stop if the composed tail outlasts the picture. */
  timer: number;
}

/** Where the music and the room sit while a cinematic plays its own soundtrack. */
const DUCKED = 0;
/** Seconds to duck under a cinematic, and to come back after it. */
const DUCK_DOWN = 0.5, DUCK_UP = 1.0;
/** The music under a conversation: -2.5 dB, gently in and out. */
const TALK_DIP = 0.75, TALK_DOWN = 0.4, TALK_UP = 0.8;

/**
 * Where each music bed stops being music and starts being the tail of near-silence the
 * generator left after it. A media element can only loop at the file's end, so the bed is
 * wrapped by hand at these points instead: measured from the shipped mp3s as the last 100 ms
 * window above -55 dBFS plus 0.4 s of ring-out, in seconds. `duration` is the file's length, so
 * a regenerated bed with a different shape falls back to the element's own loop rather than
 * being cut in the middle. Re-measure by the same method if the beds are ever regenerated.
 */
const BED_LOOP_END: Record<string, { duration: number; end: number }> = {
  "dock.mp3": { duration: 48.0, end: 44.7 },
  "fog.mp3": { duration: 44.0, end: 39.3 },
  "office.mp3": { duration: 36.0, end: 28.5 },
  "pans.mp3": { duration: 43.2, end: 43.2 },
  "sea.mp3": { duration: 44.0, end: 40.9 },
  "sunset.mp3": { duration: 48.2, end: 47.9 },
  "tavern.mp3": { duration: 40.0, end: 38.2 },
};
/** How often a playing bed is checked against its loop point; seconds. */
const LOOP_CHECK = 0.08;

/** Each foley sound and how many variants of it to render. */
const BANKS = {
  tick: { design: TICK, variants: 3 },
  page: { design: PAGE, variants: 3 },
  satchel: { design: SATCHEL, variants: 3 },
  hatch: { design: HATCH, variants: 2 },
  stamp: { design: STAMP, variants: 3 },
  bell: { design: BELL, variants: 2 },
  pop: { design: POP, variants: 6 },
  hiss: { design: HISS, variants: 3 },
  lap: { design: LAP, variants: 4 },
  drip: { design: DRIP, variants: 4 },
  creak: { design: CREAK, variants: 4 },
  note: { design: NOTE_STINGER, variants: 3 },
  "motif:1": { design: compassMotif(1), variants: 1 },
  "motif:2": { design: compassMotif(2), variants: 1 },
  "motif:3": { design: compassMotif(3), variants: 1 },
  "motif:4": { design: compassMotif(4), variants: 1 },
  "step:wood": { design: STEPS.wood.design, variants: 4 },
  "step:deck": { design: STEPS.deck.design, variants: 4 },
  "step:stone": { design: STEPS.stone.design, variants: 4 },
  "step:sand": { design: STEPS.sand.design, variants: 4 },
  "step:earth": { design: STEPS.earth.design, variants: 4 },
} satisfies Record<string, { design: Design; variants: number }>;
type Bank = keyof typeof BANKS;
/** What each place sound plays, so a room's sounds can be made before it is shown. */
const VOICE_BANKS: Record<EmitterSound, Bank[]> = { crackle: ["pop", "hiss"], lapping: ["lap"], drip: ["drip"], creak: ["creak"] };
/** Made in idle time once audio is unlocked, so the first click or page turn never waits. */
const WARM: Bank[] = ["tick", "page", "satchel", "hatch", "stamp", "bell", "step:wood",
  "note", "motif:1", "motif:2", "motif:3", "motif:4"];

/** Run `fn` when the main thread is idle (or soon, where there is no idle callback). */
function idle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => fn(), { timeout: 2000 });
  else window.setTimeout(fn, 60);
}

/** A small stable hash, so each bank of variants gets its own noise. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private current: HTMLAudioElement | null = null;
  volume = 0.55;
  /** Music and effects (SFX and ambience) each have their own level under the master. */
  musicVolume = 1;
  sfxVolume = 1;
  muted = false;

  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  /** After the Music slider: the cinematic duck times the conversation dip. */
  private musicDuck: GainNode | null = null;
  /** The room's own sound, ducked under cinematics, feeding the effects bus. */
  private envBus: GainNode | null = null;
  /** One panner for every footstep: they follow one another, so they never need two. */
  private stepPan: StereoPannerNode | null = null;
  /** The score: the cue under a silent cinematic, and the compass's own motif. */
  private cueBus: GainNode | null = null;
  private cue: Cue | null = null;
  private cueBuffers = new Map<string, AudioBuffer>();
  /** Per-track gain, created once per element (createMediaElementSource may only run once). */
  private trackGain = new Map<HTMLAudioElement, GainNode | null>();
  private stopTimers = new Map<HTMLAudioElement, number>();
  /** The hand-made loop point for each bed, and the timer that watches for it. */
  private bedEnds = new Map<HTMLAudioElement, number | null>();
  private loopTimers = new Map<HTMLAudioElement, number>();
  private hidden = typeof document !== "undefined" && document.hidden;

  /** A looping environmental bed: sea, wind or a room full of people. */
  private ambience: Ambience | null = null;
  private ambienceKind: AmbienceKind | null = null;
  private bedBuffer: AudioBuffer | null = null;
  private noiseBuffers = new Map<number, AudioBuffer>();

  /** Rendered foley: a few variants of each sound, made the first time it is played. */
  private banks = new Map<string, AudioBuffer[]>();
  private lastVariant = new Map<string, number>();

  private ducked = false;
  /** How far down the duck goes: 0 under a video with its own soundtrack, part-way under a cue. */
  private duckLevel = DUCKED;
  private talking = false;
  /** Where the listener stands: the world x of the camera's centre (null until told). */
  private listenerX: number | null = null;
  private surface: Surface = "wood";
  private foot: 1 | -1 = 1;
  /** The room's place sounds, the description they were built from, and its identity. */
  private place: RoomSound = {};
  private placeKey = "";
  private voices: Voice[] = [];

  constructor(private assets: Assets) {
    try {
      const saved = JSON.parse(localStorage.getItem("brasscompass.audio.v1") || "{}");
      this.muted = saved.muted === true;
      const unit = (v: unknown, fallback: number) =>
        typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
      this.volume = unit(saved.volume, this.volume);
      this.musicVolume = unit(saved.music, this.musicVolume);
      this.sfxVolume = unit(saved.sfx, this.sfxVolume);
    } catch { /* settings are optional */ }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.suspend();
        else this.resume();
      });
    }
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.syncSettings();
  }

  setMusicVolume(value: number): void {
    this.musicVolume = Math.max(0, Math.min(1, value));
    this.syncSettings();
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    this.syncSettings();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.syncSettings();
    // Muted, the room's sounds stop being scheduled at all; they pick up again on unmute.
    for (const v of this.voices) {
      if (this.muted) this.disarm(v);
      else this.arm(v);
    }
    return this.muted;
  }

  private get level(): number {
    return this.muted ? 0 : this.volume;
  }

  private syncSettings(): void {
    if (this.master && this.ctx) {
      const g = this.master.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setTargetAtTime(this.level, this.ctx.currentTime, 0.015);
      for (const [bus, v] of [
        [this.musicBus, this.musicVolume], [this.sfxBus, this.sfxVolume], [this.cueBus, this.musicVolume],
      ] as const) {
        if (!bus) continue;
        bus.gain.cancelScheduledValues(this.ctx.currentTime);
        bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015);
      }
    }
    this.syncUnrouted();
    try {
      localStorage.setItem("brasscompass.audio.v1", JSON.stringify({
        muted: this.muted, volume: this.volume, music: this.musicVolume, sfx: this.sfxVolume,
      }));
    } catch {}
  }

  /** Before the context exists a track may be playing unrouted (autoplay allowed): use .volume. */
  private syncUnrouted(): void {
    if (this.current && !this.trackGain.get(this.current)) {
      this.current.volume = this.level * this.musicVolume * this.musicDuckLevel();
    }
  }

  private panner(ctx: AudioContext): StereoPannerNode | null {
    // Old Safari has no StereoPannerNode: everything then simply plays centred.
    return typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
  }

  /** Must be called from a user gesture (browser autoplay policy). Cheap and idempotent. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctor) {
        const context = new Ctor() as AudioContext;
        this.ctx = context;
        this.master = context.createGain();
        this.master.gain.value = this.level;
        this.master.connect(context.destination);
        this.musicDuck = context.createGain();
        this.musicDuck.gain.value = this.musicDuckLevel();
        this.musicDuck.connect(this.master);
        this.musicBus = context.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.musicBus.connect(this.musicDuck);
        this.sfxBus = context.createGain();
        this.sfxBus.gain.value = this.sfxVolume;
        this.sfxBus.connect(this.master);
        // The score shares the Music slider, but not the cinematic duck: the cue is what the
        // duck is making room for. Mute is still the master, so it covers this bus too.
        this.cueBus = context.createGain();
        this.cueBus.gain.value = this.musicVolume;
        this.cueBus.connect(this.master);
        this.envBus = context.createGain();
        this.envBus.gain.value = this.ducked ? this.duckLevel : 1;
        this.envBus.connect(this.sfxBus);
        this.stepPan = this.panner(context);
        this.stepPan?.connect(this.sfxBus);
        // A track requested before the first gesture: route it in at full track level.
        if (this.current) {
          const g = this.route(this.current);
          if (g) g.gain.value = 1;
        }
        // A room entered before the first gesture (the title's harbour) gets its sounds now.
        this.buildVoices();
        this.warm(WARM);
      }
    }
    if (this.hidden) return;
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => {});
    // A room's ambience may have been requested before the first gesture unlocked audio.
    if (this.ambienceKind && !this.ambience) {
      const kind = this.ambienceKind;
      this.ambienceKind = null;
      this.setAmbience(kind);
    }
    if (this.current?.paused) void this.current.play().catch(() => {});
  }

  /** Tab hidden: stop the clock and the music so nothing plays (or piles up) in the background. */
  suspend(): void {
    this.hidden = true;
    for (const el of this.assets.audio.values()) if (!el.paused) el.pause();
    for (const v of this.voices) this.disarm(v);
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend().catch(() => {});
  }

  /** Tab visible again: pick up where we left off. */
  resume(): void {
    this.hidden = false;
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => {});
    if (this.current?.paused) void this.current.play().catch(() => {});
    for (const v of this.voices) this.arm(v);
  }

  // ---------------------------------------------------------------- music

  /** Route a track into the graph once; returns its gain, or null if Web Audio is unavailable. */
  private route(el: HTMLAudioElement): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    if (this.trackGain.has(el)) return this.trackGain.get(el) ?? null;
    let gain: GainNode | null = null;
    try {
      const src = ctx.createMediaElementSource(el);
      gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.musicBus ?? this.master);
      el.volume = 1;   // level is now the graph's job
    } catch {
      gain = null;     // fall back to element volume for this track
    }
    this.trackGain.set(el, gain);
    return gain;
  }

  private ramp(param: AudioParam, target: number, ms: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(target, t + Math.max(0.01, ms / 1000));
  }

  /** The bed's hand-made loop point, or null when this file has no measured trim. */
  private bedEnd(el: HTMLAudioElement): number | null {
    if (this.bedEnds.has(el)) return this.bedEnds.get(el) ?? null;
    const file = (el.src.split("/").pop() ?? "").split("?")[0];
    const known = BED_LOOP_END[file];
    // Metadata may not be in yet: a null then is not final, so only cache a real answer.
    if (!known || !Number.isFinite(el.duration)) return null;
    const end = Math.abs(el.duration - known.duration) < 0.5 ? known.end : null;
    this.bedEnds.set(el, end);
    return end;
  }

  /**
   * Beds loop by hand at their measured musical end, not at the file's end: the generator left
   * up to eight seconds of near-silence after the last note, and a native loop plays all of it.
   * The shipped beds have faded to silence at the loop point, so wrapping is inaudible; an
   * unmeasured or regenerated bed keeps the element's own loop rather than being cut short.
   */
  private watchLoop(el: HTMLAudioElement): void {
    this.unwatchLoop(el);
    const check = (): void => {
      if (this.hidden) return;   // suspended: on resume the next tick picks the loop up
      const end = this.bedEnd(el);
      if (end === null) {
        el.loop = true;   // unmeasured: today's behaviour
        if (el.ended) this.restartBed(el);
        return;
      }
      el.loop = false;
      if (el.ended || (!el.paused && el.currentTime >= end)) this.restartBed(el);
    };
    check();
    this.loopTimers.set(el, window.setInterval(check, LOOP_CHECK * 1000));
  }

  private restartBed(el: HTMLAudioElement): void {
    try { el.currentTime = 0; } catch { /* not seekable yet; the ended event comes round again */ }
    if (el.paused) void el.play().catch(() => { /* autoplay blocked; retried on unlock */ });
  }

  private unwatchLoop(el: HTMLAudioElement): void {
    const timer = this.loopTimers.get(el);
    if (timer !== undefined) window.clearInterval(timer);
    this.loopTimers.delete(el);
  }

  private stopTrack(el: HTMLAudioElement): void {
    this.unwatchLoop(el);
    const timer = this.stopTimers.get(el);
    if (timer !== undefined) window.clearTimeout(timer);
    this.stopTimers.delete(el);
    if (!el.paused) el.pause();
    el.currentTime = 0;
    const g = this.trackGain.get(el);
    if (g && this.ctx) {
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.value = 0;
    }
  }

  playMusic(key: string, fadeMs = 900): void {
    const next = this.assets.audio.get(key);
    if (!next) return;
    if (this.current === next && (!next.paused || this.hidden)) return;

    const old = this.current && this.current !== next ? this.current : null;
    for (const other of this.assets.audio.values()) {
      if (other !== old && other !== next) this.stopTrack(other);
    }

    // `next` may still be fading out from a previous change: cancel its pending stop.
    const pending = this.stopTimers.get(next);
    if (pending !== undefined) { window.clearTimeout(pending); this.stopTimers.delete(next); }

    this.current = next;
    if (next.paused) next.currentTime = 0;
    this.watchLoop(next);

    const gNext = this.route(next);
    if (gNext) this.ramp(gNext.gain, 1, fadeMs);
    else next.volume = this.level * this.musicVolume * this.musicDuckLevel();   // no context yet: nothing to crossfade against
    if (!this.hidden) void next.play().catch(() => { /* autoplay still blocked; retried on unlock */ });

    if (old) {
      const gOld = this.trackGain.get(old);
      if (gOld) {
        this.ramp(gOld.gain, 0, fadeMs);
        this.stopTimers.set(old, window.setTimeout(() => this.stopTrack(old), fadeMs + 120));
      } else {
        this.stopTrack(old);
      }
    }
  }

  // ---------------------------------------------------------------- ducking

  private musicDuckLevel(): number {
    return (this.ducked ? this.duckLevel : 1) * (this.talking ? TALK_DIP : 1);
  }

  /**
   * A cinematic is on: take the music and the room's sound down (over ~0.5 s), and bring them
   * back once it has gone (over ~1 s). A video with its own soundtrack ducks them to nothing;
   * one without a soundtrack ducks them part-way, under a composed cue (`level`).
   */
  duck(on: boolean, level = DUCKED): void {
    const target = on ? Math.max(0, Math.min(1, level)) : DUCKED;
    if (this.ducked === on && this.duckLevel === target) return;
    this.ducked = on;
    this.duckLevel = target;
    if (this.ctx && this.musicDuck && this.envBus) {
      const ms = (on ? DUCK_DOWN : DUCK_UP) * 1000;
      this.ramp(this.musicDuck.gain, this.musicDuckLevel(), ms);
      this.ramp(this.envBus.gain, on ? target : 1, ms);
    }
    this.syncUnrouted();
  }

  /**
   * Every frame: where the listener stands (the world x of the camera's centre) and whether a
   * conversation is on. The room's sounds pan and fade as the camera moves; the music dips a
   * little while people talk.
   */
  frame(listenerX: number, talking = false): void {
    if (talking !== this.talking) {
      this.talking = talking;
      if (this.ctx && this.musicDuck && !this.ducked) {
        this.ramp(this.musicDuck.gain, this.musicDuckLevel(), (talking ? TALK_DOWN : TALK_UP) * 1000);
      }
      this.syncUnrouted();
    }
    if (!Number.isFinite(listenerX)) return;
    if (this.listenerX !== null && Math.abs(listenerX - this.listenerX) < 0.5) return;
    this.listenerX = listenerX;
    const ctx = this.ctx;
    if (!ctx) return;
    for (const v of this.voices) {
      if (!v.at) continue;
      const mix = emitterMix(v.at.x - listenerX);
      if (Math.abs(mix.gain - v.mix.gain) < 0.004 && Math.abs(mix.pan - v.mix.pan) < 0.004) continue;
      v.mix = mix;
      v.out.gain.setTargetAtTime(mix.gain, ctx.currentTime, 0.08);
      v.pan?.pan.setTargetAtTime(mix.pan, ctx.currentTime, 0.08);
    }
  }

  // ---------------------------------------------------------------- the score

  /** A synthesised cue rendered once, at this context's rate, and kept. */
  private cueBuffer(key: string, design: Design): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    let buffer = this.cueBuffers.get(key);
    if (!buffer) {
      const data = renderSound(design, ctx.sampleRate, 1);
      buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      this.cueBuffers.set(key, buffer);
    }
    return buffer;
  }

  /**
   * The cue under a cinematic that has no soundtrack of its own: a composed act-break bed,
   * transposed to the act, through the score bus so the Music slider still works. `seconds` is
   * the video's length, so the cue's last low root lands as the picture does; the cinematic
   * calls `endCue` when it ends or is skipped.
   */
  beginCue(act: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.endCue(120);
    const length = Number.isFinite(seconds) ? Math.max(4, Math.min(14, seconds)) : 8;
    const buffer = this.cueBuffer(`act-break:${act}:${length.toFixed(1)}`, actBreakCue(act, length));
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(LEVEL.actBreak, now + 0.6);
    src.connect(gain).connect(this.cueBus ?? this.master ?? ctx.destination);
    src.start(now);
    const timer = window.setTimeout(() => this.endCue(900), (buffer.duration + 0.05) * 1000);
    this.cue = { src, gain, timer };
  }

  /** Let the cue go over `fadeMs`, so the next act's music comes up through its tail. */
  endCue(fadeMs = 900): void {
    const cue = this.cue;
    if (!cue) return;
    this.cue = null;
    window.clearTimeout(cue.timer);
    const ctx = this.ctx;
    if (ctx) {
      const t = ctx.currentTime;
      const g = cue.gain.gain;
      // Hold whatever the fade-in had reached, then let it die: cancelling alone would jump.
      if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
      g.setTargetAtTime(0, t, Math.max(0.02, fadeMs / 4000));
      try { cue.src.stop(t + Math.max(0.05, fadeMs / 1000) + 0.1); } catch { /* already stopped */ }
    } else {
      try { cue.src.stop(); } catch { /* already stopped */ }
    }
    cue.src.onended = () => {
      try { cue.src.disconnect(); cue.gain.disconnect(); } catch { /* already gone */ }
    };
  }

  /** The compass's leitmotif, in this act's key: it plays when the compass is looked at or used. */
  compass(act: number): void {
    const n = Number.isFinite(act) ? Math.max(1, Math.min(4, Math.round(act))) : 1;
    this.sound(`motif:${n}` as Bank, LEVEL.motif, { dest: this.cueBus ?? undefined });
  }

  /** A casebook note is filed: a soft page and a low chime, low enough to sit under the line. */
  note(): void {
    this.sound("note", LEVEL.note, { rate: 0.98 + Math.random() * 0.04 });
  }

  // ---------------------------------------------------------------- the room

  /**
   * A room's sound: its ambience bed (or gulls), what its floor sounds like underfoot, and the
   * sounds that belong to it. Coming back into the same place keeps what is already playing.
   */
  setRoom(room: RoomSound): void {
    this.surface = room.footsteps && STEPS[room.footsteps] ? room.footsteps : "wood";
    // Rooms change under a black fade: the moment to make anything this one needs.
    if (this.ctx) this.bank(`step:${this.surface}`);
    this.setAmbience(room.ambience && room.ambience !== "gulls" ? room.ambience : null);
    const key = JSON.stringify([room.ambience === "gulls", room.emitters ?? []]);
    if (key === this.placeKey) return;
    this.placeKey = key;
    this.place = room;
    this.dropVoices();
    this.buildVoices();
  }

  private buildVoices(): void {
    const ctx = this.ctx;
    const bus = this.envBus;
    if (!ctx || !bus || this.voices.length) return;
    const specs: { kind: Voice["kind"]; at?: { x: number; y: number } }[] = [...(this.place.emitters ?? [])];
    if (this.place.ambience === "gulls") specs.push({ kind: "gulls" });
    for (const spec of specs) {
      if (spec.kind !== "gulls" && !PLACE[spec.kind]) continue;   // a kind this engine doesn't know
      const at = spec.at ? { x: spec.at.x, y: spec.at.y } : null;
      const mix = at && this.listenerX !== null ? emitterMix(at.x - this.listenerX) : { pan: 0, gain: 1 };
      const out = ctx.createGain();
      out.gain.value = mix.gain;
      const pan = this.panner(ctx);
      if (pan) {
        pan.pan.value = mix.pan;
        out.connect(pan).connect(bus);
      } else {
        out.connect(bus);
      }
      const voice: Voice = { kind: spec.kind, at, out, pan, mix, timer: null };
      this.voices.push(voice);
      if (spec.kind !== "gulls") for (const name of VOICE_BANKS[spec.kind]) this.bank(name);
      this.arm(voice, true);
    }
  }

  /** Let the room's sounds go: they fade with the room, and their nodes are freed after. */
  private dropVoices(): void {
    const ctx = this.ctx;
    for (const v of this.voices) {
      this.disarm(v);
      if (ctx) {
        const t = ctx.currentTime;
        v.out.gain.cancelScheduledValues(t);
        v.out.gain.setValueAtTime(v.out.gain.value, t);
        v.out.gain.setTargetAtTime(0, t, 0.1);
      }
      const nodes: AudioNode[] = v.pan ? [v.out, v.pan] : [v.out];
      window.setTimeout(() => {
        for (const n of nodes) try { n.disconnect(); } catch { /* already gone */ }
      }, 900);
    }
    this.voices = [];
  }

  /** Schedule a voice's next event, unless audio is suspended, muted or not yet unlocked. */
  private arm(v: Voice, first = false): void {
    if (v.timer !== null || !this.ctx || this.hidden || this.muted) return;
    let wait: number;
    if (v.kind === "gulls") {
      const [lo, hi] = first ? GULLS.first : GULLS.every;
      wait = lo + Math.random() * (hi - lo);
    } else {
      const [lo, hi] = PLACE[v.kind].every;
      // On arrival the room's sounds start at scattered moments rather than all at once.
      wait = first ? Math.random() * hi : lo + Math.random() * (hi - lo);
    }
    v.timer = window.setTimeout(() => {
      v.timer = null;
      if (!this.voices.includes(v)) return;
      this.fire(v);
      this.arm(v);
    }, wait * 1000);
  }

  private disarm(v: Voice): void {
    if (v.timer !== null) window.clearTimeout(v.timer);
    v.timer = null;
  }

  /** One event of a room's sound, scheduled a moment ahead on the audio clock. */
  private fire(v: Voice): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.hidden || this.muted) return;
    const t = ctx.currentTime + 0.03;
    const rnd = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
    // A sound that is everywhere (the ship creaking all round) comes from a new side each time.
    if (!v.at && v.pan) v.pan.pan.setValueAtTime(rnd(-0.5, 0.5), t);
    const dest = v.out;
    if (v.kind === "gulls") {
      const calls = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < calls; i++) this.gullCall(dest, rnd(0.9, 1.12), 0.03 + i * rnd(0.5, 0.9), rnd(0.6, 1));
      return;
    }
    const gain = PLACE[v.kind].gain;
    if (v.kind === "crackle") {
      // A few pops close together, now and then a breath of the fire itself.
      let at = 0;
      const pops = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < pops; i++) {
        this.sound("pop", gain * rnd(0.35, 1), { at: t + at, dest, rate: rnd(0.8, 1.3) });
        at += rnd(0.02, 0.14);
      }
      if (Math.random() < 0.15) this.sound("hiss", gain * 0.3, { at: t, dest, rate: rnd(0.9, 1.1) });
    } else if (v.kind === "lapping") {
      this.sound("lap", gain * rnd(0.7, 1), { at: t, dest, rate: rnd(0.9, 1.1) });
    } else if (v.kind === "drip") {
      this.sound("drip", gain * rnd(0.7, 1), { at: t, dest, rate: rnd(0.9, 1.1) });
      if (Math.random() < 0.25) this.sound("drip", gain * rnd(0.4, 0.7), { at: t + rnd(0.25, 0.5), dest, rate: rnd(0.9, 1.1) });
    } else {
      this.sound("creak", gain * rnd(0.6, 1), { at: t, dest, rate: rnd(0.85, 1.1) });
    }
  }

  // ---------------------------------------------------------------- ambience

  /**
   * ~15 s of brown noise whose end is crossfaded into its start, so the loop has no seam.
   * Shared by every bed; the filters make each one distinct.
   */
  private bed(ctx: AudioContext): AudioBuffer {
    if (this.bedBuffer) return this.bedBuffer;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 15);
    const fade = Math.floor(rate * 1.5);
    const raw = new Float32Array(len + fade);
    let last = 0;
    for (let i = 0; i < raw.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;   // brown-ish noise: softer, more natural
      raw[i] = last * 3.2;
    }
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    data.set(raw.subarray(0, len));
    // The head blends from the tail's continuation (raw[len + i]) into the original start, so
    // sample len-1 flows straight into sample 0. Equal-power, as the two are uncorrelated.
    for (let i = 0; i < fade; i++) {
      const t = (i / fade) * (Math.PI / 2);
      data[i] = raw[i] * Math.sin(t) + raw[len + i] * Math.cos(t);
    }
    this.bedBuffer = buf;
    return buf;
  }

  /**
   * Start, change or stop the room's ambience bed. Synthesised from filtered noise so it costs
   * nothing and loops seamlessly; the gain is modulated slowly so it breathes.
   */
  setAmbience(kind: AmbienceKind | null): void {
    if (this.ambienceKind === kind) return;
    this.ambienceKind = kind;

    const ctx = this.ctx;
    if (!ctx) return;

    if (this.ambience) this.stopAmbience(this.ambience);
    this.ambience = null;
    if (!kind) return;

    const src = ctx.createBufferSource();
    src.buffer = this.bed(ctx);
    src.loop = true;
    // Different start points so a bed heard twice does not begin identically.
    const offset = Math.random() * src.buffer.duration;

    const filter = ctx.createBiquadFilter();
    const swell = ctx.createGain();   // base level, modulated by the LFO
    const out = ctx.createGain();     // fade in/out
    let level: number;
    if (kind === "sea") {
      filter.type = "lowpass"; filter.frequency.value = 620;
      level = 0.10;
    } else if (kind === "wind") {
      filter.type = "bandpass"; filter.frequency.value = 520; filter.Q.value = 0.6;
      level = 0.07;
    } else {
      filter.type = "lowpass"; filter.frequency.value = 380;
      level = 0.055;
    }
    swell.gain.value = level;

    // slow swell, so it does not sit flat
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = kind === "sea" ? 0.09 : 0.05;
    lfoGain.gain.value = level * 0.45;
    lfo.connect(lfoGain).connect(swell.gain);

    const now = ctx.currentTime;
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(1, now + 1.2);

    src.connect(filter).connect(swell).connect(out).connect(this.envBus ?? this.sfxBus ?? this.master ?? ctx.destination);
    lfo.start();
    src.start(now, offset);

    const amb: Ambience = { src, lfo, out, nodes: [src, filter, swell, lfo, lfoGain, out], timer: null };
    this.ambience = amb;
    if (kind === "tavern") {
      // The room's own chatter passes through a gentle low-pass so it sits behind the music.
      const room = ctx.createBiquadFilter();
      room.type = "lowpass"; room.frequency.value = 1500;
      room.connect(out);
      amb.nodes.push(room);
      this.scheduleTavern(amb, room, 600);
    }
  }

  private stopAmbience(amb: Ambience): void {
    const ctx = this.ctx!;
    if (amb.timer !== null) window.clearTimeout(amb.timer);
    amb.timer = null;
    const t = ctx.currentTime;
    amb.out.gain.cancelScheduledValues(t);
    amb.out.gain.setValueAtTime(amb.out.gain.value, t);
    amb.out.gain.setTargetAtTime(0, t, 0.4);
    // Stop on the audio clock once the fade is inaudible (~6 time constants), then free the graph.
    const end = t + 2.5;
    amb.src.onended = () => { for (const n of amb.nodes) { try { n.disconnect(); } catch { /* done */ } } };
    try { amb.src.stop(end); } catch { /* already stopped */ }
    try { amb.lfo.stop(end); } catch { /* already stopped */ }
  }

  /** Sparse murmurs and glass clinks, so the tavern reads as a room full of people. */
  private scheduleTavern(amb: Ambience, room: AudioNode, firstMs?: number): void {
    const wait = firstMs ?? 900 + Math.random() * 3200;
    amb.timer = window.setTimeout(() => {
      if (this.ambience !== amb) return;
      if (this.ctx?.state === "running" && !this.hidden && !this.muted) this.tavernEvent(amb, room);
      this.scheduleTavern(amb, room);
    }, wait);
  }

  private tavernEvent(amb: Ambience, room: AudioNode): void {
    const r = Math.random();
    if (r < 0.62) {
      // A voice: a few soft, gliding syllables.
      const base = Math.random() < 0.6 ? 105 + Math.random() * 50 : 190 + Math.random() * 60;
      const syllables = 2 + Math.floor(Math.random() * 4);
      let at = 0;
      const gain = 0.010 + Math.random() * 0.008;
      for (let i = 0; i < syllables; i++) {
        const f = base * (0.9 + Math.random() * 0.25);
        const dur = 0.11 + Math.random() * 0.18;
        this.tone(f, dur, "triangle", gain, f * (0.85 + Math.random() * 0.25), { dest: room, delay: at, attack: 0.04 });
        at += dur * (0.7 + Math.random() * 0.5);
      }
      // Occasionally someone answers.
      if (Math.random() < 0.3) {
        const reply = base * (Math.random() < 0.5 ? 1.5 : 0.75);
        this.tone(reply, 0.2, "triangle", gain * 0.8, reply * 0.9, { dest: room, delay: at + 0.25, attack: 0.05 });
      }
    } else if (r < 0.9) {
      // Glass or tankard: a bright partial and an inharmonic one; sometimes a toast.
      const clinks = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < clinks; i++) {
        const f = 2200 + Math.random() * 1300;
        const delay = i * (0.06 + Math.random() * 0.08);
        const gain = 0.010 + Math.random() * 0.008;
        this.tone(f, 0.14, "sine", gain, undefined, { dest: amb.out, delay });
        this.tone(f * 2.76, 0.07, "sine", gain * 0.45, undefined, { dest: amb.out, delay });
      }
    } else {
      // A chair scrape or a mug set down.
      this.noise(0.12 + Math.random() * 0.12, 0.025, 260 + Math.random() * 200, room);
    }
  }

  // ---------------------------------------------------------------- SFX

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    gain = 0.18,
    sweepTo?: number,
    opts: ToneOptions = {}
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const attack = opts.attack ?? 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo !== undefined) {
      o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.02));
    o.connect(g).connect(opts.dest ?? this.sfxBus ?? this.master ?? ctx.destination);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t0);
    o.stop(t0 + Math.max(dur, attack + 0.02) + 0.02);
  }

  /** A sine that rings on after its attack, like a struck bar: `tau` is how slowly it dies. */
  private ring(freq: number, gain: number, delay: number, tau: number, attack = 0.015): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setTargetAtTime(0, t0 + attack, tau);
    o.connect(g).connect(this.sfxBus ?? this.master ?? ctx.destination);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t0);
    o.stop(t0 + attack + tau * 6);   // -52 dB: gone
  }

  /** Decaying white noise, one buffer per duration (footsteps would otherwise allocate each step). */
  private noiseBuffer(ctx: AudioContext, dur: number): AudioBuffer {
    const key = Math.round(dur * 1000);
    let buf = this.noiseBuffers.get(key);
    if (!buf) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * key / 1000));
      buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      this.noiseBuffers.set(key, buf);
    }
    return buf;
  }

  private noise(dur: number, gain = 0.12, filterHz = 1200, dest?: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, dur);
    // A little variation so a cached buffer does not sound identical every time.
    src.playbackRate.value = 0.92 + Math.random() * 0.16;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest ?? this.sfxBus ?? this.master ?? ctx.destination);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
    src.start();
  }

  /** The variants of a foley sound, rendered the first time it is asked for. */
  private bank(name: Bank): AudioBuffer[] {
    let list = this.banks.get(name);
    if (!list) {
      const ctx = this.ctx!;
      const { design, variants } = BANKS[name];
      list = [];
      const seed = hash(name);
      for (let i = 0; i < variants; i++) {
        const data = renderSound(design, ctx.sampleRate, seed + i);
        const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buf.getChannelData(0).set(data);
        list.push(buf);
      }
      this.banks.set(name, list);
    }
    return list;
  }

  /** Render banks one at a time in idle moments, ahead of their first use. */
  private warm(names: Bank[]): void {
    const next = (): void => {
      const name = names.find((n) => !this.banks.has(n));
      if (!name || !this.ctx) return;
      this.bank(name);
      idle(next);
    };
    idle(next);
  }

  /** Play one variant of a foley sound (never the same one twice running) at peak `gain`. */
  private sound(name: Bank, gain: number, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const list = this.bank(name);
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.lastVariant.get(name)) i = (i + 1) % list.length;
    this.lastVariant.set(name, i);
    const t = opts.at ?? ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = list[i];
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    if (opts.hold !== undefined && Number.isFinite(opts.hold)) g.gain.setTargetAtTime(0, t + opts.hold, 0.012);
    src.connect(g).connect(opts.dest ?? this.sfxBus ?? this.master ?? ctx.destination);
    src.onended = () => { src.disconnect(); g.disconnect(); };
    src.start(t);
  }

  /** The interface click: a soft wooden tick. The most-heard sound in the game. */
  click(): void {
    this.sound("tick", LEVEL.tick, { rate: 0.97 + Math.random() * 0.06 });
  }

  /**
   * One footfall on the room's floor. `pan` is where Fenn stands across the screen (-1 left
   * edge, 1 right), `depth` how far back (0 front of the stage, 1 the horizon), and `run`
   * makes it louder and shorter. Feet alternate.
   */
  step(pan = 0, depth = 0, run = false): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    this.foot = this.foot === 1 ? -1 : 1;
    const mix = stepMix(pan, depth, run, this.foot);
    const t = ctx.currentTime;
    this.stepPan?.pan.setValueAtTime(mix.pan, t);
    this.sound(`step:${this.surface}`, STEPS[this.surface].gain * mix.gain, {
      at: t, dest: this.stepPan ?? undefined, rate: mix.rate * (0.985 + Math.random() * 0.03), hold: mix.hold,
    });
  }

  /** A page turned: the casebook or the line history opening or closing. */
  page(): void {
    this.sound("page", LEVEL.page, { rate: 0.94 + Math.random() * 0.12 });
  }

  /** The date stamp comes down: paper, brass and the desk under both. */
  stamp(): void {
    this.sound("stamp", LEVEL.stamp, { rate: 0.96 + Math.random() * 0.08 });
  }

  /**
   * The night bell above the customs-house door: two tolls, the second softer, left to ring.
   * Both come from the doorway, a little to the left of the desk.
   */
  nightBell(): void {
    this.sound("bell", LEVEL.bell, { rate: 0.99 + Math.random() * 0.02 });
    this.sound("bell", LEVEL.bell * 0.55, { delay: 1.05, rate: 0.965 + Math.random() * 0.02 });
  }

  pickup(): void {
    this.tone(660, 0.09, "triangle", 0.15);
    this.tone(990, 0.12, "triangle", 0.12, undefined, { delay: 0.09 });
    // ...and into the satchel it goes.
    this.sound("satchel", LEVEL.satchel, { delay: 0.05, rate: 0.95 + Math.random() * 0.1 });
  }
  chime(): void {
    this.tone(523, 0.18, "sine", 0.13);
    this.tone(784, 0.24, "sine", 0.11, undefined, { delay: 0.12 });
  }
  /**
   * The ending: C, E, G and the C above, one after another, each left to ring out. The compass
   * comes home with them: its motif, transposed to this act's key, laid inside the chord an
   * octave up, so the last thing the score says is the thing the compass has been saying.
   */
  resolve(act = 4): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.ring(f, 0.065, i * 0.18, 0.42);
      this.ring(f * 2, 0.01, i * 0.18, 0.14, 0.008);
    });
    motifNotes(act, 1).forEach((f, i) => this.ring(f, 0.045, 0.35 + i * 0.3, 0.5));
  }
  deny(): void {
    this.tone(180, 0.14, "sawtooth", 0.07, 120);
  }
  /** Going through an exit: a door unless the exit says otherwise; `none` out in the open. */
  door(kind: DoorKind = "door"): void {
    if (kind === "none") return;
    if (kind === "hatch") {
      this.sound("hatch", LEVEL.hatch, { rate: 0.95 + Math.random() * 0.1 });
      return;
    }
    if (kind === "stairs") {
      // A short flight of wooden steps, going away.
      for (let i = 0; i < 4; i++) {
        this.sound("step:wood", LEVEL.stairs * (1 - i * 0.15), {
          delay: i * 0.17, rate: (i % 2 ? 0.97 : 1.03) * (1 + i * 0.01),
        });
      }
      return;
    }
    this.noise(0.5, 0.1, 420);
    this.tone(90, 0.4, "sine", 0.05, 60);
  }
  gulls(): void {
    this.gullCall();
  }
  private gullCall(dest?: AudioNode, pitch = 1, delay = 0, level = 1): void {
    this.tone(1400 * pitch, 0.18, "sine", 0.05 * level, 900 * pitch, { dest, delay });
    this.tone(1250 * pitch, 0.22, "sine", 0.04 * level, 800 * pitch, { dest, delay: delay + 0.26 });
  }
}

/**
 * Audio — looping music with crossfade, plus procedurally synthesised SFX.
 * Music comes from generated tracks; SFX are synthesised so they stay crisp
 * and cost nothing.
 *
 * Everything audible goes through one Web Audio graph ending in `master`, so mute and volume
 * work everywhere (iOS ignores HTMLMediaElement.volume) and fades are sample-accurate
 * AudioParam ramps rather than timers that background tabs throttle.
 */

import type { Assets } from "./assets";

type AmbienceKind = "sea" | "wind" | "tavern";

interface Ambience {
  src: AudioBufferSourceNode;
  lfo: OscillatorNode;
  /** Ambience output: fades in on start and out on stop, independent of the LFO swell. */
  out: GainNode;
  nodes: AudioNode[];
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
  /** Per-track gain, created once per element (createMediaElementSource may only run once). */
  private trackGain = new Map<HTMLAudioElement, GainNode | null>();
  private stopTimers = new Map<HTMLAudioElement, number>();
  private hidden = typeof document !== "undefined" && document.hidden;

  /** A looping environmental bed: sea, wind or a room full of people. */
  private ambience: Ambience | null = null;
  private ambienceKind: AmbienceKind | null = null;
  private bedBuffer: AudioBuffer | null = null;
  private noiseBuffers = new Map<number, AudioBuffer>();

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
      for (const [bus, v] of [[this.musicBus, this.musicVolume], [this.sfxBus, this.sfxVolume]] as const) {
        if (!bus) continue;
        bus.gain.cancelScheduledValues(this.ctx.currentTime);
        bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015);
      }
    }
    // Before the context exists a track may be playing unrouted (autoplay allowed): use .volume.
    if (this.current && !this.trackGain.get(this.current)) this.current.volume = this.level * this.musicVolume;
    try {
      localStorage.setItem("brasscompass.audio.v1", JSON.stringify({
        muted: this.muted, volume: this.volume, music: this.musicVolume, sfx: this.sfxVolume,
      }));
    } catch {}
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
        this.musicBus = context.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.musicBus.connect(this.master);
        this.sfxBus = context.createGain();
        this.sfxBus.gain.value = this.sfxVolume;
        this.sfxBus.connect(this.master);
        // A track requested before the first gesture: route it in at full track level.
        if (this.current) {
          const g = this.route(this.current);
          if (g) g.gain.value = 1;
        }
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
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend().catch(() => {});
  }

  /** Tab visible again: pick up where we left off. */
  resume(): void {
    this.hidden = false;
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => {});
    if (this.current?.paused) void this.current.play().catch(() => {});
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

  private stopTrack(el: HTMLAudioElement): void {
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
    next.loop = true;
    if (next.paused) next.currentTime = 0;

    const gNext = this.route(next);
    if (gNext) this.ramp(gNext.gain, 1, fadeMs);
    else next.volume = this.level * this.musicVolume;   // no context yet: nothing to crossfade against
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

    src.connect(filter).connect(swell).connect(out).connect(this.sfxBus ?? this.master ?? ctx.destination);
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

  click(): void {
    this.tone(880, 0.05, "square", 0.05);
  }
  step(): void {
    this.noise(0.08, 0.05, 700);
  }
  pickup(): void {
    this.tone(660, 0.09, "triangle", 0.15);
    this.tone(990, 0.12, "triangle", 0.12, undefined, { delay: 0.09 });
  }
  chime(): void {
    this.tone(523, 0.18, "sine", 0.13);
    this.tone(784, 0.24, "sine", 0.11, undefined, { delay: 0.12 });
  }
  deny(): void {
    this.tone(180, 0.14, "sawtooth", 0.07, 120);
  }
  door(): void {
    this.noise(0.5, 0.1, 420);
    this.tone(90, 0.4, "sine", 0.05, 60);
  }
  gulls(): void {
    this.tone(1400, 0.18, "sine", 0.05, 900);
    this.tone(1250, 0.22, "sine", 0.04, 800, { delay: 0.26 });
  }
}

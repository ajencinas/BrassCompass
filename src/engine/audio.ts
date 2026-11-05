/**
 * Audio — looping music with crossfade, plus procedurally synthesised SFX.
 * Music comes from generated tracks; SFX are synthesised so they stay crisp
 * and cost nothing.
 */

import type { Assets } from "./assets";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private current: HTMLAudioElement | null = null;
  private fadeTimer: number | null = null;
  volume = 0.55;
  muted = false;

  private master: GainNode | null = null;
  /** A looping environmental bed: sea, wind or a room full of people. */
  private ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private ambienceKind: string | null = null;
  constructor(private assets: Assets) {
    try {
      const saved = JSON.parse(localStorage.getItem("brasscompass.audio.v1") || "{}");
      this.muted = saved.muted === true;
      if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) this.volume = Math.max(0, Math.min(1, saved.volume));
    } catch { /* settings are optional */ }
  }
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.syncSettings();
  }
  private syncSettings(): void {
    if (this.current) this.current.volume = this.muted ? 0 : this.volume;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    try { localStorage.setItem("brasscompass.audio.v1", JSON.stringify({ muted: this.muted, volume: this.volume })); } catch {}
  }

  /**
   * Start, change or stop the room's ambience bed. Synthesised from filtered noise so it costs
   * nothing and loops seamlessly; the gain is modulated slowly so it breathes.
   */
  setAmbience(kind: "sea" | "wind" | "tavern" | null): void {
    if (this.ambienceKind === kind) return;
    this.ambienceKind = kind;

    const ctx = this.ctx;
    if (!ctx) return;

    if (this.ambience) {
      const old = this.ambience;
      this.ambience = null;
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => { try { old.src.stop(); } catch { /* already stopped */ } }, 1400);
    }
    if (!kind) return;

    const seconds = 4;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;    // brown-ish noise: softer, more natural
      data[i] = last * 3.2;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    if (kind === "sea") {
      filter.type = "lowpass"; filter.frequency.value = 620;
      gain.gain.value = 0.10;
    } else if (kind === "wind") {
      filter.type = "bandpass"; filter.frequency.value = 520; filter.Q.value = 0.6;
      gain.gain.value = 0.07;
    } else {
      filter.type = "lowpass"; filter.frequency.value = 380;
      gain.gain.value = 0.055;
    }

    // slow swell, so it does not sit flat
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = kind === "sea" ? 0.09 : 0.05;
    lfoGain.gain.value = gain.gain.value * 0.45;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    src.connect(filter).connect(gain).connect(this.master ?? ctx.destination);
    src.start();
    this.ambience = { src, gain };
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctor) {
        const context = new Ctor() as AudioContext;
        this.ctx = context;
        this.master = context.createGain();
        this.master.connect(context.destination);
        this.syncSettings();
      }
    }
    void this.ctx?.resume();
    // A room's ambience may have been requested before the first gesture unlocked audio.
    if (this.ambienceKind && !this.ambience) {
      const kind = this.ambienceKind;
      this.ambienceKind = null;
      this.setAmbience(kind as "sea" | "wind" | "tavern");
    }
    if (this.current?.paused) void this.current.play().catch(() => {});
  }

  playMusic(key: string, fadeMs = 900): void {
    const track = this.assets.audio.get(key);
    if (!track) return;
    if (this.current === track && !track.paused) return;

    const old = this.current;
    const next = track;
    for (const other of this.assets.audio.values()) {
      if (other !== old && other !== next) other.pause();
    }
    next.loop = true;
    next.volume = 0;
    next.currentTime = 0;
    void next.play().catch(() => {
      /* autoplay still blocked; retried on first gesture */
    });

    if (this.fadeTimer) window.clearInterval(this.fadeTimer);
    const steps = 24;
    let i = 0;
    this.fadeTimer = window.setInterval(() => {
      i++;
      const t = i / steps;
      next.volume = Math.min(this.volume, t * this.volume) * (this.muted ? 0 : 1);
      if (old && old !== next) old.volume = Math.max(0, (1 - t) * this.volume) * (this.muted ? 0 : 1);
      if (i >= steps) {
        if (this.fadeTimer) window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (old && old !== next) {
          old.pause();
          old.currentTime = 0;
        }
      }
    }, fadeMs / steps);

    this.current = next;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.syncSettings();
    return this.muted;
  }

  // ---------------------------------------------------------------- SFX

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    gain = 0.18,
    sweepTo?: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo !== undefined) {
      o.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    }
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(this.master ?? ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, gain = 0.12, filterHz = 1200): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master ?? ctx.destination);
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
    setTimeout(() => this.tone(990, 0.12, "triangle", 0.12), 90);
  }
  chime(): void {
    this.tone(523, 0.18, "sine", 0.13);
    setTimeout(() => this.tone(784, 0.24, "sine", 0.11), 120);
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
    setTimeout(() => this.tone(1250, 0.22, "sine", 0.04, 800), 260);
  }
}

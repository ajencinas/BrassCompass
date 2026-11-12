// Audio design: room tones stay quieter than the air they sit under, the new interaction cues
// stay under the interface tick, and the room map covers exactly the interiors it claims to.
// Also pins the mix calibration (beds near -21 LUFS at the default master and sliders, effects
// 6-10 dB under them, slider headroom, a limiter that only catches peaks), the master limiter and
// the measured loop points, and drives the music engine through a fake Web Audio graph (no
// click on a first track, equal-power crossfades, A -> B -> C without a hard cut).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const R = await vite.load("/src/engine/roomtone.ts");
const F = await vite.load("/src/engine/foley.ts");
const A = await vite.load("/src/engine/audio.ts");
const S = await vite.load("/src/game/soundscape.ts");
const { ROOMS } = await vite.load("/src/content/rooms.ts");
const RATE = 48000;

function render(design, seed) {
  return F.renderSound(design, RATE, seed);
}
function peak(x) {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return p;
}
/** The design's length in seconds (a layer runs ~6 decay time constants). */
function seconds(x) {
  return x.length / RATE;
}

const CUES = {
  HOVER: F.HOVER, ADVANCE: F.ADVANCE, CHOICE: F.CHOICE,
  THRESHOLD: F.THRESHOLD, SAVE: F.SAVE, ERROR: F.ERROR,
  // The event cues that replaced raw sine/saw tones (pickup, chime, deny, door, gulls) and the
  // new ones (satchel flap, combine, atlas travel, locked door).
  PICKUP: F.PICKUP, CHIME: F.CHIME, DENY: F.DENY, DOOR: F.DOOR, GULL: F.GULL,
  INVENTORY_OPEN: F.INVENTORY_OPEN, INVENTORY_CLOSE: F.INVENTORY_CLOSE,
  COMBINE: F.COMBINE, ATLAS_TRAVEL: F.ATLAS_TRAVEL, LOCKED: F.LOCKED,
};

test("room tone: every interior on the list has an air, and no outdoor room does", () => {
  const required = [
    "tavern", "office", "chandlery", "counting_house",
    "marrow_cabin", "below_decks", "marrow_gallery",
  ];
  for (const id of required) {
    assert.ok(ROOMS[id], `${id} is a real room`);
    assert.ok(S.roomToneFor(id), `${id} needs a room tone`);
  }
  // The hybrids and the other cabins are deliberate too.
  assert.equal(S.roomToneFor("marrow_gallery"), "gallery");
  assert.equal(S.roomToneFor("arcadia_cabin"), "cabin");
  assert.equal(S.roomToneFor("warehouse"), "workshop");
  for (const outdoor of ["dock", "quay", "alley", "village", "salt_camp", "marrow_deck", "crows_nest"]) {
    assert.equal(S.roomToneFor(outdoor), null, `${outdoor} is outdoors and must have no room tone`);
  }
  // No typo can invent a room that does not exist (or a tone kind with no design).
  for (const [id, kind] of Object.entries(S.ROOM_TONE_FOR_ROOM)) {
    assert.ok(ROOMS[id], `mapped room ${id} exists`);
    assert.ok(R.ROOM_TONES[kind], `${id} maps to a known tone`);
  }
  assert.deepEqual(Object.keys(R.ROOM_TONES).sort(),
    ["cabin", "counting", "gallery", "hearth", "hold", "study", "workshop"]);
});

test("room tone: each bed is quiet, low and slow enough to sit under the ambience", () => {
  // The loudest ambience bed is the sea at 0.10; the tick is 0.085.
  for (const [kind, spec] of Object.entries(R.ROOM_TONES)) {
    assert.ok(Number.isFinite(spec.level) && spec.level > 0, `${kind} level`);
    assert.ok(spec.level <= 0.05, `${kind} at ${spec.level} is not a room tone`);
    assert.ok(spec.level < 0.055, `${kind} must sit under the quietest ambience (0.055)`);
    assert.ok(spec.filter.frequency >= 150 && spec.filter.frequency <= 700, `${kind} filter is too bright`);
    assert.ok(spec.lfo.hz > 0 && spec.lfo.hz < 0.2, `${kind} swell is audible as a wobble`);
    assert.ok(spec.lfo.depth > 0 && spec.lfo.depth < 1, `${kind} swell depth`);
    if (spec.air) {
      assert.ok(spec.air.frequency > spec.filter.frequency, `${kind} air sits above the body`);
      assert.ok(spec.air.level > 0 && spec.air.level < 0.2, `${kind} air is a whisper`);
    }
  }
  // The hold and the cabin are the deepest: their bodies are the hull, not the room.
  assert.ok(R.ROOM_TONES.hold.filter.frequency < R.ROOM_TONES.hearth.filter.frequency);
  assert.ok(R.ROOM_TONES.cabin.filter.frequency < R.ROOM_TONES.study.filter.frequency);
  assert.ok(R.ROOM_TONES.hold.level >= R.ROOM_TONES.study.level);
});

test("room tones crossfade: the new air arrives before the old one is gone", () => {
  assert.ok(R.ROOM_TONE_FADE_IN > 0.5 && R.ROOM_TONE_FADE_IN < 3);
  assert.ok(R.ROOM_TONE_FADE_OUT > 0 && R.ROOM_TONE_FADE_OUT < 1);
  // Six time constants is the stop in AudioEngine.stopBed; it must outlast the fade-in.
  assert.ok(R.ROOM_TONE_FADE_OUT * 6 > R.ROOM_TONE_FADE_IN,
    "the outgoing bed must still be fading while the incoming one rises");
});

test("reduced motion drops movement feedback, but never information", () => {
  assert.equal(R.cuePlays("hover", true), false);
  assert.equal(R.cuePlays("threshold", true), false);
  for (const cue of ["advance", "choice", "chart", "save", "error"]) {
    assert.equal(R.cuePlays(cue, true), true, `${cue} is information and must still sound`);
  }
  for (const cue of ["hover", "arm", "advance", "choice", "chart", "threshold", "save", "error"]) {
    assert.equal(R.cuePlays(cue, false), true, `${cue} sounds when motion is allowed`);
  }
  // The event cues: the atlas's travel sweep describes a journey, the rest are information.
  assert.equal(R.cuePlays("travel", true), false);
  for (const cue of ["pickup", "chime", "deny", "inventory", "combine", "locked"]) {
    assert.equal(R.cuePlays(cue, true), true, `${cue} is information and must still sound`);
  }
  for (const cue of ["pickup", "chime", "deny", "inventory", "combine", "travel", "locked"]) {
    assert.equal(R.cuePlays(cue, false), true, `${cue} sounds when motion is allowed`);
  }
});

test("a refused open on something shut is recognised by its line, not by script syntax", () => {
  for (const line of ["Padlocked. Pike has the key on a string.", "Locked. The drawer is winning on points.",
    "The door is bolted.", "A barred window."]) {
    assert.equal(S.isLockedLine(line), true, line);
  }
  for (const line of ["It's unlocked. Unlocking it again would only be showing it the key.",
    "I open the door.", "A clock, stopped."]) {
    assert.equal(S.isLockedLine(line), false, line);
  }
});

test("every sound a script can ask for is a method of the engine, and so is each new cue", () => {
  const T = A.AudioEngine.prototype;
  for (const name of ["click", "pickup", "chime", "deny", "door", "gulls",
    "inventory", "combine", "travel", "locked", "saved", "error", "chart"]) {
    assert.equal(typeof T[name], "function", `AudioEngine.${name}`);
  }
});

test("the new interaction cues render clean, short and reproducible", () => {
  for (const [name, design] of Object.entries(CUES)) {
    for (const seed of [1, 2]) {
      const x = render(design, seed);
      assert.ok(x.length > RATE * 0.01 && x.length < RATE * 2.5, `${name} length ${seconds(x).toFixed(2)} s`);
      assert.ok(Math.abs(peak(x) - 1) < 1e-6, `${name} is not peak-normalised`);
      assert.ok(Math.abs(x[0]) < 0.05, `${name} starts with a click`);
      assert.ok(Math.abs(x[x.length - 1]) === 0, `${name} ends with a click`);
      for (const v of x) assert.ok(Number.isFinite(v), `${name} has a non-finite sample`);
      assert.deepEqual(render(design, seed), x, `${name} seed ${seed} is not reproducible`);
    }
    assert.notDeepEqual(render(design, 1), render(design, 2), `${name} variants are identical`);
  }
  // The hover tick is the shortest thing in the interface; the threshold swell lasts a curtain.
  assert.ok(seconds(render(F.HOVER, 1)) < 0.1);
  assert.ok(seconds(render(F.ADVANCE, 1)) < 0.5);
  assert.ok(seconds(render(F.THRESHOLD, 1)) > 1.2);
  assert.ok(seconds(render(F.ERROR, 1)) < 1.2);
  // The replaced tone() cues are short, soft events, not beeps or buzzes: a clink, a chime, a
  // double thud, a door's creak and latch, a gull's two cries.
  assert.ok(seconds(render(F.PICKUP, 1)) < 0.6);
  assert.ok(seconds(render(F.CHIME, 1)) < 1.2);
  assert.ok(seconds(render(F.DENY, 1)) < 0.6);
  assert.ok(seconds(render(F.DOOR, 1)) > 0.4 && seconds(render(F.DOOR, 1)) < 1.4);
  assert.ok(seconds(render(F.GULL, 1)) > 0.3 && seconds(render(F.GULL, 1)) < 1.5);
  assert.ok(seconds(render(F.LOCKED, 1)) < 1.0);
  assert.ok(seconds(render(F.ATLAS_TRAVEL, 1)) < 2.0);
});

test("the event cues have no hard edge: dark and low where they should be", () => {
  /** Fraction of the sound's energy above `hz`, by a crude first difference (high-pass). */
  const bright = (x) => {
    let hi = 0, all = 0;
    for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1]; hi += d * d; all += x[i] * x[i]; }
    return hi / (all || 1);
  };
  // A deny and a locked door are thuds: little of their energy is bright (a sawtooth buzz has a lot).
  for (const [name, design] of [["DENY", F.DENY], ["LOCKED", F.LOCKED]]) {
    for (const seed of [1, 2, 3]) assert.ok(bright(render(design, seed)) < 0.12, `${name} is too bright to be a thud`);
  }
});

test("cue levels sit under the interface tick; the chart is a bigger gesture than its close", () => {
  const L = F.LEVEL;
  for (const name of ["hover", "arm", "advance", "choice", "chartOpen", "chartClose",
    "chartTone", "threshold", "save", "error",
    "pickup", "chime", "deny", "door", "gull", "inventoryOpen", "inventoryClose", "combine", "travel", "locked"]) {
    assert.ok(Number.isFinite(L[name]) && L[name] > 0 && L[name] < L.tick, `${name} sounds above the click`);
  }
  assert.ok(L.hover < L.arm, "arming a touch is audible above a mouse hover");
  assert.ok(L.hover < L.advance && L.hover < L.choice, "hover is the smallest cue");
  assert.ok(L.chartOpen > L.chartClose, "opening the chart is the larger gesture");
  assert.ok(L.choice > L.advance, "a choice is a slightly more deliberate sound than a line");
  assert.ok(L.threshold < L.tick && L.threshold < L.page, "the threshold stays under door and page");
});

const dB = (x) => 20 * Math.log10(x);

test("mix calibration: beds near -21 LUFS at default settings, foley under them, limiter only on peaks", () => {
  // Measured with ffmpeg ebur128 on the shipped beds (tools/audio-test.mjs documents the method):
  // -15.5 to -17.2 LUFS integrated, true peaks -0.7 to -2.6 dBFS.
  const BED_LUFS = [-17.2, -15.5], BED_WORST_PEAK = -0.7;
  const music = dB(A.MASTER_DEFAULT * A.MUSIC_TRIM * A.sliderGain(A.SLIDER_DEFAULT));
  for (const lufs of BED_LUFS) {
    const at = lufs + music;
    assert.ok(at <= -20 && at >= -23, `a ${lufs} LUFS bed plays at ${at.toFixed(1)} LUFS`);
  }
  // The limiter ceiling is never reached by the music alone at the defaults, with room to spare...
  assert.ok(BED_WORST_PEAK + music < A.LIMITER.threshold - 3, "the default music peaks into the limiter");
  // ...but it is still a limiter: at the top of every slider the loudest bed does reach it.
  const loudest = dB(1 * A.MUSIC_TRIM * A.sliderGain(1));
  assert.ok(BED_WORST_PEAK + loudest > A.LIMITER.threshold, "the limiter can never engage");
  // Effects are 6-10 dB under the beds: a tick every 1.5 s measures -43.5 LUFS before the trim
  // (the walking step -56.5, the sea bed -37.2), against beds at -16 LUFS.
  const sfx = dB(A.MASTER_DEFAULT * A.SFX_TRIM * A.sliderGain(A.SLIDER_DEFAULT));
  const tick = -43.5 + sfx, bed = -16.4 + music;
  assert.ok(bed - tick >= 6 && bed - tick <= 10, `the music is ${(bed - tick).toFixed(1)} dB over the tick`);
  assert.ok(-37.2 + sfx > bed - 3 - 6 && -37.2 + sfx < bed + 3, "the sea ambience is audible beside the music");
  // The loudest one-shot at the default stays under the limiter by itself.
  const loudestShot = Math.max(...["tick", "hatch", "stamp", "bell", "door", "locked"].map((k) => F.LEVEL[k]));
  assert.ok(dB(loudestShot * A.MASTER_DEFAULT * A.SFX_TRIM * A.sliderGain(A.SLIDER_DEFAULT)) < A.LIMITER.threshold,
    "a single effect hits the limiter");
});

test("the sliders have headroom: default is part-way up, the top boosts, zero is silent", () => {
  assert.ok(A.SLIDER_DEFAULT > 0.5 && A.SLIDER_DEFAULT < 0.9);
  assert.ok(A.MASTER_DEFAULT > 0.5 && A.MASTER_DEFAULT < 1);
  assert.equal(A.sliderGain(A.SLIDER_DEFAULT), 1);
  assert.equal(A.sliderGain(0), 0);
  assert.ok(A.sliderGain(1) >= 1.3 && A.sliderGain(1) <= 1.6, `the top of a slider is ${dB(A.sliderGain(1)).toFixed(1)} dB`);
  let last = -1;
  for (let v = 0; v <= 1.0001; v += 0.05) { const g = A.sliderGain(v); assert.ok(g > last); last = g; }
  assert.equal(A.sliderGain(NaN), 1, "a bad value falls back to the default");
  assert.equal(A.sliderGain(5), A.sliderGain(1), "past the top is clamped");
  // Effects sit a fixed 20 dB under the music before the sliders: the balance the beds were tuned to.
  assert.ok(Math.abs(dB(A.SFX_TRIM / A.MUSIC_TRIM) - 20) < 0.5);
});

test("equal-power fades: a quarter sine and cosine, constant power across a crossfade", () => {
  assert.equal(A.equalPower(0, 1, 0), 0);
  assert.ok(Math.abs(A.equalPower(0, 1, 1) - 1) < 1e-12);
  assert.equal(A.equalPower(1, 0, 0), 1);
  assert.ok(Math.abs(A.equalPower(1, 0, 1)) < 1e-12);
  for (let u = 0; u <= 1.0001; u += 0.1) {
    const inn = A.equalPower(0, 1, u), out = A.equalPower(1, 0, u);
    assert.ok(Math.abs(inn * inn + out * out - 1) < 1e-9, `power at ${u.toFixed(1)} is ${(inn * inn + out * out).toFixed(3)}`);
  }
  // A linear fade dips 3 dB at the midpoint; this one does not.
  assert.ok(Math.abs(A.equalPower(0, 1, 0.5) - Math.SQRT1_2) < 1e-9);
  // Fading from part-way (a track interrupted mid-fade) keeps to its own endpoints.
  assert.ok(Math.abs(A.equalPower(0.4, 0.9, 1) - 0.9) < 1e-9);
  assert.ok(Math.abs(A.equalPower(0.8, 0.2, 0) - 0.8) < 1e-9);
});

// --- the music engine against a fake graph --------------------------------------------------

function fakeGraph() {
  const now = { t: 0 };
  class Param {
    constructor(v = 1) { this.value = v; this.events = []; }
    setValueAtTime(v, t) { this.events.push(["set", v, t]); this.value = v; }
    linearRampToValueAtTime(v, t) { this.events.push(["ramp", v, t]); this.value = v; }
    setTargetAtTime(v, t) { this.events.push(["target", v, t]); this.value = v; }
    cancelScheduledValues() { this.events.push(["cancel"]); }
    cancelAndHoldAtTime() { this.events.push(["cancel"]); }
  }
  const node = (extra = {}) => ({ connect(n) { return n; }, disconnect() {}, ...extra });
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = "running"; this.destination = node(); }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
    createGain() { return node({ gain: new Param(1) }); }
    createDynamicsCompressor() { return node({ threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); }
    createStereoPanner() { return node({ pan: new Param(0) }); }
    createMediaElementSource() { return node(); }
    createBiquadFilter() { return node({ frequency: new Param(), Q: new Param() }); }
    createOscillator() { return node({ frequency: new Param(), start() {}, stop() {} }); }
    createBufferSource() { return node({ playbackRate: new Param(), start() {}, stop() {} }); }
    createBuffer(c, n) { return { duration: n / 48000, length: n, getChannelData: () => new Float32Array(n) }; }
  }
  const track = (name) => ({
    src: `/assets/audio/${name}.mp3`, paused: true, ended: false, currentTime: 0, duration: NaN, loop: false, volume: 1,
    preload: "metadata", plays: 0, pauses: 0,
    play() { this.paused = false; this.plays++; return Promise.resolve(); },
    pause() { this.paused = true; this.pauses++; },
    addEventListener() {}, removeEventListener() {},
  });
  Object.assign(globalThis, {
    window: globalThis, AudioContext: Ctx,
    document: { hidden: false, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    requestIdleCallback: undefined,
  });
  const audio = new Map(["a", "b", "c"].map((k) => [k, track(k)]));
  const engine = new A.AudioEngine({ audio });
  return { engine, audio, now, ctx: () => engine.ctx };
}
/** The ramp targets and times recorded on a track's gain since its last cancel. */
const ramps = (g) => g.gain.events.filter((e) => e[0] === "ramp");

test("music: a track asked for before the first gesture is silent at first, then swells up", () => {
  const { engine, audio } = fakeGraph();
  engine.playMusic("a");                         // no context yet: the element plays unrouted
  assert.equal(audio.get("a").preload, "auto", "a track that is wanted is fully preloaded");
  engine.unlock();
  const g = engine.trackGain.get(audio.get("a"));
  assert.ok(g, "the track was routed");
  const first = g.gain.events.find((e) => e[0] === "set");
  assert.equal(first[1], 0, "it starts at gain 0, not full level");
  const up = ramps(g);
  assert.ok(up.length >= 8, "the swell is a run of ramps");
  assert.ok(Math.abs(up.at(-1)[1] - 1) < 1e-9, "it ends at full track level");
  const span = up.at(-1)[2] - first[2];
  assert.ok(span > 0.8 && span < 1.5, `the swell takes ${span.toFixed(2)} s`);
});

test("music: a crossfade is equal-power, and A -> B -> C never hard-cuts a track mid-fade", () => {
  const { engine, audio } = fakeGraph();
  engine.unlock();
  const [a, b, c] = ["a", "b", "c"].map((k) => audio.get(k));
  engine.playMusic("a", 1000);
  engine.playMusic("b", 1000);
  const gb = engine.trackGain.get(b), ga = engine.trackGain.get(a);
  // B fades in on a sine, A out on a cosine: at the midpoint both are at ~0.707.
  const mid = (g) => ramps(g)[7][1];   // 8 of 16 segments
  assert.ok(Math.abs(mid(gb) - Math.SQRT1_2) < 0.03, `B at the midpoint is ${mid(gb).toFixed(3)}`);
  assert.ok(Math.abs(mid(ga) - Math.SQRT1_2) < 0.03, `A at the midpoint is ${mid(ga).toFixed(3)}`);
  // C arrives while A is still on its way out: A is faded, not stopped.
  const pausesBefore = a.pauses;
  a.currentTime = 12.5;
  engine.playMusic("c", 1000);
  assert.equal(a.pauses, pausesBefore, "A was paused (cut) by the third change");
  assert.equal(a.currentTime, 12.5, "A was rewound (cut) by the third change");
  assert.equal(a.paused, false, "A is still sounding while it fades");
  assert.ok(Math.abs(ramps(ga).at(-1)[1]) < 1e-9, "A is on its way to silence");
  assert.ok(Math.abs(ramps(engine.trackGain.get(c)).at(-1)[1] - 1) < 1e-9, "C comes up to full");
  assert.ok(engine.stopTimers.has(a) && engine.stopTimers.has(b), "both outgoing tracks are stopped later, once silent");
  for (const t of engine.stopTimers.values()) clearTimeout(t);
});

test("volume changes are announced: a playing video can follow mute and the sliders", () => {
  const { engine } = fakeGraph();
  let calls = 0;
  const off = engine.onChange(() => { calls++; });
  engine.toggleMute();
  engine.setMusicVolume(0.4);
  assert.equal(calls, 2);
  assert.equal(engine.videoVolume, 0, "a muted video is silent");
  engine.toggleMute();
  assert.ok(engine.videoVolume > 0 && engine.videoVolume <= 1);
  const was = engine.videoVolume;
  engine.setMusicVolume(1);
  assert.ok(engine.videoVolume > was, "a louder Music slider is a louder video");
  const before = calls;
  off();
  engine.setVolume(0.2);
  assert.equal(calls, before, "an unsubscribed listener is not called again");
});

test("the audio pass is preserved: limiter and hand-made loop points", () => {
  assert.deepEqual(A.LIMITER, { threshold: -2, knee: 0, ratio: 20, attack: 0.002, release: 0.18 });
  assert.equal(A.LOOP_GUARD_MS, 60);
  // Every shipped bed has a measured musical end before the file's own end (except pans, whose
  // end is the file's end), so the loop watcher has something to wrap and cannot play the
  // near-silence the generator left.
  for (const [file, bed] of Object.entries(A.BED_LOOP_END)) {
    assert.ok(bed.end <= bed.duration, `${file} loops past its length`);
    assert.ok(bed.end >= bed.duration - 9, `${file} cuts too much of the bed`);
    assert.match(file, /\.mp3$/);
  }
  assert.ok(A.SAVE_CUE_GAP_MS >= 5000, "a save cue must not chatter on every autosave");
});

test("the warm list covers the cues a player triggers early, and names only real banks", () => {
  for (const name of ["chime", "inventory:open", "inventory:close", "combine", "travel", "locked", "gull"]) {
    assert.ok(A.WARM.includes(name), `${name} is made in idle time, so its first use does not hitch`);
  }
  assert.equal(new Set(A.WARM).size, A.WARM.length, "no bank twice");
});

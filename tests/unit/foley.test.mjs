// Foley: the synthesised sounds render cleanly, the surfaces sound different from one another,
// footsteps and place sounds sit under the interface, and the mixing math behaves at the edges.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const F = await vite.load("/src/engine/foley.ts");
const A = await vite.load("/src/engine/audio.ts");
const RATE = 48000;

/** ITU-R BS.1770 K-weighting at 48 kHz: the usual stand-in for how loud something sounds. */
function kweight(x) {
  const stages = [
    [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1, -2, 1, -1.99004745483398, 0.99007225036621],
  ];
  let y = Float64Array.from(x);
  for (const [b0, b1, b2, a1, a2] of stages) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const out = new Float64Array(y.length);
    for (let i = 0; i < y.length; i++) {
      const x0 = y[i];
      const v = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = v;
      out[i] = v;
    }
    y = out;
  }
  return y;
}
/** Loudest 100 ms of a sound played at peak `gain`, in dB (LUFS-like). */
function loudness(x, gain) {
  const padded = new Float32Array(x.length + RATE / 10);
  padded.set(x);
  const y = kweight(padded);
  const w = RATE / 10;
  let acc = 0, best = 0;
  for (let i = 0; i < y.length; i++) {
    acc += y[i] * y[i];
    if (i >= w) acc -= y[i - w] * y[i - w];
    best = Math.max(best, acc / w);
  }
  return -0.691 + 10 * Math.log10(best * gain * gain + 1e-20);
}
const average = (design, gain, seeds = [1, 2, 3, 4]) =>
  seeds.reduce((sum, seed) => sum + loudness(F.renderSound(design, RATE, seed), gain), 0) / seeds.length;
function crossings(x) {
  let n = 0;
  for (let i = 1; i < x.length; i++) if ((x[i] >= 0) !== (x[i - 1] >= 0)) n++;
  return n / (x.length / RATE);
}

const DESIGNS = {
  ...Object.fromEntries(Object.entries(F.STEPS).map(([k, v]) => ["step:" + k, v.design])),
  TICK: F.TICK, PAGE: F.PAGE, SATCHEL: F.SATCHEL, HATCH: F.HATCH,
  POP: F.POP, HISS: F.HISS, LAP: F.LAP, DRIP: F.DRIP, CREAK: F.CREAK,
};

test("every design renders finite, peak-normalised, click-free and reproducible", () => {
  for (const [name, design] of Object.entries(DESIGNS)) {
    for (const seed of [1, 2, 3]) {
      const x = F.renderSound(design, RATE, seed);
      assert.ok(x.length > RATE * 0.02 && x.length < RATE * 3, `${name} length ${x.length}`);
      let peak = 0;
      for (const v of x) {
        assert.ok(Number.isFinite(v), `${name} has a non-finite sample`);
        peak = Math.max(peak, Math.abs(v));
      }
      assert.ok(Math.abs(peak - 1) < 1e-6, `${name} peak ${peak}`);
      assert.ok(Math.abs(x[0]) < 0.05, `${name} starts with a click (${x[0]})`);
      assert.ok(x[x.length - 1] === 0, `${name} ends with a click`);
      assert.deepEqual(F.renderSound(design, RATE, seed), x, `${name} seed ${seed} is not reproducible`);
    }
    assert.notDeepEqual(F.renderSound(design, RATE, 1), F.renderSound(design, RATE, 2), `${name} variants are identical`);
  }
});

test("every room surface sounds like itself: stone brightest, earth dullest", () => {
  const bright = Object.fromEntries(Object.entries(F.STEPS).map(([k, v]) => [k, crossings(F.renderSound(v.design, RATE, 1))]));
  assert.ok(bright.stone > bright.wood, JSON.stringify(bright));
  assert.ok(bright.wood > bright.deck, JSON.stringify(bright));
  assert.ok(bright.sand > bright.earth, JSON.stringify(bright));
  assert.ok(bright.wood > bright.earth, JSON.stringify(bright));
  assert.deepEqual(Object.keys(F.STEPS).sort(), ["deck", "earth", "sand", "stone", "wood"]);
});

test("footsteps sit well under the interface tick, and at one level across surfaces", () => {
  const tick = average(F.TICK, F.LEVEL.tick, [1, 2, 3]);
  const steps = Object.fromEntries(Object.entries(F.STEPS).map(([k, v]) => [k, average(v.design, v.gain)]));
  for (const [surface, level] of Object.entries(steps)) {
    // In the game a step also goes through a centred panner (-3 dB) the tick does not.
    assert.ok(level <= tick - 8, `${surface} step ${level.toFixed(1)} dB vs tick ${tick.toFixed(1)} dB`);
  }
  const levels = Object.values(steps);
  assert.ok(Math.max(...levels) - Math.min(...levels) < 3, `surfaces spread: ${JSON.stringify(steps)}`);
  // ...and even a running step on the loudest surface stays under the tick.
  const loudest = Math.max(...levels) + 20 * Math.log10(F.stepMix(0, 0, true, 1).gain);
  assert.ok(loudest < tick - 5, `running step ${loudest.toFixed(1)} vs tick ${tick.toFixed(1)}`);
});

test("place sounds are subtle: one event, right beside the camera, is no louder than a tick", () => {
  const tick = average(F.TICK, F.LEVEL.tick, [1, 2, 3]);
  const events = { crackle: F.POP, lapping: F.LAP, drip: F.DRIP, creak: F.CREAK };
  for (const [kind, design] of Object.entries(events)) {
    // In the room it plays through its own panner, centred when beside the camera: -3 dB.
    const level = average(design, F.PLACE[kind].gain) + 20 * Math.log10(Math.SQRT1_2);
    assert.ok(level <= tick, `${kind} ${level.toFixed(1)} dB vs tick ${tick.toFixed(1)} dB`);
    assert.ok(F.PLACE[kind].gain <= 0.1, `${kind} gain`);
    const [lo, hi] = F.PLACE[kind].every;
    assert.ok(lo > 0 && hi > lo, `${kind} interval`);
  }
  assert.ok(F.GULLS.every[0] >= 20 && F.GULLS.every[1] <= 40);
});

test("step mix: feet alternate, far is quieter, running is louder and shorter, pan stays on stage", () => {
  const left = F.stepMix(0, 0, false, -1), right = F.stepMix(0, 0, false, 1);
  assert.ok(Math.abs(right.rate / left.rate - 1.03 / 0.97) < 1e-9, "feet differ by ±3%");
  assert.ok(F.stepMix(0, 1, false, 1).gain < F.stepMix(0, 0.5, false, 1).gain);
  assert.ok(F.stepMix(0, 0.5, false, 1).gain < F.stepMix(0, 0, false, 1).gain);
  const run = F.stepMix(0, 0, true, 1), walk = F.stepMix(0, 0, false, 1);
  assert.ok(run.gain > walk.gain && Number.isFinite(run.hold) && !Number.isFinite(walk.hold));
  assert.equal(F.stepMix(-5, 0, false, 1).pan, -0.5);
  assert.equal(F.stepMix(5, 0, false, 1).pan, 0.5);
  assert.equal(F.stepMix(0, 0, false, 1).pan, 0);
  // A scale curve that bends the wrong way, or a NaN, must not blow the level up.
  assert.deepEqual(F.stepMix(NaN, -3, false, 1), F.stepMix(0, 0, false, 1));
  assert.equal(F.stepMix(0, 7, false, 1).gain, F.stepMix(0, 1, false, 1).gain);
});

test("emitter mix: full and centred on top of it, panned to its side and quieter further off", () => {
  assert.deepEqual(F.emitterMix(0), { pan: 0, gain: 1 });
  let last = 1;
  for (const dx of [200, 600, 960, 1600, 2560]) {
    const r = F.emitterMix(dx), l = F.emitterMix(-dx);
    assert.ok(r.pan > 0 && l.pan < 0 && Math.abs(r.pan + l.pan) < 1e-12, `pan at ${dx}`);
    assert.equal(r.gain, l.gain);
    assert.ok(r.gain < last, `gain falls with distance at ${dx}`);
    last = r.gain;
  }
  // At the screen's edge it is still clearly there; across a wide room it is faint, not gone.
  assert.ok(F.emitterMix(960).gain > 0.5);
  assert.ok(F.emitterMix(2560).gain > 0.15 && F.emitterMix(2560).gain < 0.3);
  assert.ok(Math.abs(F.emitterMix(1e6).pan) <= 0.8);
  assert.deepEqual(F.emitterMix(NaN), { pan: 0, gain: 1 });
});

test("biquad: a lowpass passes the lows and stops the highs", () => {
  const tone = (f) => Float32Array.from({ length: RATE / 10 }, (_, i) => Math.sin((2 * Math.PI * f * i) / RATE));
  const rms = (x) => Math.sqrt(x.slice(x.length / 2).reduce((s, v) => s + v * v, 0) / (x.length / 2));
  const lp = { type: "lowpass", f: 500 };
  assert.ok(rms(F.biquad(tone(100), lp, RATE)) > 0.65);
  assert.ok(rms(F.biquad(tone(8000), lp, RATE)) < 0.01);
  const bp = { type: "bandpass", f: 1000, q: 4 };
  assert.ok(rms(F.biquad(tone(1000), bp, RATE)) > 0.65);
  assert.ok(rms(F.biquad(tone(250), bp, RATE)) < 0.1);
});

// --- the score: the compass's motif, the note stinger and the act-break cue ---

/** RMS of a slice, in dBFS. */
const rmsDb = (x, from = 0, to = x.length) => {
  let acc = 0;
  for (let i = from; i < to; i++) acc += x[i] * x[i];
  return 20 * Math.log10(Math.sqrt(acc / Math.max(1, to - from)) + 1e-12);
};
const peakOut = (x, gain) => {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return p * gain;
};

test("compass motif: four notes under two seconds, transposed by act, quiet as a footnote", () => {
  assert.ok(F.MOTIF.length >= 3 && F.MOTIF.length <= 5, `motif has ${F.MOTIF.length} notes`);
  assert.equal(F.ACT_ROOT.length, 4, "one root per act");
  assert.equal(F.motifNotes(1).length, F.MOTIF.length);
  // Each act has its own key, and the shape is the same intervals in each.
  const roots = [1, 2, 3, 4].map((act) => F.motifNotes(act)[0]);
  assert.equal(new Set(roots.map((f) => f.toFixed(2))).size, 4, "acts transpose the motif");
  for (const act of [1, 2, 3, 4]) {
    const x = F.renderSound(F.compassMotif(act), RATE, 1);
    assert.ok(x.length / RATE < 2, `act ${act} motif is ${(x.length / RATE).toFixed(2)} s`);
    let peak = 0;
    for (const v of x) {
      assert.ok(Number.isFinite(v), `act ${act} has a non-finite sample`);
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(Math.abs(peak - 1) < 1e-6);
    assert.ok(Math.abs(x[0]) < 0.05);
    assert.deepEqual(F.renderSound(F.compassMotif(act), RATE, 1), x, "the motif is reproducible");
  }
  // A higher key crosses zero more often; act IV comes home to C, below act I's D.
  assert.ok(crossings(F.renderSound(F.compassMotif(3), RATE, 1)) > crossings(F.renderSound(F.compassMotif(1), RATE, 1)));
  assert.ok(crossings(F.renderSound(F.compassMotif(4), RATE, 1)) < crossings(F.renderSound(F.compassMotif(1), RATE, 1)));
  // 10 dB under the dialogue-level tick by peak, and no louder over its 1.9 s sustain: a
  // 70 ms tick can be louder than a 1.9 s bell at the same K-weighted maximum.
  assert.ok(Math.abs(20 * Math.log10(F.LEVEL.motif / F.LEVEL.tick) + 10) < 0.6, "peak 10 dB under the tick");
  const motif = average(F.compassMotif(1), F.LEVEL.motif, [1]);
  const tick = average(F.TICK, F.LEVEL.tick, [1, 2, 3]);
  assert.ok(motif <= tick, `motif ${motif.toFixed(1)} dB vs tick ${tick.toFixed(1)} dB`);
  assert.ok(F.LEVEL.motif < 0.05, "a motif, not a fanfare");
  assert.ok(peakOut(F.renderSound(F.compassMotif(1), RATE, 1), F.LEVEL.motif) < 0.05);
});

test("a filed note is a soft page and a low chime, not a notification", () => {
  for (const seed of [1, 2, 3]) {
    const x = F.renderSound(F.NOTE_STINGER, RATE, seed);
    assert.ok(x.length / RATE > 0.8 && x.length / RATE < 3, `note ${(x.length / RATE).toFixed(2)} s`);
    let peak = 0;
    for (const v of x) {
      assert.ok(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(Math.abs(peak - 1) < 1e-6);
  }
  assert.notDeepEqual(F.renderSound(F.NOTE_STINGER, RATE, 1), F.renderSound(F.NOTE_STINGER, RATE, 2), "variants differ");
  // Under the tick K-weighted, and softer by peak than the casebook's own page.
  const note = average(F.NOTE_STINGER, F.LEVEL.note, [1, 2, 3]);
  const tick = average(F.TICK, F.LEVEL.tick, [1, 2, 3]);
  assert.ok(note <= tick, `note ${note.toFixed(1)} dB vs tick ${tick.toFixed(1)} dB`);
  assert.ok(F.LEVEL.note < F.LEVEL.page, "softer than a page turn");
  // The chime is low: after the paper has gone (the second half) it rings under 600 Hz.
  assert.ok(crossings(F.renderSound(F.NOTE_STINGER, RATE, 1).slice(RATE / 2)) < 900);
});

test("act-break cue: covers the whole video, never a silent gap, and rings out into the next act", () => {
  for (const [act, seconds] of [[2, 7], [2, 8], [3, 7], [3, 8], [4, 7], [4, 10]]) {
    const x = F.renderSound(F.actBreakCue(act, seconds), RATE, 1);
    const dur = x.length / RATE;
    assert.ok(dur >= seconds, `act ${act} ${seconds}s cue is only ${dur.toFixed(2)} s`);
    assert.ok(dur <= seconds + 1.7, `act ${act} ${seconds}s cue runs ${dur.toFixed(2)} s`);
    let peak = 0;
    for (const v of x) {
      assert.ok(Number.isFinite(v), `act ${act} ${seconds}s has a non-finite sample`);
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(Math.abs(peak - 1) < 1e-6);
    assert.deepEqual(F.renderSound(F.actBreakCue(act, seconds), RATE, 1), x, "the cue is reproducible");
    // From the swell-in to the last root there is always a bed: the drone covers the video, so
    // no half-second window in the body is dead. This is the "never seven seconds of silence".
    const w = Math.floor(RATE * 0.5);
    for (let at = RATE; at + w <= Math.floor(RATE * (seconds - 1.2)); at += w) {
      const db = rmsDb(x, at, at + w);
      assert.ok(db > -45, `act ${act} ${seconds}s: ${db.toFixed(1)} dBFS at ${(at / RATE).toFixed(1)} s`);
    }
    // ...and its own end is a ring-out (22 dB under the body), for the next act's music to rise into.
    const body = rmsDb(x, Math.floor(RATE * 1.5), Math.floor(RATE * (seconds - 2)));
    const tail = rmsDb(x, x.length - Math.floor(RATE * 0.35));
    assert.ok(tail < body - 22, `act ${act} ${seconds}s tail ${tail.toFixed(1)} vs body ${body.toFixed(1)} dBFS`);
    // The cue is score, not a fanfare: at its level, cue plus the loudest ducked bed sample
    // still leaves room at the default master and Music slider (both buses share the music
    // trim); the loudest bed peaks at -0.7 dBFS (0.92) and is ducked to 0.35 under the cue.
    const chain = A.MASTER_DEFAULT * A.MUSIC_TRIM;
    const sum = (F.LEVEL.actBreak + 0.35 * 0.92) * chain;
    assert.ok(sum < 0.5, `cue + bed peaks at ${sum.toFixed(2)} of full scale`);
  }
  // A longer video gets a longer cue, and the acts are in different keys.
  assert.ok(F.renderSound(F.actBreakCue(4, 10), RATE, 1).length > F.renderSound(F.actBreakCue(4, 7), RATE, 1).length);
  assert.notDeepEqual(F.renderSound(F.actBreakCue(2, 8), RATE, 1), F.renderSound(F.actBreakCue(3, 8), RATE, 1));
});

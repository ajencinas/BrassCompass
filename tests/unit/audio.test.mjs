// Audio design: room tones stay quieter than the air they sit under, the new interaction cues
// stay under the interface tick, and the room map covers exactly the interiors it claims to.
// Also pins the performance pass this branch must preserve: the bus trims, the master limiter,
// and the measured loop points.
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
});

test("cue levels sit under the interface tick; the chart is a bigger gesture than its close", () => {
  const L = F.LEVEL;
  for (const name of ["hover", "arm", "advance", "choice", "chartOpen", "chartClose",
    "chartTone", "threshold", "save", "error"]) {
    assert.ok(Number.isFinite(L[name]) && L[name] > 0 && L[name] < L.tick, `${name} sounds above the click`);
  }
  assert.ok(L.hover < L.arm, "arming a touch is audible above a mouse hover");
  assert.ok(L.hover < L.advance && L.hover < L.choice, "hover is the smallest cue");
  assert.ok(L.chartOpen > L.chartClose, "opening the chart is the larger gesture");
  assert.ok(L.choice > L.advance, "a choice is a slightly more deliberate sound than a line");
  assert.ok(L.threshold < L.tick && L.threshold < L.page, "the threshold stays under door and page");
});

test("the performance pass is preserved: trims, limiter and hand-made loop points", () => {
  assert.equal(A.MUSIC_TRIM, 0.18);
  assert.equal(A.SFX_TRIM, 1.8);
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

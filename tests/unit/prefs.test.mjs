// Player preferences: anything in storage gives usable settings, and they round-trip.
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { loadPrefs, savePrefs, hasCompleted, markCompleted, NARRATION_CPS } = await vite.load("/src/game/prefs.ts");

function storage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
beforeEach(() => { globalThis.localStorage = storage(); });

test("defaults follow the OS and read at normal size", () => {
  assert.deepEqual(loadPrefs(), { textSpeed: null, waitForClick: false, textScale: 1, reducedMotion: null });
});

test("preferences round-trip", () => {
  const p = { textSpeed: "fast", waitForClick: true, textScale: 1.5, reducedMotion: false };
  savePrefs(p);
  assert.deepEqual(loadPrefs(), p);
});

test("junk in storage falls back to defaults, field by field", () => {
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ textSpeed: "ludicrous", textScale: 3, waitForClick: "yes", reducedMotion: true }));
  assert.deepEqual(loadPrefs(), { textSpeed: null, waitForClick: false, textScale: 1, reducedMotion: true });
  localStorage.setItem("brasscompass.prefs.v1", "{not json");
  assert.equal(loadPrefs().textScale, 1);
});

test("finishing the voyage is remembered", () => {
  assert.equal(hasCompleted(), false);
  markCompleted();
  assert.equal(hasCompleted(), true);
});

test("instant text has no typing time", () => {
  assert.equal(NARRATION_CPS.instant, Infinity);
  assert.ok(NARRATION_CPS.slow < NARRATION_CPS.normal && NARRATION_CPS.normal < NARRATION_CPS.fast);
});

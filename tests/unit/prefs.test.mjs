// Player preferences: anything in storage gives usable settings, and they round-trip.
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { loadPrefs, savePrefs, hasCompleted, markCompleted, NARRATION_CPS, effectiveTextSpeed, effectiveTextScale, autoTextScale, highContrast, READING_FACTOR } =
  await vite.load("/src/game/prefs.ts");

function storage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
beforeEach(() => { globalThis.localStorage = storage(); });

test("defaults wait for the player, and fit the screen", () => {
  assert.deepEqual(loadPrefs(), {
    textSpeed: null, waitForClick: true, textScale: null, reducedMotion: null,
    highContrast: null, readingTime: "normal", revealMode: "hold", skipRead: false, quality: "high",
  });
});

test("the largest text sizes, contrast, reading time and reveal mode are kept; junk is not", () => {
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({
    v: 3, textScale: 2, highContrast: true, readingTime: "xlong", revealMode: "toggle", skipRead: true }));
  const p = loadPrefs();
  assert.deepEqual([p.textScale, p.highContrast, p.readingTime, p.revealMode, p.skipRead], [2, true, "xlong", "toggle", true]);
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, textScale: 1.75 }));
  assert.equal(loadPrefs().textScale, 1.75);
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({
    v: 3, highContrast: "yes", readingTime: "forever", revealMode: "sticky", skipRead: "true" }));
  const j = loadPrefs();
  assert.deepEqual([j.highContrast, j.readingTime, j.revealMode, j.skipRead], [null, "normal", "hold", false]);
  assert.equal(highContrast({ highContrast: true }), true);
  assert.equal(highContrast({ highContrast: false }), false);
  assert.equal(highContrast({ highContrast: null }), false); // no OS query in node
  assert.ok(READING_FACTOR.normal === 1 && READING_FACTOR.long > 1 && READING_FACTOR.xlong > READING_FACTOR.long);
});

test("old saved prefs keep loading; a retired key is ignored and not written back", () => {
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, skipPrologue: true, textSpeed: "fast" }));
  assert.equal(loadPrefs().textSpeed, "fast");
  savePrefs(loadPrefs());
  assert.equal("skipPrologue" in JSON.parse(localStorage.getItem("brasscompass.prefs.v1")), false);
});

test("an unchosen text size grows on a small screen; a chosen one is kept", () => {
  assert.equal(autoTextScale(1), 1);
  assert.equal(autoTextScale(0.711), 1.25); // 1366x768
  assert.equal(autoTextScale(0.4167), 1.5); // 800x600
  assert.equal(effectiveTextScale({ textScale: null }, 0.667), 1.25); // 1280x720
  assert.equal(effectiveTextScale({ textScale: 1 }, 0.667), 1);
  assert.equal(effectiveTextScale({ textScale: 1.5 }, 1), 1.5);
});

test("a pre-version-3 auto-advance was a default, not a choice", () => {
  // The old shipped default let lines move on by themselves. Version 3 asks the player first,
  // so a stored `false` from an older save joins the new default; a version-3 `false` is kept.
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 2, waitForClick: false, textScale: 1.25 }));
  assert.equal(loadPrefs().waitForClick, true);
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, waitForClick: false, textScale: 1.25 }));
  assert.equal(loadPrefs().waitForClick, false);
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, waitForClick: true }));
  assert.equal(loadPrefs().waitForClick, true);
});

test("an old save's 100% was only the default; a new one was chosen", () => {
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ textSpeed: "fast", textScale: 1, waitForClick: false, reducedMotion: null }));
  assert.equal(loadPrefs().textScale, null);
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ textScale: 1.25 }));
  assert.equal(loadPrefs().textScale, 1.25);
  savePrefs({ textSpeed: null, waitForClick: false, textScale: 1, reducedMotion: null });
  assert.equal(loadPrefs().textScale, 1);
});

test("reduced motion shows text at once, whatever speed was chosen", () => {
  assert.equal(effectiveTextSpeed({ textSpeed: "slow" }, true), "instant");
  assert.equal(effectiveTextSpeed({ textSpeed: "slow" }, false), "slow");
  assert.equal(effectiveTextSpeed({ textSpeed: null }, false), "normal");
});

test("preferences round-trip", () => {
  const p = {
    textSpeed: "fast", waitForClick: true, textScale: 1.5, reducedMotion: false,
    highContrast: false, readingTime: "long", revealMode: "toggle", skipRead: true, quality: "low",
  };
  savePrefs(p);
  assert.deepEqual(loadPrefs(), p);
});

test("junk in storage falls back to defaults, field by field", () => {
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, textSpeed: "ludicrous", textScale: 3, waitForClick: "yes", reducedMotion: true }));
  const j = loadPrefs();
  assert.deepEqual([j.textSpeed, j.waitForClick, j.textScale, j.reducedMotion], [null, true, null, true]);
  localStorage.setItem("brasscompass.prefs.v1", "{not json");
  assert.equal(loadPrefs().textScale, null);
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

test("a 100% text size chosen under v2 (or v3) stays 100%; only a version-1 100% means automatic", () => {
  const key = "brasscompass.prefs.v1";
  for (const v of [2, 3]) {
    localStorage.setItem(key, JSON.stringify({ v, textScale: 1 }));
    assert.equal(loadPrefs().textScale, 1, `v${v} stored 100% was a choice`);
  }
  localStorage.setItem(key, JSON.stringify({ v: 2, textScale: null }));
  assert.equal(loadPrefs().textScale, null, "automatic is stored as null");
  localStorage.setItem(key, JSON.stringify({ textScale: 1 }));
  assert.equal(loadPrefs().textScale, null, "a version-1 100% was only the default");
  // A choice survives the save/load round trip and a later migration pass.
  savePrefs({ ...loadPrefs(), textScale: 1 });
  assert.equal(loadPrefs().textScale, 1);
});

test("graphics quality defaults to high, keeps a valid choice and ignores junk", () => {
  assert.equal(loadPrefs().quality, "high");
  for (const q of ["high", "medium", "low"]) {
    localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, quality: q }));
    assert.equal(loadPrefs().quality, q);
  }
  localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, quality: "ultra" }));
  assert.equal(loadPrefs().quality, "high");
});

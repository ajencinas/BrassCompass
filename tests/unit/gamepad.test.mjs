// The controller map: pure data and logic, no browser. A reading of the pad becomes the key
// events the game already answers; held directions repeat; the pause dialog reads the D-pad as Tab.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const {
  BUTTON_KEYS, createPadState, stepPad, pressedControls, settingsEvent,
  STICK_DEADZONE, REPEAT_DELAY_MS, REPEAT_RATE_MS, PAD_CONTROLS,
} = await vite.load("/src/game/gamepad.ts");
const { CONTROLS } = await vite.load("/src/game/controls.ts");

const sample = (down = [], axes = [0, 0]) => {
  const buttons = Array(17).fill(false);
  for (const i of down) buttons[i] = true;
  return { buttons, axes };
};
const keys = (events) => events.map((e) => `${e.type}:${e.shift ? "shift+" : ""}${e.key}${e.repeat ? "*" : ""}`);

test("the face buttons press the keys the game already answers", () => {
  const expected = { 0: "Enter", 1: "Escape", 2: "q", 3: "h", 4: "PageUp", 5: "PageDown", 6: "j", 7: "l", 8: "a", 9: "Pause" };
  for (const [button, key] of Object.entries(expected)) {
    assert.equal(BUTTON_KEYS[button].key, key, `button ${button}`);
    const state = createPadState();
    assert.deepEqual(keys(stepPad(state, sample([Number(button)]), 0)), [`down:${key}`]);
    assert.deepEqual(keys(stepPad(state, sample(), 16)), [`up:${key}`], "release is a key-up");
  }
});

test("the D-pad and the left stick are the arrows, and one direction is one press", () => {
  const state = createPadState();
  assert.deepEqual(keys(stepPad(state, sample([12]), 0)), ["down:ArrowUp"]);
  stepPad(state, sample(), 10);
  assert.deepEqual(keys(stepPad(state, sample([], [0.9, 0.1]), 20)), ["down:ArrowRight"]);
  stepPad(state, sample(), 30);
  assert.deepEqual(keys(stepPad(state, sample([], [-0.1, -0.8]), 40)), ["down:ArrowUp"]);
  stepPad(state, sample(), 50);
  assert.deepEqual(keys(stepPad(state, sample([15], [0.9, 0]), 60)), ["down:ArrowRight"],
    "D-pad and stick on the same direction press once");
  assert.deepEqual(pressedControls(sample([], [STICK_DEADZONE - 0.05, 0])).size, 0, "inside the dead zone is nothing");
  assert.deepEqual([...pressedControls(sample([], [0.7, 0.7])).keys()].length, 1, "a diagonal leans one way");
});

test("a held direction repeats after a delay; a held action does not", () => {
  const state = createPadState();
  stepPad(state, sample([13]), 0);
  assert.deepEqual(stepPad(state, sample([13]), REPEAT_DELAY_MS - 1), []);
  assert.deepEqual(keys(stepPad(state, sample([13]), REPEAT_DELAY_MS)), ["down:ArrowDown*"]);
  assert.deepEqual(stepPad(state, sample([13]), REPEAT_DELAY_MS + REPEAT_RATE_MS - 1), []);
  assert.deepEqual(keys(stepPad(state, sample([13]), REPEAT_DELAY_MS + REPEAT_RATE_MS)), ["down:ArrowDown*"]);
  const a = createPadState();
  stepPad(a, sample([0]), 0);
  assert.deepEqual(stepPad(a, sample([0]), 5000), [], "holding A does not choose twice");
});

test("stick clicks are Tab and Shift+Tab; LB and RB turn the satchel", () => {
  const state = createPadState();
  assert.deepEqual(keys(stepPad(state, sample([11]), 0)), ["down:Tab"]);
  stepPad(state, sample(), 5);
  assert.deepEqual(keys(stepPad(state, sample([10]), 10)), ["down:shift+Tab"]);
  stepPad(state, sample(), 15);
  assert.deepEqual(keys(stepPad(state, sample([4, 5]), 20)), ["down:PageUp", "down:PageDown"]);
});

test("an unmapped button or a short sample is harmless", () => {
  const state = createPadState();
  assert.deepEqual(stepPad(state, { buttons: [false, false], axes: [] }, 0), []);
  assert.deepEqual(stepPad(state, sample([16]), 1), [], "the home button is the system's");
});

test("the pause dialog reads the D-pad as Tab", () => {
  const e = (key) => ({ type: "down", key, shift: false, repeat: false });
  assert.deepEqual(settingsEvent(e("ArrowDown")), { ...e("Tab") });
  assert.deepEqual(settingsEvent(e("ArrowRight")), { ...e("Tab") });
  assert.deepEqual(settingsEvent(e("ArrowUp")), { ...e("Tab"), shift: true });
  assert.equal(settingsEvent(e("Escape")).key, "Escape");
  assert.equal(settingsEvent(e("Enter")).key, "Enter");
});

test("the controls sheet names the controller and the fast-forward key", () => {
  for (const row of PAD_CONTROLS) assert.ok(CONTROLS.some((c) => c[0] === row[0]), row[0]);
  assert.ok(CONTROLS.some(([k]) => /Ctrl/.test(k)), "fast-forward is listed");
});

test("a controller that goes away releases what it held; only the standard layout is used", async () => {
  const { releaseAll, isSupportedPad } = await vite.load("/src/game/gamepad.ts");
  const state = createPadState();
  stepPad(state, sample([2, 12]), 0); // X (hold-to-reveal Q) and D-pad up
  const ups = releaseAll(state);
  assert.deepEqual(keys(ups).sort(), ["up:ArrowUp", "up:q"]);
  assert.equal(state.held.size, 0);
  assert.deepEqual(releaseAll(state), [], "nothing left to release");
  assert.deepEqual(keys(stepPad(state, sample([2]), 5)), ["down:q"], "a later press starts fresh");
  assert.equal(isSupportedPad({ mapping: "standard" }), true);
  assert.equal(isSupportedPad({ mapping: "" }), false);
  assert.equal(isSupportedPad({}), false);
});

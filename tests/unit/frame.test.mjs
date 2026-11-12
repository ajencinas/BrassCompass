// The frame clock and loop: 60 fps gating, clamped steps, and three-strikes recovery.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { FrameClock, FrameLoop, FRAME_MS } = await vite.load("/src/game/frame.ts");

/** Floating-point comparison for the clock's fractional milliseconds. */
const near = (actual, expected, message, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${message}: ${actual} vs ${expected}`);

test("the clock holds at 60 fps on a 120 Hz panel", () => {
  const clock = new FrameClock();
  assert.equal(clock.tick(1000), null, "the first callback only starts the clock");
  let due = 0;
  for (let i = 1; i <= 6; i++) {
    if (clock.tick(1000 + (i * FRAME_MS) / 2) !== null) due++;
  }
  assert.equal(due, 3, "one frame per two callbacks, never one per refresh");
});

test("the first due frame advances by one 60 Hz step", () => {
  const clock = new FrameClock();
  assert.equal(clock.tick(1000), null);
  near(clock.tick(1000 + FRAME_MS), FRAME_MS / 1000, "one frame of game time");
});

test("a stalled tab takes one clamped step, never a burst", () => {
  const clock = new FrameClock();
  assert.equal(clock.tick(1000), null);
  assert.equal(clock.tick(9000), 0.05, "eight seconds asleep becomes the largest honest step");
  near(clock.tick(9000 + FRAME_MS), 1 / 60, "the next callback is an ordinary frame", 1e-6);
});

test("reset means the next callback starts the clock over", () => {
  const clock = new FrameClock();
  assert.equal(clock.tick(1000), null);
  assert.ok(clock.tick(1000 + FRAME_MS) !== null);
  clock.reset();
  assert.equal(clock.tick(50_000), null, "the first callback after a reset only sets the clock");
  near(clock.tick(50_000 + FRAME_MS), 1 / 60, "and the next one advances normally", 1e-6);
});

test("three failed frames raise the failure path, and the loop stays scheduled", () => {
  const hadRaf = Object.prototype.hasOwnProperty.call(globalThis, "requestAnimationFrame");
  const originalRaf = globalThis.requestAnimationFrame;
  const originalError = console.error;
  let pending = null;
  globalThis.requestAnimationFrame = (cb) => { pending = cb; return 1; };
  const announced = [];
  let steps = 0;
  // The expected failure is asserted below; keep the test output clean.
  console.error = () => {};
  try {
    const loop = new FrameLoop({
      step: () => { steps++; throw new Error("boom"); },
      announce: (text) => announced.push(text),
    });
    loop.start();
    let t = 1000;
    pending(t); // starts the clock, no step yet
    for (let i = 0; i < 5; i++) {
      t += FRAME_MS;
      pending(t);
      assert.ok(pending, "the loop always schedules the next frame");
    }
    assert.equal(steps, 3, "the overlay fires on the third failure, then updates stop");
    assert.equal(announced.length, 1, "the failure is read out once");
    assert.match(announced[0], /hit a problem/i);
  } finally {
    console.error = originalError;
    if (hadRaf) globalThis.requestAnimationFrame = originalRaf;
    else delete globalThis.requestAnimationFrame;
  }
});

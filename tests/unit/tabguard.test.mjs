// Two tabs, one save: the storage-event rule that makes the game stop clobbering the other tab.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { SaveTabGuard } = await vite.load("/src/game/tabguard.ts");
const { SAVE_KEY } = await vite.load("/src/game/save.ts");

const event = (over = {}) => ({ key: SAVE_KEY, newValue: JSON.stringify({ room: "dock" }), ...over });

test("another tab's save write is a conflict", () => {
  let now = 1000;
  const guard = new SaveTabGuard(SAVE_KEY, () => now);
  assert.equal(guard.conflicted, false);
  assert.equal(guard.observe(event()), true);
  assert.equal(guard.conflicted, true);
  assert.equal(guard.since, 1000);
  now = 2000;
  assert.equal(guard.observe(event({ newValue: "{}" })), true);
  assert.equal(guard.since, 2000, "the latest write is the one named");
});

test("events for other keys, removals, and unrelated storage are ignored", () => {
  const guard = new SaveTabGuard(SAVE_KEY, () => 1);
  assert.equal(guard.observe(event({ key: "brasscompass.completed" })), false);
  assert.equal(guard.observe(event({ key: "brasscompass.save.archive" })), false);
  assert.equal(guard.observe(event({ key: null })), false, "localStorage.clear() is not a clobber");
  assert.equal(guard.observe(event({ newValue: null })), false, "a removal loses nothing in this tab");
  assert.equal(guard.conflicted, false);
});

test("clearing the conflict lets the tab write again", () => {
  const guard = new SaveTabGuard(SAVE_KEY, () => 5);
  guard.observe(event());
  assert.equal(guard.conflicted, true);
  guard.clear();
  assert.equal(guard.conflicted, false);
  assert.equal(guard.since, null);
});

test("the guard names the live save key it was built for", () => {
  // The game constructs SaveTabGuard with the default key; this keeps them from drifting.
  const guard = new SaveTabGuard();
  assert.equal(guard.observe(event({ key: SAVE_KEY })), true);
  assert.equal(guard.observe(event({ key: "brasscompass.save.v3" })), false);
});

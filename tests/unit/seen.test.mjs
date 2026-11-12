// Lines already read: remembered as hashes, capped, and skipped only when the player asked.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { SeenLines, lineKey, readSeen, writeSeen, SEEN_KEY, shouldSkip, SKIP_DELAY } =
  await vite.load("/src/game/seen.ts");

test("a line is new once, then seen; only a hash is kept", () => {
  const saved = [];
  const seen = new SeenLines([], (keys) => saved.push(keys));
  assert.equal(seen.has("The harbour is quiet."), false);
  assert.equal(seen.add("The harbour is quiet."), true);
  assert.equal(seen.add("The harbour is quiet."), false);
  assert.equal(seen.has("The harbour is quiet."), true);
  assert.equal(saved.length, 1, "only a new line is written");
  assert.ok(!JSON.stringify(saved).includes("harbour"));
  assert.equal(lineKey("a"), lineKey("a"));
  assert.notEqual(lineKey("a"), lineKey("b"));
});

test("the oldest lines are forgotten past the cap", () => {
  const seen = new SeenLines([], () => {}, 3);
  for (const t of ["one", "two", "three", "four"]) seen.add(t);
  assert.equal(seen.size, 3);
  assert.equal(seen.has("one"), false);
  assert.equal(seen.has("four"), true);
});

test("storage round-trips and junk is ignored", () => {
  const map = new Map();
  writeSeen((v) => map.set(SEEN_KEY, v), [lineKey("x")]);
  assert.deepEqual(readSeen((k) => map.get(k) ?? null), [lineKey("x")]);
  map.set(SEEN_KEY, "{nope");
  assert.deepEqual(readSeen((k) => map.get(k) ?? null), []);
  map.set(SEEN_KEY, JSON.stringify([1, "ok", null]));
  assert.deepEqual(readSeen((k) => map.get(k) ?? null), ["ok"]);
});

test("a new line is never skipped; a read one is, by setting or by key", () => {
  assert.equal(shouldSkip(false, true, true), false);
  assert.equal(shouldSkip(true, false, false), false);
  assert.equal(shouldSkip(true, true, false), true);
  assert.equal(shouldSkip(true, false, true), true);
  assert.ok(SKIP_DELAY > 0 && SKIP_DELAY < 1);
});

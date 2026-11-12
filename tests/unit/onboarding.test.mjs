// The first watch: five one-time lessons, offered in order and remembered per browser.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const {
  FirstWatch, LESSONS, LESSON_ORDER, LESSON_TIME, LESSON_KEY, readLessons, writeLessons,
} = await vite.load("/src/game/onboarding.ts");

test("it teaches look, take, use, inventory and chart — once each", () => {
  assert.deepEqual(LESSON_ORDER, ["look", "take", "use", "inventory", "chart", "keys"]);
  assert.equal(LESSONS.keys.text(false), "Q reveal · H tip · J chart · A map · Esc pause");
  for (const id of LESSON_ORDER) {
    assert.equal(LESSONS[id].id, id);
    assert.equal(typeof LESSONS[id].text(false), "string");
    assert.ok(LESSONS[id].text(false).length > 0);
  }
  const saved = [];
  const watch = new FirstWatch([], (taught) => saved.push(taught));
  assert.equal(watch.offer("look"), true);
  assert.equal(watch.offer("look"), false, "a lesson is never offered twice");
  assert.equal(watch.learnt("look"), true);
  assert.deepEqual(saved, [["look"]]);
  assert.equal(watch.current.id, "look");
  assert.equal(watch.current.total, LESSON_TIME);
});

test("lessons queue behind the one showing and then retire", () => {
  const watch = new FirstWatch([]);
  watch.offer("look");
  watch.offer("take");
  assert.equal(watch.current.id, "look");
  assert.equal(watch.current.left, LESSON_TIME);
  watch.tick(LESSON_TIME + 0.01);
  assert.equal(watch.current.id, "take");
  watch.tick(LESSON_TIME + 0.01);
  assert.equal(watch.current, null);
  assert.equal(watch.fresh, true, "two lessons still leaves lessons to teach");
  for (const id of ["use", "inventory", "chart", "keys"]) {
    watch.offer(id);
    watch.tick(LESSON_TIME + 0.01);
  }
  assert.equal(watch.fresh, false, "all five shown means there is nothing left");
  watch.clearQueue();
  assert.equal(watch.current, null);
});

test("a lesson counts as taught only when it takes the screen", () => {
  const saved = [];
  const watch = new FirstWatch([], (taught) => saved.push(taught));
  watch.offer("look");
  watch.offer("take");
  assert.equal(watch.learnt("look"), true, "the showing lesson is taught");
  assert.equal(watch.learnt("take"), false, "a queued lesson has not been seen yet");
  assert.deepEqual(saved, [["look"]], "only the shown lesson is persisted");
  assert.equal(watch.offer("take"), false, "an already queued lesson is not queued twice");
  assert.equal(watch.offer("look"), false, "the showing lesson is not offered again");
  watch.tick(LESSON_TIME + 0.01);
  assert.equal(watch.current.id, "take");
  assert.equal(watch.learnt("take"), true, "promoted from the queue, it is taught now");
  assert.deepEqual(saved.at(-1), ["look", "take"]);
});

test("a queued lesson dropped by a new voyage is offered again, not counted as taught", () => {
  const saved = [];
  const watch = new FirstWatch([], (taught) => saved.push(taught));
  watch.offer("look");
  watch.offer("use");
  watch.clearQueue();
  assert.equal(watch.current, null);
  assert.equal(watch.learnt("use"), false);
  assert.deepEqual(saved, [["look"]]);
  assert.equal(watch.offer("use"), true, "the dropped lesson can still be taught");
  assert.equal(watch.current.id, "use");
});

test("a departed screen freezes the lesson rather than burning it", () => {
  const watch = new FirstWatch([]);
  watch.offer("look");
  watch.tick(100, true);
  assert.equal(watch.current.left, LESSON_TIME);
  watch.tick(1);
  assert.equal(watch.current.left, LESSON_TIME - 1);
  assert.ok(watch.alpha > 0 && watch.alpha <= 1);
});

test("taught lessons survive a browser and junk is ignored", () => {
  assert.equal(LESSON_KEY, "brasscompass.firstwatch.v1");
  const map = new Map();
  writeLessons((v) => map.set(LESSON_KEY, v), ["look", "chart"]);
  assert.deepEqual(readLessons((k) => map.get(k) ?? null).sort(), ["chart", "look"]);
  map.set(LESSON_KEY, JSON.stringify(["look", "nonsense", "chart"]));
  assert.deepEqual(readLessons((k) => map.get(k) ?? null).sort(), ["chart", "look"]);
  map.set(LESSON_KEY, "{not json");
  assert.deepEqual(readLessons((k) => map.get(k) ?? null), []);
  assert.deepEqual(readLessons(() => null), []);
});

test("all five taught means nothing left to show", () => {
  const watch = new FirstWatch(LESSON_ORDER);
  assert.equal(watch.fresh, false);
  assert.equal(watch.offer("look"), false);
});

test("a lesson is announced when it takes the screen, not when it is queued or later dropped", () => {
  const shown = [];
  const watch = new FirstWatch([], () => {}, (id) => shown.push(id));
  watch.offer("look");
  watch.offer("take"); // queued behind "look"
  assert.deepEqual(shown, ["look"], "a queued lesson is not announced yet");
  watch.clearQueue(); // dropped before its turn
  watch.tick(LESSON_TIME + 1);
  assert.deepEqual(shown, ["look"], "a dropped lesson is never announced");
  assert.equal(watch.offer("take"), true, "and it is offered again later");
  assert.deepEqual(shown, ["look", "take"]);
});

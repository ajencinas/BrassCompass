// The exit transition: a door arrival's directional wipe ends with the arrival.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { Transition } = await vite.load("/src/game/transition.ts");
const { emptyLookLine } = await vite.load("/src/game/lines.ts");

test("the entry side clears once the arrival has settled", () => {
  const t = new Transition();
  t.leave({ x: 100, y: 300 });
  t.arrive({ x: 900, y: 400 }, "left");
  assert.equal(t.entrySide(), "left", "the wipe follows the door while the room is revealed");
  assert.ok(t.zoom(0.8, 0, false), "the room settles about the arrival point");
  assert.equal(t.zoom(0, 0, false), null);
  assert.equal(t.entrySide(), null, "a later Restart curtain has no side to come from");
});

test("a curtain with no door leaves no entry side behind", () => {
  const t = new Transition();
  t.leave({ x: 100, y: 300 });
  t.arrive({ x: 900, y: 400 }, "right");
  t.leave(null);
  assert.equal(t.entrySide(), null);
});

test("looking at empty scenery gets varied in-voice replies", () => {
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const line = emptyLookLine(1);
    assert.ok(line.length > 8 && !/undefined|\.\./.test(line), line);
    seen.add(line);
  }
  assert.ok(seen.size >= 4, "the replies vary");
});

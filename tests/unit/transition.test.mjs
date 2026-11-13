// The exit transition: a door arrival's directional wipe ends with the arrival.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { Transition } = await vite.load("/src/game/transition.ts");
const { emptyLookLine } = await vite.load("/src/game/lines.ts");
const { LOGICAL_W, SCENE_H } = await vite.load("/src/engine/view.ts");

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

/**
 * The lean into the door scales the whole scene about the threshold's screen point. A scale-up
 * can only show LESS of the painting, never more, so the frame can never spill past the plate —
 * but that safety rests on three clamps in three files (the camera's clamp, the plate's blit,
 * and the fact that the scale is never below 1). This pins the worst case down, so removing one
 * of those clamps fails here instead of showing a black strip in play.
 */
test("the lean into the door never shows past the edge of the painting", () => {
  const PLATE_W = 2560;   // every room plate is 2560 x 880
  const PLATE_H = SCENE_H;
  for (const cameraX of [0, 320, 640]) {
    for (const doorX of [0, 640, 1920, 2455]) {
      for (const doorY of [0, 440, 880]) {
        const t = new Transition();
        // `leave` takes the world point of the threshold.
        t.leave({ x: cameraX + doorX, y: doorY });
        const zoom = t.zoom(1, cameraX, false);
        assert.ok(zoom, "the lean exists");
        const k = zoom.k;
        assert.ok(k >= 1, "the scene only ever scales up");

        // The world x shown at the left and right edges of the frame.
        const worldAt = (screenX) => cameraX + zoom.x + (screenX - zoom.x) / k;
        const left = worldAt(0);
        const right = worldAt(LOGICAL_W);
        assert.ok(left >= 0, `left edge ${left} is inside the plate`);
        assert.ok(right <= PLATE_W, `right edge ${right} is inside the plate`);
        // Vertically the lean crops; it never exposes a strip above or below the scene.
        const worldYAt = (screenY) => zoom.y + (screenY - zoom.y) / k;
        assert.ok(worldYAt(0) >= 0, "the top edge is inside the painting");
        assert.ok(worldYAt(PLATE_H) <= PLATE_H, "the bottom edge is inside the painting");
        // The door itself never leaves the frame: the lean pivots on it, and a door that is
        // off-frame pins the pivot to the edge it left by.
        assert.ok(zoom.x >= 0 && zoom.x <= LOGICAL_W, "the pivot is on screen");
        assert.ok(zoom.y >= 0 && zoom.y <= PLATE_H, "the pivot is on the scene");
      }
    }
  }
});

test("peekZoom reads the lean without ending the reveal", () => {
  const t = new Transition();
  t.leave({ x: 1050, y: 634 });
  t.arrive({ x: 900, y: 400 }, "left");
  const peek = t.peekZoom(0.3, 640, false);
  const real = t.zoom(0.3, 640, false);
  assert.deepEqual(peek, real, "the peek sees the same transform");
  assert.ok(t.entrySide(), "and the reveal is still going");
  // Reduced motion: no lean at all.
  assert.equal(t.peekZoom(0.3, 640, true), null);
});

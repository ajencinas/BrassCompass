// The scene curtain: smoothstep, the threshold close-up crop, the entry wash, and paint order.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { fadeEase, thresholdCrop, cropScreenPoint, entryFadeBand, drawFade } = await vite.load("/src/game/fade.ts");

const near = (actual, expected, message, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${message}: ${actual} vs ${expected}`);

/** A canvas context that records what the curtain asked it to paint. */
function recorder() {
  const calls = [];
  const gradient = (kind, args) => ({
    kind, args, stops: [],
    addColorStop(at, color) { this.stops.push([at, color]); },
  });
  return {
    calls,
    fillStyle: "",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillRect(x, y, w, h) { calls.push({ op: "fillRect", x, y, w, h, style: this.fillStyle }); },
    save() { calls.push({ op: "save" }); },
    restore() { calls.push({ op: "restore" }); },
    drawImage(...args) { calls.push({ op: "drawImage", args }); },
    createLinearGradient(x0, y0, x1, y1) {
      const g = gradient("linear", [x0, y0, x1, y1]);
      calls.push({ op: "linear", g });
      return g;
    },
    createRadialGradient(...args) {
      const g = gradient("radial", args);
      calls.push({ op: "radial", g });
      return g;
    },
  };
}

const CARD = {
  image: { id: "room painting" },
  imageW: 1000, imageH: 500,
  x: 100, y: 100, w: 200, h: 100,
};

test("the curtain's easing is smoothstep, with exact ends and midpoint", () => {
  assert.equal(fadeEase(0), 0);
  assert.equal(fadeEase(0.5), 0.5);
  assert.equal(fadeEase(1), 1);
  assert.equal(fadeEase(0.25), 0.15625);
  let last = -1;
  for (let f = 0; f <= 1; f += 0.05) {
    const eased = fadeEase(f);
    assert.ok(eased >= last, "the curtain only ever darkens");
    last = eased;
  }
});

test("the passage crop is the frame the player saw, pushed in toward the door", () => {
  // The screen is showing plate x 320..2240 of a 2560 × 880 painting; the door is at 1200,300.
  const wide = {
    image: { id: "room painting" }, imageW: 2560, imageH: 880,
    x: 1200, y: 300, w: 200, h: 400,
    viewW: 1920, viewH: 880,
  };
  const start = thresholdCrop(wide, 1);
  assert.deepEqual([start.sx, start.sy, start.sw, start.sh], [340, 0, 1920, 880],
    "at 1:1 the crop is the screen's own window, settled on the door");
  assert.deepEqual([start.dx, start.dy, start.dw, start.dh], [0, 0, 1920, 880],
    "and it is drawn 1:1 over the scene, so nothing jumps and nothing blurs");

  const pushed = thresholdCrop(wide, 1.34);
  assert.ok(pushed.sw < start.sw && pushed.sh < start.sh, "the crop pushes in as the camera travels");
  near(pushed.sx + pushed.sw / 2, 1300, "and its centre is on the door");
  assert.deepEqual([pushed.dw, pushed.dh], [1920, 880], "it still fills the scene exactly");

  // A door at the painting's edge cannot push its crop outside the plate.
  const edge = thresholdCrop({ ...wide, x: 0, y: 0, w: 40, h: 40 }, 1.34);
  near(edge.sx, 0, "left edge clamps");
  near(edge.sy, 0, "top edge clamps");
  const far = thresholdCrop({ ...wide, x: 2480, y: 780, w: 60, h: 60 }, 1.34);
  near(far.sx, wide.imageW - far.sw, "right edge clamps");
  near(far.sy, wide.imageH - far.sh, "bottom edge clamps");

  // The doorway's own light stays on the doorway as the camera moves.
  const at = cropScreenPoint(pushed, 1300, 500);
  near(at.x, 960, "the door is in the middle of the travelling crop");
  near(at.y, 440);
});

test("the entry wash reads the exit side: direction and which end is black", () => {
  const left = entryFadeBand(0.5, "left");
  assert.equal(left.horizontal, true);
  assert.equal(left.fromFarEnd, false);
  near(left.a, 0.28);
  near(left.b, 0.5);

  const right = entryFadeBand(0.5, "right");
  assert.equal(right.horizontal, true);
  assert.equal(right.fromFarEnd, true);
  near(right.a, 0.28);
  near(right.b, 0.5);

  const above = entryFadeBand(0.5, "above");
  assert.equal(above.horizontal, false);
  assert.equal(above.fromFarEnd, false);
  near(above.a, 0.28);
  near(above.b, 0.5);
  assert.equal(entryFadeBand(0.5, "below").fromFarEnd, true);

  // Clear of black on one side and fully black on the other, clamped for the gradient.
  const clear = entryFadeBand(0, "left");
  near(clear.a, 0.78);
  near(clear.b, 1);
  const dark = entryFadeBand(0, "right");
  near(dark.a, 0);
  near(dark.b, 0.0001);
});

test("a clear screen paints nothing and full black paints once", () => {
  const clear = recorder();
  drawFade(clear, { fade: 0.001, reduced: false, entry: null, card: null });
  assert.equal(clear.calls.length, 0, "nothing is painted under the threshold");

  const black = recorder();
  drawFade(black, { fade: 1, reduced: false, entry: null, card: null });
  assert.deepEqual(black.calls, [
    { op: "fillRect", x: 0, y: 0, w: 1920, h: 1080, style: "rgba(0,0,0,1)" },
  ]);
});

test("the entry reveal is a directional wash, and reduced motion keeps a flat fade", () => {
  const ctx = recorder();
  drawFade(ctx, { fade: 0.5, reduced: false, entry: "right", card: null });
  const gradient = ctx.calls.find((call) => call.op === "linear");
  assert.ok(gradient, "an entry uses a gradient");
  assert.deepEqual(gradient.g.args, [0, 0, 1920, 0], "a right-hand exit reveals horizontally");
  const stops = gradient.g.stops;
  assert.equal(stops.length, 4);
  assert.deepEqual(stops[0], [0, "rgba(0,0,0,0.5)"]);
  near(stops[1][0], 0.28);
  assert.equal(stops[1][1], "rgba(0,0,0,0.5)");
  near(stops[2][0], 0.5001);
  assert.equal(stops[2][1], "rgba(0,0,0,0)");

  const reduced = recorder();
  drawFade(reduced, { fade: 0.5, reduced: true, entry: "right", card: null });
  assert.equal(reduced.calls.some((call) => call.op === "linear"), false, "reduced motion is a plain fade");
  assert.deepEqual(reduced.calls[0], {
    op: "fillRect", x: 0, y: 0, w: 1920, h: 1080, style: "rgba(0,0,0,0.5)",
  });
});

test("the loading cue centres on the visible scene (a phone's crop)", () => {
  const cue = recorder();
  Object.assign(cue, {
    beginPath() {}, fill() {},
    arc(...args) { this.calls.push({ op: "arc", args }); },
    fillText(...args) { this.calls.push({ op: "fillText", args }); },
  });
  drawFade(cue, { fade: 1, reduced: false, entry: null, card: null, waited: 3, center: { x: 700, y: 440 } });
  const arcs = cue.calls.filter((call) => call.op === "arc");
  const text = cue.calls.find((call) => call.op === "fillText");
  assert.ok(text && arcs.length === 8, "the cue is drawn");
  assert.equal(text.args[1], 700, "the Loading word is centred on the visible slice");
  assert.ok(arcs.every((a) => Math.abs(a.args[0] - 700) <= 18), "the ring is too");
  assert.ok(Math.abs(text.args[2] - (440 + 6 + 12)) < 1, "and sits at the middle of the 880-high canvas");
});

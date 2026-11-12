// The scene curtain: smoothstep, the threshold close-up crop, the entry wash, and paint order.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { fadeEase, exitCardCrop, entryFadeBand, drawFade } = await vite.load("/src/game/fade.ts");

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

test("the threshold close-up is centered, clamped and pushed in as the curtain falls", () => {
  const crop = exitCardCrop(CARD, 0);
  assert.deepEqual([crop.sw, crop.sh], [250, 125]);
  near(crop.sx, 75, "the crop is centered on the threshold");
  near(crop.sy, 87.5, "the crop is centered on the threshold");
  near(crop.dw, 2289.6, "it covers the frame");
  near(crop.dh, 1144.8);
  near(crop.dx, -184.8, "and overhangs both sides");
  near(crop.dy, -32.4);
  assert.ok(exitCardCrop(CARD, 1).dw > crop.dw, "the close-up creeps in with the fade");

  // A threshold at the painting's edge cannot show any black outside it.
  const edge = exitCardCrop({ ...CARD, x: 0, y: 0 }, 0);
  near(edge.sx, 0, "left edge clamps");
  near(edge.sy, 0, "top edge clamps");
  const far = exitCardCrop({ ...CARD, x: 900, y: 400 }, 0);
  near(far.sx, 750, "right edge clamps");
  near(far.sy, 375, "bottom edge clamps");

  // A painting smaller than the close-up still has a drawable source rectangle.
  const tiny = exitCardCrop({ ...CARD, imageW: 10, imageH: 10 }, 0);
  near(tiny.sx, 0);
  near(tiny.sy, 0);
  near(tiny.sw, 10);
  near(tiny.sh, 10);
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

test("the threshold card waits for the dark and yields to an entry reveal", () => {
  const early = recorder();
  drawFade(early, { fade: 0.2, reduced: false, entry: null, card: CARD });
  assert.equal(early.calls.some((call) => call.op === "drawImage"), false, "not before the dark");

  const ctx = recorder();
  drawFade(ctx, { fade: 0.5, reduced: false, entry: null, card: CARD });
  const drew = ctx.calls.find((call) => call.op === "drawImage");
  assert.ok(drew, "the threshold is shown under the curtain");
  const crop = exitCardCrop(CARD, fadeEase(0.5));
  assert.deepEqual(drew.args.slice(1), [crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh]);
  assert.equal(drew.args[0], CARD.image);
  assert.ok(ctx.calls.some((call) => call.op === "radial"), "the warm light is laid over it");

  const entry = recorder();
  drawFade(entry, { fade: 0.5, reduced: false, entry: "left", card: CARD });
  assert.equal(entry.calls.some((call) => call.op === "drawImage"), false, "an entry has its own reveal");
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

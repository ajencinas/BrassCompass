// Render performance: the quality presets and the backing-store maths, a debounced resize, the
// device-pixel-ratio watcher, the loading cue on a held curtain, the halo cache, and a video
// that follows mute and volume while it plays.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const V = await vite.load("/src/engine/view.ts");
const FADE = await vite.load("/src/game/fade.ts");
const PAINT = await vite.load("/src/game/paint.ts");
const CINE = await vite.load("/src/game/cinematic.ts");

test("quality presets: high is the designed game; lower ones cap the backing store and drop the blur", () => {
  assert.deepEqual(V.QUALITIES, ["high", "medium", "low"]);
  const high = V.QUALITY_PRESETS.high;
  assert.equal(high.backingW, V.LOGICAL_W, "high keeps the 1920x1080 cap");
  assert.equal(high.cheapGlow, false);
  assert.equal(V.QUALITY_PRESETS.low.cheapGlow, true, "low swaps shadowBlur for a double stroke");
  const px = (q) => V.QUALITY_PRESETS[q].backingW * V.QUALITY_PRESETS[q].backingH;
  assert.ok(px("high") > px("medium") && px("medium") > px("low"));
  // A full-size window on a 2x display: the budget is what limits the backing store.
  const css = [1920, 1080];
  const w = (q) => Math.round(css[0] * V.backingScale(q, 2, ...css));
  assert.equal(w("high"), 1920, "high is at most 1920 wide");
  assert.equal(w("medium"), 1600);
  assert.equal(w("low"), 1280);
  // A small window is never scaled up past 1:1 by a quality preset.
  assert.equal(V.backingScale("high", 1, 960, 540), 1);
  assert.equal(V.backingScale("high", 3, 960, 540), 2, "DPR is capped at 2, as before");
  assert.equal(V.backingScale("nonsense", 1, 960, 540), 1, "an unknown quality is treated as high");
});

test("downscaling uses medium smoothing, not high; 1:1 and above keep the quality's own setting", () => {
  assert.equal(V.smoothingFor("high", 1920), "high");
  assert.equal(V.smoothingFor("high", 2560), "high");
  assert.equal(V.smoothingFor("high", 1280), "medium", "a 1920 plate drawn into 1280 pixels");
  assert.equal(V.smoothingFor("medium", 1280), "medium");
  assert.equal(V.smoothingFor("low", 1280), "low");
});

/** A View over a fake canvas, with window events and timers under the test's control. */
function fakeView() {
  const state = { resizes: 0, dprListeners: [], queries: [], timers: [] };
  const ctx = { setTransform() {}, imageSmoothingEnabled: false, imageSmoothingQuality: "" };
  const canvas = {
    width: 0, height: 0, style: {}, parentElement: { clientWidth: 1280, clientHeight: 720 },
    getContext: () => ctx,
  };
  globalThis.window = {
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
    matchMedia: (q) => {
      const mql = { q, listeners: [], addEventListener(_t, fn) { this.listeners.push(fn); }, removeEventListener(_t, fn) { this.listeners = this.listeners.filter((f) => f !== fn); } };
      state.queries.push(mql);
      return mql;
    },
    setTimeout: (fn, ms) => { const t = { fn, ms, live: true }; state.timers.push(t); return t; },
  };
  const view = new V.View(canvas);
  const resize = view.resize.bind(view);
  view.resize = () => { state.resizes++; resize(); };
  return { view, canvas, ctx, state };
}
const fireTimers = (state) => { const due = state.timers.filter((t) => t.live); for (const t of due) { t.live = false; t.fn(); } };

test("resizeSoon: the first event resizes at once, a burst collapses into one trailing resize", () => {
  const { view, state } = fakeView();
  const base = state.resizes;
  view.resizeSoon();
  assert.equal(state.resizes, base + 1, "leading edge: the canvas follows at once");
  for (let i = 0; i < 40; i++) view.resizeSoon();      // a window being dragged
  assert.equal(state.resizes, base + 1, "the burst did not resize again");
  fireTimers(state);
  assert.equal(state.resizes, base + 2, "one trailing resize, to the final size");
  fireTimers(state);
  assert.equal(state.resizes, base + 2, "and then quiet");
  view.resizeSoon();
  assert.equal(state.resizes, base + 3, "a later, separate resize works again");
});

test("setQuality re-fits the backing store and sets the filter; the glow switch follows", () => {
  const { view, canvas, ctx } = fakeView();
  assert.equal(view.quality, "high");
  assert.equal(view.cheapGlow, false);
  assert.equal(canvas.width, 1280, "a 1280 window at DPR 1 renders 1280 wide");
  assert.equal(ctx.imageSmoothingQuality, "medium", "that is a downscale of the 1920 plates");
  view.setQuality("low");
  assert.equal(view.cheapGlow, true);
  assert.equal(ctx.imageSmoothingQuality, "low");
  window.devicePixelRatio = 2;
  view.setQuality("medium");
  assert.equal(canvas.width, 1600, "a 2x display is capped by the medium budget (1600 wide)");
  view.setQuality("bogus");
  assert.equal(view.quality, "medium", "an unknown quality is ignored");
});

test("a change of devicePixelRatio (another monitor) resizes and re-arms for the new ratio", () => {
  const { view, state } = fakeView();
  assert.equal(state.queries.length, 1);
  assert.match(state.queries[0].q, /resolution: 1dppx/);
  const base = state.resizes;
  window.devicePixelRatio = 2;
  for (const fn of state.queries[0].listeners) fn();
  assert.equal(state.resizes, base + 1, "resized");
  assert.equal(state.queries.length, 2, "listening again");
  assert.match(state.queries[1].q, /resolution: 2dppx/);
  assert.ok(view);
});

test("the curtain shows a loading cue only after a noticeable wait, and fades it in", () => {
  assert.equal(FADE.loadingCueAlpha(0), 0);
  assert.equal(FADE.loadingCueAlpha(FADE.LOADING_CUE_AFTER - 0.01), 0);
  assert.ok(FADE.loadingCueAlpha(FADE.LOADING_CUE_AFTER + 0.25) > 0);
  assert.ok(FADE.loadingCueAlpha(FADE.LOADING_CUE_AFTER + 0.25) < FADE.loadingCueAlpha(FADE.LOADING_CUE_AFTER + 2));
  assert.ok(FADE.loadingCueAlpha(100) <= 1);
  assert.ok(FADE.LOADING_CUE_AFTER >= 1 && FADE.LOADING_CUE_AFTER <= 2);
  assert.ok(FADE.ROOM_WAIT_CAP >= 20 && FADE.ROOM_WAIT_CAP <= 30, "keep waiting well past the old 8 s");
  const draws = (waited, reduced = false, f = 1) => {
    const calls = [];
    const ctx = new Proxy({ globalAlpha: 1 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([String(k), ...a]); }), set: (t, k, v) => { t[k] = v; return true; } });
    FADE.drawFade(ctx, { fade: f, reduced, entry: null, card: null, waited });
    return calls;
  };
  assert.equal(draws(0.5).some((c) => c[0] === "fillText"), false, "no cue yet");
  const cue = draws(3).find((c) => c[0] === "fillText");
  assert.ok(cue && cue[1] === "Loading", "the cue says Loading");
  assert.equal(draws(3, false, 0.5).some((c) => c[0] === "fillText"), false, "never over a half-faded scene");
  // Under reduced motion the ring is the same at any moment (it does not spin).
  const ring = (t) => draws(t, true).filter((c) => c[0] === "arc").map((c) => c.slice(1, 3).map((n) => n.toFixed(2)).join());
  assert.deepEqual(ring(3.0), ring(3.4));
});

test("the figure halo is cached: a figure standing still asks the same question for free", () => {
  const room = { lights: [{ at: { x: 300, y: 500 }, radius: 200, kind: "lantern", colour: "#ffb060" }], haze: [] };
  const a = PAINT.figureWrap(room, 310, 520, 300);
  assert.match(a.colour, /^rgba\(/);
  assert.ok(a.blur >= 10);
  assert.equal(PAINT.figureWrap(room, 310, 520, 300), a, "the same object comes back");
  assert.equal(PAINT.figureWrap(room, 312, 521, 301), a, "a pixel or two away is the same halo");
  const far = PAINT.figureWrap(room, 1500, 520, 300);
  assert.notEqual(far.colour, a.colour, "far from the lamp it is a different tint");
  // A lamp that is doused changes the answer at once, though the figure has not moved.
  let on = true;
  const lit = PAINT.figureWrap(room, 310, 520, 300, () => on);
  on = false;
  const dark = PAINT.figureWrap(room, 310, 520, 300, () => on);
  assert.notEqual(dark.colour, lit.colour, "the cache is keyed on which lights are lit");
  // And it still matches a from-scratch answer for a fresh room.
  const fresh = PAINT.figureWrap({ ...room }, 310, 520, 300);
  assert.deepEqual(fresh, a);
});

function fakeVideo() {
  return { muted: false, volume: 1, src: "", currentTime: 0, duration: NaN, readyState: 0,
    play: () => Promise.resolve(), pause() {}, load() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} };
}

test("a cinematic follows the game's mute and volume while it plays, and lets go when it ends", () => {
  const listeners = new Set();
  const audio = {
    muted: false, volume: 0.8, musicVolume: 0.7, videoVolume: 0.56,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    duck() {}, beginCue() {}, endCue() {},
  };
  const video = fakeVideo();
  // The player builds DOM in its constructor; drive just its volume sync through the prototype.
  const player = Object.create(CINE.CinematicPlayer.prototype);
  player.audio = () => audio;
  player.video = video;
  player.syncVolume();
  assert.equal(video.muted, false);
  assert.equal(video.volume, 0.56);
  audio.muted = true; audio.videoVolume = 0;
  player.syncVolume();
  assert.equal(video.muted, true, "M mid-clip mutes the video");
  assert.equal(video.volume, 0);
  audio.muted = false; audio.videoVolume = 0.8;
  player.syncVolume();
  assert.equal(video.muted, false);
  assert.equal(video.volume, 0.8, "a slider mid-clip changes the video's level");
  // Without the new fields (an older audio object) it falls back to master x music.
  delete audio.videoVolume;
  player.syncVolume();
  assert.ok(Math.abs(video.volume - 0.56) < 1e-9);
});

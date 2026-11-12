// Asset loading: an image is abandoned only when its bytes stop arriving (not after a fixed
// total time), a key that failed for good gets another go when its room is entered or the
// network comes back, a stuck plate gives way to the painted fallback, and a failing mp3 is
// retried and reported once. Run against fake Image / fetch / Audio so every case is a few ms.
import { test, after, mock } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const M = await vite.load("/src/engine/assets.ts");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- fakes ---------------------------------------------------------------------------------
const listeners = {};
globalThis.window = { addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); } };
let imagesWork = true;
globalThis.Image = class {
  constructor() { this.width = 100; this.height = 100; }
  decode() { return Promise.resolve(); }
  set src(url) {
    this._src = url;
    queueMicrotask(() => (imagesWork || url.startsWith("data:") ? this.onload?.() : this.onerror?.()));
  }
  get src() { return this._src; }
};
class FakeAudio {
  constructor() { this.listeners = {}; this.loads = 0; this.preload = ""; this.src = ""; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  load() { this.loads++; }
  fail() { for (const fn of this.listeners.error ?? []) fn(); }
}
globalThis.Audio = FakeAudio;
/** A fetch whose body arrives as `chunks`, each after `gap` ms, then ends (or never does). */
function body({ chunks, gap, hang = false }) {
  let i = 0;
  return {
    ok: true,
    headers: { get: () => "image/png" },
    body: { getReader: () => ({ async read() {
      if (i < chunks) { await sleep(gap); i++; return { done: false, value: new Uint8Array(8) }; }
      if (hang) await new Promise(() => {});
      return { done: true };
    } }) },
  };
}
let nextFetch = () => body({ chunks: 1, gap: 1 });
let fetches = [];
globalThis.fetch = (url, init) => {
  fetches.push(url);
  const res = nextFetch(url);
  // A request that is aborted rejects, as the real one does.
  return new Promise((resolve, reject) => {
    resolve(res);
    init?.signal?.addEventListener?.("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
};
Object.assign(M.LOAD_TIMING, { stallMs: 80, directMs: 200, retryDelayMs: 2, retryAgainMs: 0 });

function assets(extra = {}) {
  const a = new M.Assets();
  a.setCatalog({ bg_a: "/a.png", bg_b: "/b.png", prop_c: "/c.png", ...extra });
  return a;
}

test("a slow image that keeps sending bytes is waited for: the stall clock restarts on every chunk", async () => {
  // 8 chunks 30 ms apart = 240 ms in all: three times the 80 ms stall deadline, never silent for 80.
  nextFetch = () => body({ chunks: 8, gap: 30 });
  fetches = [];
  const a = assets();
  await a.ensure(["bg_a"]);
  assert.ok(a.images.has("bg_a"), "the image arrived");
  assert.equal(a.hasFailed(["bg_a"]), false);
  assert.equal(fetches.length, 1, "one attempt was enough");
});

test("an image that goes silent is abandoned after the stall deadline, retried, then failed with a fallback", async () => {
  // One chunk, then nothing for good: the hung read must be released by the stall abort.
  nextFetch = () => body({ chunks: 1, gap: 5, hang: true });
  fetches = [];
  const a = assets();
  // A fake clock: the stall and retry timers fire only when the test ticks them, so the timing is
  // exact and a loaded CI machine cannot make it flaky. (setImmediate is left real, to let the
  // promise chain run between ticks.)
  mock.timers.enable({ apis: ["setTimeout"] });
  let virtual = 0;
  // The fake reader ignores the abort signal; a real one rejects when aborted. Make it so.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    fetches.push(url);
    const res = nextFetch(url);
    const reader = res.body.getReader();
    const abortable = { async read() {
      return Promise.race([reader.read(), new Promise((_, rej) =>
        init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))]);
    } };
    return Promise.resolve({ ...res, body: { getReader: () => abortable } });
  };
  let finished = false;
  const run = a.ensure(["bg_a"]).then(() => { finished = true; });
  try {
    for (let i = 0; i < 2000 && !finished; i++) {
      await new Promise((r) => setImmediate(r));
      mock.timers.tick(1);
      virtual += 1;
    }
  } finally {
    mock.timers.reset();
  }
  await run;
  const took = virtual;
  assert.equal(fetches.length, 3, "three attempts");
  // Each attempt is silent for the 80 ms stall deadline; the pauses between attempts are 2 and 4 ms.
  assert.ok(took >= 3 * 80 && took <= 3 * 80 + 2 + 4 + 20, `gave up after ${took} virtual ms (3 stalls of 80 ms)`);
  assert.equal(a.hasFailed(["bg_a"]), true);
  assert.ok(a.images.get("bg_a"), "a failed background gets the painted fallback, not black");
  assert.equal(a.isReady("bg_a"), true, "a failed key does not hold the curtain");
  globalThis.fetch = realFetch;
});

test("a failed key is retried when its room is entered again, and the real plate replaces the fallback", async () => {
  // bg_a failed above for a different instance: fail one here.
  nextFetch = () => ({ ok: false, headers: { get: () => "" } });
  const a = assets();
  await a.ensure(["bg_b"]);
  assert.equal(a.hasFailed(["bg_b"]), true);
  const fallback = a.images.get("bg_b");
  assert.ok(fallback);
  // The connection is back: entering the room asks again.
  nextFetch = () => body({ chunks: 2, gap: 1 });
  await a.ensure(["bg_b"]);
  assert.equal(a.hasFailed(["bg_b"]), false, "the retry cleared the failure");
  assert.notEqual(a.images.get("bg_b"), fallback, "the real plate replaced the fallback");
});

test("retries are rate-limited by `minAgeMs`, so entering a room is not a request storm", async () => {
  nextFetch = () => ({ ok: false, headers: { get: () => "" } });
  fetches = [];
  const a = assets();
  await a.ensure(["prop_c"]);
  const before = fetches.length;
  a.retryFailed(["prop_c"], 60_000);        // failed a moment ago: too soon
  await sleep(10);
  assert.equal(fetches.length, before, "no request for a key that has only just failed");
  assert.equal(a.hasFailed(["prop_c"]), true);
});

test("the browser's online event retries everything that failed", async () => {
  nextFetch = () => ({ ok: false, headers: { get: () => "" } });
  const a = assets();
  await a.load({ images: {}, audio: {} }, () => {});     // hooks the online event
  await a.ensure(["bg_a", "prop_c"]);
  assert.equal(a.hasFailed(["bg_a", "prop_c"]), true);
  nextFetch = () => body({ chunks: 1, gap: 1 });
  assert.ok(listeners.online?.length, "the loader listens for online");
  for (const fn of listeners.online) fn();
  await sleep(120);
  assert.equal(a.hasFailed(["bg_a", "prop_c"]), false, "both loaded after the network came back");
  assert.ok(a.images.has("prop_c"));
});

test("giveUp puts the painted fallback under a plate that is still arriving, and the real one wins later", async () => {
  let release;
  nextFetch = () => ({ ok: true, headers: { get: () => "image/png" }, body: { getReader: () => ({
    read: () => new Promise((resolve) => { release = () => resolve({ done: true }); }),
  }) } });
  const a = assets();
  const loading = a.ensure(["bg_a"]);
  await sleep(10);
  assert.equal(a.isReady("bg_a"), false, "still in flight");
  await a.giveUp(["bg_a", "prop_c"]);
  assert.equal(a.isReady("bg_a"), true, "the room can be shown now");
  const fallback = a.images.get("bg_a");
  assert.ok(fallback);
  assert.equal(a.images.has("prop_c"), false, "only backgrounds get a painted fallback");
  release();                                   // the bytes finally end: the real image is made
  await loading;
  assert.ok(a.images.get("bg_a"));
  assert.notEqual(a.images.get("bg_a"), fallback, "the real plate replaced the fallback");
});

test("audio: only the named tracks preload at boot; the rest fetch metadata", async () => {
  const a = new M.Assets();
  await a.load({ images: {}, audio: { music_dock: "/d.mp3", music_sea: "/s.mp3", music_fog: "/f.mp3" } }, () => {},
    { eagerAudio: ["music_dock"] });
  assert.equal(a.audio.get("music_dock").preload, "auto");
  assert.equal(a.audio.get("music_sea").preload, "metadata");
  assert.equal(a.audio.get("music_fog").preload, "metadata");
  const all = new M.Assets();
  await all.load({ images: {}, audio: { x: "/x.mp3" } }, () => {});
  assert.equal(all.audio.get("x").preload, "auto", "with no list every track preloads, as before");
});

test("audio: a failing mp3 is retried with a new URL and the player is told once, quietly", async () => {
  const a = new M.Assets();
  const notices = [];
  a.onNotice = (t) => notices.push(t);
  await a.load({ images: {}, audio: { music_sea: "/s.mp3", music_fog: "/f.mp3" } }, () => {});
  const sea = a.audio.get("music_sea"), fog = a.audio.get("music_fog");
  sea.fail();
  await sleep(40);
  assert.equal(sea.loads, 1, "retried once");
  assert.match(sea.src, /retry=2/, "with a fresh URL, so a cached failure is not served again");
  sea.fail(); await sleep(60);
  assert.equal(sea.loads, 2);
  assert.equal(notices.length, 0, "not reported while there are attempts left");
  sea.fail();                                  // the third failure is final
  assert.equal(notices.length, 1);
  assert.match(notices[0], /music/i);
  fog.fail(); fog.fail(); fog.fail();          // another track fails for good: still one notice in all
  assert.equal(notices.length, 1, "one notice for the whole set, not one per track");
  // The connection comes back (or a room is entered): both get one more attempt.
  const loadsBefore = [sea.loads, fog.loads];
  a.retryAudio();
  assert.deepEqual([sea.loads, fog.loads], [loadsBefore[0] + 1, loadsBefore[1] + 1]);
});

test("retryUrl leaves data and blob URLs alone and adds a query to the rest", () => {
  assert.equal(M.retryUrl("data:image/png;base64,AA", 2), "data:image/png;base64,AA");
  assert.equal(M.retryUrl("/a.png", 2), "/a.png?retry=2");
  assert.equal(M.retryUrl("/a.png?v=1", 3), "/a.png?v=1&retry=3");
});

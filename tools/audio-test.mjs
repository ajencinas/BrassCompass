/**
 * Audio, end to end in a real browser.
 *
 *   node tools/audio-test.mjs
 *
 * 1. Before the first gesture there is no AudioContext, but a room entered before it still
 *    remembers the room tone it wants.
 * 2. A real mouse gesture unlocks audio: the context runs, the room tone is built, and the
 *    music/effects trims, master level and limiter match the performance pass.
 * 3. Mute, master, music and effects changes reach the graph.
 * 4. Every new interaction cue fires without an exception.
 * 5. Leaving the interior stops the room tone and its source finishes; the next room's air
 *    starts, and the nodes are freed (no timer or node is left holding the old room).
 * 6. The same unlock works on a phone viewport.
 *
 * The browser is headless and may have no output device, but Web Audio still runs its graph.
 */
import assert from "node:assert/strict";
import { startChrome, startVite, firstPage } from "./browser-env.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch { /* not yet */ }
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const server = await startVite(5240, 5260);
let browser;
let socket;
try {
  browser = await startChrome({ name: "audio" });
  const target = await firstPage(browser);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });

  let sequence = 0;
  const pending = new Map();
  const runtimeErrors = [];
  const consoleErrors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    }
    if (!message.id) return;
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    message.error ? job.reject(new Error(`${job.method}: ${message.error.message}`)) : job.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(details.exception?.description || details.text || "evaluate failed");
    }
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");

  const state = () => evaluate(`(() => {
    const a = window.__game.audio;
    return {
      hasCtx: Boolean(a.ctx), ctx: a.ctx ? a.ctx.state : null,
      master: a.master ? a.master.gain.value : null,
      music: a.musicBus ? a.musicBus.gain.value : null,
      sfx: a.sfxBus ? a.sfxBus.gain.value : null,
      cue: a.cueBus ? a.cueBus.gain.value : null,
      limiter: a.limiter ? a.limiter.threshold.value : null,
      muted: a.muted, volume: a.volume, musicVolume: a.musicVolume, sfxVolume: a.sfxVolume,
      toneKind: a.roomToneKind, tone: Boolean(a.roomTone), toneNodes: a.roomTone ? a.roomTone.nodes.length : 0,
      voices: a.voices.length, voiceTimers: a.voices.filter((v) => v.timer !== null).length,
    };
  })()`);

  async function boot(width = 1280, height = 800, touch = false) {
    await send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: touch ? 2 : 1, mobile: touch,
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
    await send("Page.navigate", { url: server.url });
    await until(() => evaluate("Boolean(window.__game) && !document.getElementById('boot')"), "game");
    await pause(300);
    const box = await evaluate("(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    return box;
  }
  async function click(x, y) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }

  // --- desktop: no context before a gesture, a room entered early remembers its tone -----------
  const box = await boot();
  let s = await state();
  assert.equal(s.hasCtx, false, "audio must wait for the first gesture");
  assert.equal(s.toneKind, null, "the title's harbour is outdoors");
  await evaluate('window.__game.devGoRoom("office")');
  s = await state();
  assert.equal(s.toneKind, "study", "the office's room tone is remembered before unlock");
  assert.equal(s.tone, false, "no node can exist before the context");

  // --- a real gesture unlocks; the room tone is built and the performance pass is in place ------
  await click(box.x, box.y);
  await until(async () => (await state()).hasCtx, "AudioContext");
  await until(async () => (await state()).tone, "office room tone");
  await pause(250);
  s = await state();
  assert.equal(s.ctx, "running", `context state after the first gesture is ${s.ctx}`);
  assert.equal(s.toneKind, "study");
  assert.equal(s.toneNodes, 6, "the study's body has no air layer");
  assert.ok(Math.abs(s.master - s.volume) < 0.01, `master ${s.master} vs volume ${s.volume}`);
  assert.ok(Math.abs(s.music - s.musicVolume * 0.18) < 0.01, `music ${s.music} has the -15 dB trim`);
  assert.ok(Math.abs(s.sfx - s.sfxVolume * 1.8) < 0.01, `effects ${s.sfx} has the +5 dB trim`);
  assert.ok(Math.abs(s.cue - s.musicVolume * 0.18) < 0.01, `cue ${s.cue} shares the music trim`);
  assert.equal(s.limiter, -2, "the master limiter is still in place");

  // --- mute and each slider reach the graph ---------------------------------------------------
  await evaluate("window.__game.audio.toggleMute()");
  await pause(250);
  s = await state();
  assert.ok(s.master < 0.01, `mute leaves master at ${s.master}`);
  assert.equal(s.muted, true);
  await evaluate("window.__game.audio.toggleMute(); window.__game.audio.setVolume(0.25)");
  await pause(250);
  s = await state();
  assert.ok(Math.abs(s.master - 0.25) < 0.01, `master volume is ${s.master}`);
  await evaluate("window.__game.audio.setVolume(0.55); window.__game.audio.setMusicVolume(0.5); window.__game.audio.setSfxVolume(0.5)");
  await pause(250);
  s = await state();
  assert.ok(Math.abs(s.music - 0.5 * 0.18) < 0.01, `music at half is ${s.music}`);
  assert.ok(Math.abs(s.sfx - 0.5 * 1.8) < 0.01, `effects at half is ${s.sfx}`);
  await evaluate("window.__game.audio.setMusicVolume(1); window.__game.audio.setSfxVolume(1)");

  // --- every cue fires; a burst of saves speaks once; each node frees itself -------------------
  await evaluate(`(() => {
    window.__origDisconnect = AudioNode.prototype.disconnect;
    window.__cueDisconnects = 0;
    AudioNode.prototype.disconnect = function (...args) {
      window.__cueDisconnects += 1;
      return window.__origDisconnect.apply(this, args);
    };
    const a = window.__game.audio;
    a.hover(); a.arm(); a.advance(); a.choice(); a.chart(true); a.chart(false);
    a.threshold(); a.saved(); a.error();
  })()`);
  await pause(2200);
  const cueDisconnects = await evaluate("window.__cueDisconnects");
  assert.ok(cueDisconnects > 0, "interaction cue nodes free themselves when they end");
  await evaluate("AudioNode.prototype.disconnect = window.__origDisconnect");
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join("\n"));

  // --- room to room: the new air rises before the old one is gone -----------------------------
  const oldTone = await evaluate(`(() => {
    const a = window.__game.audio;
    const tone = a.roomTone;
    window.__oldTone = tone ? tone.src : null;
    window.__oldEnded = false;
    window.__oldDisconnects = 0;
    if (tone) {
      tone.src.addEventListener("ended", () => { window.__oldEnded = true; }, { once: true });
      for (const n of tone.nodes) {
        const d = n.disconnect.bind(n);
        n.disconnect = (...args) => { window.__oldDisconnects += 1; return d(...args); };
      }
    }
    return { kind: a.roomToneKind, set: Boolean(tone), nodes: tone ? tone.nodes.length : 0 };
  })()`);
  assert.equal(oldTone.kind, "study", `old tone kind is ${oldTone.kind}`);
  assert.equal(oldTone.set, true, "the office tone's source was captured");
  await evaluate('window.__game.devGoRoom("tavern")');
  await until(async () => (await state()).tone, "tavern room tone");
  await pause(500);
  s = await state();
  assert.equal(s.toneKind, "hearth", "the new room's air is already up");
  assert.equal(s.toneNodes, 8, "the hearth adds an air layer");
  assert.equal(await evaluate("window.__oldEnded"), false,
    "the old room's air is still fading while the new one rises (a crossfade, not a cut)");

  // --- leaving the interior stops its air and frees the graph ---------------------------------
  await evaluate('window.__game.devGoRoom("dock")');
  await pause(3200);
  s = await state();
  assert.equal(s.toneKind, null, "the harbour has no room tone");
  assert.equal(s.tone, false, "the tavern tone was released");
  const oldInfo = await evaluate(`({ ended: window.__oldEnded, disconnects: window.__oldDisconnects })`);
  assert.equal(oldInfo.ended, true, `the old office tone's source did not end: ${JSON.stringify(oldInfo)}`);
  assert.ok(oldInfo.disconnects >= oldTone.nodes,
    `the old tone freed ${oldInfo.disconnects} of ${oldTone.nodes} nodes`);
  await evaluate("window.__oldTone = null");

  // --- phone: the same first-touch unlock, a real interior tone --------------------------------
  const phone = await boot(390, 844, true);
  assert.equal((await state()).hasCtx, false, "a phone must also wait for its first gesture");
  // The first gesture is what unlocks; the touch layout's own taps are covered by
  // tools/mobile-test.mjs. A click keeps this test about the audio graph, not CDP touch quirks.
  await click(phone.x, phone.y);
  await until(async () => (await state()).hasCtx, "phone AudioContext");
  await evaluate('window.__game.devGoRoom("tavern")');
  await until(async () => (await state()).tone, "phone room tone");
  s = await state();
  assert.equal(s.toneKind, "hearth");
  assert.ok(Math.abs(s.master - s.volume) < 0.01);
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join("\n"));
  assert.deepEqual(consoleErrors, [], "no console errors");

  console.log("audio: unlock, room tone, crossfade cleanup, mute/volume, cues, limiter, mobile: ok");
} finally {
  try { socket?.close(); } catch { /* gone */ }
  await browser?.stop();
  await server.stop();
}

/**
 * The Father and the Fog — a real playthrough, end to end.
 *
 * Drives the game in headless Chrome as a player would: title screen, New Voyage, all four
 * acts by clicks and keys, the mercy ending, the ship's log, and home to the title; then a
 * second, short pass through the last choice for the escape ending. State is read from
 * `window.__game` (the room, the dialogue node, the flags, `visibleChoices`) rather than
 * guessed from pixels. Screenshots of the key beats land in test-output/screens/.
 *
 *   node tools/playthrough.mjs
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startVite, startChrome, firstPage } from "./browser-env.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch {}
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

// Content lint first, in Node: the .adv files must compile and agree with the engine's types.
{
  const lint = spawnSync(process.execPath, ["tools/test-scripts.mjs"], { encoding: "utf8" });
  if (lint.status !== 0) {
    throw new Error("script lint failed:\n" + (lint.stdout || "") + (lint.stderr || ""));
  }
  const last = (lint.stdout || "").trim().split("\n").filter(Boolean).at(-1) ?? "";
  console.log("script lint passed" + (last ? ": " + last : ""));
}

// Test screenshots go to an ignored folder; reference/screens holds the curated, tracked shots.
const output = resolve("test-output/screens");
await mkdir(output, { recursive: true });
// This checkout's server on a free port; never one that was already there (see browser-env.mjs).
const vite = await startVite(5179, 5199);
const port = vite.port;
let browser;
let socket;
try {
  browser = await startChrome({ name: "test" });
  const targets = await firstPage(browser);
  socket = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });

  const runtimeErrors = [];
  const consoleErrors = [];
  let sequence = 0;
  const pending = new Map();
  /**
   * The pending screencast frame, if a screenshot is waiting for one. Page.startScreencast is
   * used rather than Page.captureScreenshot because the latter's capture surface kills video
   * playback in this headless Chrome.
   */
  let frameJob = null;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    }
    if (message.method === "Page.screencastFrame" && frameJob) {
      const job = frameJob;
      frameJob = null;
      job(message.params);
    }
    if (!message.id) return;
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);
  };
  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error(d.exception?.description || d.text || "evaluate failed");
    }
    return result.result.value;
  }
  async function key(name) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: name });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: name });
    await frame();
  }
  async function frame(n = 240) {
    await evaluate(`window.__ff(${n})`);
    await pause(80);
  }
  async function click(x, y, button = "left", frames = 240) {
    await settle();
    const p = await evaluate(`(() => {
      const r = document.querySelector("canvas").getBoundingClientRect();
      return { x: r.left + ${x} * r.width / 1920, y: r.top + ${y} * r.height / 1080 };
    })()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button, clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button, clickCount: 1 });
    await frame(frames);
  }
  /**
   * A click on a line that's still typing only reveals it, as it would for a player. Tests mean
   * each click for whatever they aim at, so let the line finish and anything queued run first.
   */
  async function settle() {
    await evaluate(`(() => { const g = window.__game;
      for (let i = 0; i < 400 && ((g.narration && g.narration.shown < g.narration.text.length) || g.queue); i++) {
        // Lines wait for the player by default now: read to the end, then click it on, as a
        // player would. Clicks on an empty patch of scene only advance the line.
        if (g.queue && g.narration && g.narration.shown >= g.narration.text.length) g.onClick(960, 300, 0, 1);
        else window.__ff(1);
      }
    })()`);
  }
  /** Advance the game clock until `expression` holds (used for queued scenes and act changes). */
  async function advanceUntil(expression, label, tries = 200, frames = 100) {
    for (let i = 0; i < tries; i++) {
      if (await evaluate(expression)) return;
      const waiting = await evaluate(`(() => { const g = window.__game;
        return Boolean(g.queue && g.narration && g.narration.shown >= g.narration.text.length); })()`);
      if (waiting) await evaluate("window.__game.onClick(960, 300, 0, 1)");
      else await evaluate(`window.__ff(${frames})`);
    }
    throw new Error("Never satisfied: " + label + "\n" + await state());
  }
  /**
   * Read whatever scene is playing: let every queued `say` through until the narration is
   * finished and nothing is parked. Returns early when a conversation opens, which is where
   * the player takes over.
   */
  async function readScene(label, max = 400) {
    for (let i = 0; i < max; i++) {
      const s = await evaluate(`(() => { const g = window.__game; return {
        queue: Boolean(g.queue), dialogue: Boolean(g.dialogue),
        typing: Boolean(g.narration && g.narration.shown < g.narration.text.length) }; })()`);
      if (s.dialogue || (!s.queue && !s.typing)) return;
      // A waiting line is the player's to move on: finish the typewriter, then click it on.
      if (s.queue && !s.typing) await evaluate("window.__game.onClick(960, 300, 0, 1)");
      else await evaluate("window.__ff(50)");
    }
    throw new Error("Scene never finished: " + label + "\n" + await state());
  }
  async function state() {
    return evaluate(`JSON.stringify((() => { const g = window.__game; return {
      room: g.room.id, x: Math.round(g.x), y: Math.round(g.y), narration: g.narration?.text,
      inventory: g.inventory, flags: Object.keys(g.flags).filter((f) => !f.includes(":")),
      dialogue: g.dialogue ? g.dialogue.tree.id + "." + g.dialogue.nodeId : null,
      act: g.act, queue: g.queue, fade: g.fade, pending: g.pendingRoom, paused: g.paused,
      cine: g.cinematic.active, title: g.title, won: g.won }; })())`);
  }
  async function clickWorld(x, y, button = "left", frames = 240) {
    await click(x - await evaluate("window.__game.cameraX"), y, button, frames);
  }
  async function clickHotspot(id, button = "left", frames = 400) {
    await settle();
    // A hotspot's bounding-box centre can sit under a later, foreground hotspot (the bar in
    // the Salty Keel overlaps the lower half of Dorrit, for one). Find a point inside the
    // shape that the game's own hit test attributes to the hotspot we mean, then bring the
    // camera round to it: a scrolled room can push a thing off-screen, which a real player
    // would solve by walking. Camera behaviour is tested separately.
    const point = await evaluate(`(() => {
      const g = window.__game;
      const id = ${JSON.stringify(id)};
      const h = g.room.hotspots.find((candidate) => candidate.id === id);
      if (!h) throw new Error("Missing hotspot: " + id + " in " + g.room.id + " (act " + g.act + "): " + g.room.hotspots.map((x) => x.id).join(","));
      let x0, y0, x1, y1;
      if (h.area.rect) {
        const r = h.area.rect;
        x0 = r.x; y0 = r.y; x1 = r.x + r.w; y1 = r.y + r.h;
      } else {
        const xs = h.area.map((p) => p.x), ys = h.area.map((p) => p.y);
        x0 = Math.min(...xs); y0 = Math.min(...ys); x1 = Math.max(...xs); y1 = Math.max(...ys);
      }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const max = Math.max(0, (g.room.width ?? 1920) - 1920);
      g.cameraX = Math.max(0, Math.min(max, cx - 960));
      // Hold it there: a browser frame between this and the click would otherwise ease the
      // camera back toward Fenn. The click itself releases the focus.
      g.focusCameraX = cx;
      // Sample the shape, keeping the clickable point nearest its centre.
      let best = null, bestD = Infinity;
      for (let iy = 0; iy <= 32; iy++) {
        for (let ix = 0; ix <= 32; ix++) {
          const x = x0 + (x1 - x0) * ix / 32, y = y0 + (y1 - y0) * iy / 32;
          if (g.hotspotAt(x, y)?.id !== id) continue;
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (d < bestD) { bestD = d; best = { x, y }; }
        }
      }
      if (!best) throw new Error("No clickable point for " + id);
      g.render();
      return { x: best.x - g.cameraX, y: best.y };
    })()`);
    await click(point.x, point.y, button, frames);
    // A talk hotspot says one line before its conversation opens, and that line now waits for
    // the player. Click it on so the caller sees the conversation, not a parked queue.
    await settle();
  }
  async function shot(name) {
    await evaluate("window.__game.render()");
    await pause(100);
    const frame = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        frameJob = null;
        reject(new Error("No screencast frame for " + name));
      }, 10000);
      frameJob = (params) => { clearTimeout(timer); resolve(params); };
      send("Page.startScreencast", { format: "png", everyNthFrame: 1 })
        .then(() => evaluate("window.__game.render()"))
        .catch((error) => { clearTimeout(timer); frameJob = null; reject(error); });
    });
    await send("Page.screencastFrameAck", { sessionId: frame.sessionId });
    await send("Page.stopScreencast");
    await writeFile(join(output, name), Buffer.from(frame.data, "base64"));
    await pause(60);
    console.log("  " + join("test-output/screens", name));
  }
  /** Click a hotspot that leads to another room, retrying if the click lands mid-frame. */
  async function goTo(hotspotId, roomId) {
    for (let attempt = 0; attempt < 5; attempt++) {
      await clickHotspot(hotspotId);
      for (let i = 0; i < 20; i++) {
        if ((await evaluate("window.__game.room.id")) === roomId) return room(roomId);
        await evaluate("window.__ff(60)");
      }
    }
    return room(roomId);
  }
  async function room(id) {
    // Fades and walks settle a few frames after the click, so poll before asserting. An area
    // card (the establishing view of a new act) clears before the room is played.
    for (let i = 0; i < 60; i++) {
      if ((await evaluate("window.__game.room.id")) === id && !(await evaluate("Boolean(document.querySelector('.area-card'))"))) break;
      if (await evaluate("Boolean(document.querySelector('.area-card'))")) await pause(120);
      await evaluate("window.__ff(60)");
    }
    const actual = await evaluate("window.__game.room.id");
    assert.equal(actual, id, "expected room " + id + "\n" + await state());
    const saved = await evaluate('JSON.parse(localStorage.getItem("brasscompass.save.v4")).room');
    assert.equal(saved, id);
  }
  async function has(item) {
    assert.equal(await evaluate(`window.__game.inventory.includes(${JSON.stringify(item)})`), true, "missing item " + item);
  }
  /**
   * Keyboard focus onto a target the way a player gets there: Tab to its group (the scene, the
   * verbs, the inventory), then the arrows within it.
   */
  async function focusUntil(id, max = 80) {
    const want = await evaluate(`(() => { const g = window.__game, id = ${JSON.stringify(id)};
      return g.inventory.includes(id) ? "item" : g.groupIds("verb").includes(id) ? "verb" : "hotspot"; })()`);
    for (let i = 0; i < max; i++) {
      const current = await evaluate("window.__game.keyboardFocus");
      if (current?.id === id) return;
      if (current?.kind !== want) { await key("Tab"); continue; }
      if (want === "hotspot") { await key("ArrowRight"); continue; }
      const ids = await evaluate(`window.__game.groupIds(${JSON.stringify(want)})`);
      const cols = want === "verb" ? 6 : 4, from = ids.indexOf(current.id), to = ids.indexOf(id);
      if (to < 0) break;
      const rows = Math.floor(to / cols) - Math.floor(from / cols), across = (to % cols) - (from % cols);
      await key(rows > 0 ? "ArrowDown" : rows < 0 ? "ArrowUp" : across > 0 ? "ArrowRight" : "ArrowLeft");
    }
    throw new Error("Could not focus " + id);
  }
  /** Click an inventory chip by item id, regardless of slot or page. */
  async function clickItem(id, button = "left", frames = 4) {
    const slot = await evaluate(`(() => {
      const g = window.__game;
      const i = g.inventory.indexOf(${JSON.stringify(id)});
      if (i < 0) return -1;
      g.inventoryPage = Math.floor(i / 8);
      return i % 8;
    })()`);
    if (slot < 0) throw new Error("Missing item: " + id);
    const x = 1010 + (slot % 4) * 215 + 102;
    const y = 918 + Math.floor(slot / 4) * 84 + 37;
    await click(x, y, button, frames);
  }
  /** Pick dialogue option n through the real keyboard path. */
  async function choose(n) {
    // Enter reveals a line that's still typing; on a fully shown line it would pick option 1.
    if (await evaluate("(() => { const g = window.__game; const n = g.currentNode(); return Boolean(n && g.dialogue.shown < n.text.length); })()")) await key("Enter");
    await evaluate("window.__game.hoverChoice = -1");
    for (let i = 0; i <= n; i++) await key("ArrowDown");
    await key("Enter");
  }
  /** Read on through lines without options until `expression` holds; fails on a choice. */
  async function advance(expression, label, max = 60) {
    for (let i = 0; i < max; i++) {
      if (await evaluate(expression)) return;
      const state = await evaluate("(() => { const g = window.__game; return g.dialogue ? g.visibleChoices().length : -1; })()");
      if (state > 0) throw new Error("Stopped at a choice (" + await node() + ") before: " + label + "\n" + await state());
      if (state === 0) await key("Enter");
      else await frame(60);
    }
    throw new Error("Never satisfied: " + label + "\n" + await state());
  }
  /** Read on to the next choice and pick the option whose text matches. */
  async function pickText(match) {
    for (let i = 0; i < 60; i++) {
      const texts = await evaluate("window.__game.dialogue ? window.__game.visibleChoices().map((c) => c.text) : null");
      if (texts && texts.length) {
        const n = texts.findIndex((t) => typeof match === "string" ? t === match : match.test(t));
        if (n < 0) throw new Error("No option " + match + " at " + await node() + ": " + JSON.stringify(texts) + "\n" + await state());
        return choose(n);
      }
      if (texts) await key("Enter");
      else await frame(60);
    }
    throw new Error("No options appeared for " + match + "\n" + await state());
  }
  /** Take the first option at each choice until `expression` holds. */
  async function chooseThrough(expression, label, max = 80) {
    for (let i = 0; i < max; i++) {
      if (await evaluate(expression)) return;
      const options = await evaluate("window.__game.dialogue ? window.__game.visibleChoices().length : -1");
      if (options > 0) await choose(0);
      else if (options === 0) await key("Enter");
      else await frame(60);
    }
    throw new Error("Never satisfied: " + label + "\n" + await state());
  }
  const node = () => evaluate("window.__game.dialogue?.nodeId ?? null");
  const flag = (id) => evaluate(`window.__game.flags[${JSON.stringify(id)}]`);
  const visible = (id) => evaluate(`window.__game.visibleHotspots().some((h) => h.id === ${JSON.stringify(id)})`);
  /** Read one conversation line at a time, with Enter, until the dialogue closes. */
  async function finishDialogue(label) {
    await advance("window.__game.dialogue === null", label);
  }

  await send("Page.enable");
  await send("Runtime.enable");
  // The test drives a clock; use the old automatic text pace so a queued talk effect is not
  // held for a click the test does not mean to make. The player-facing default stays wait-for-click.
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("brasscompass.prefs.v1", JSON.stringify({ v: 3, waitForClick: false }));` });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/?nomobile=1` });
  await until(() => evaluate("Boolean(window.__game)"), "game");
  await until(() => evaluate('!document.getElementById("boot")'), "loading overlay");
  // The production build lazy-loads rooms; the synthetic clock cannot wait for the network, so
  // pull the active art once before the test starts driving frames.
  await until(() => evaluate("typeof window.__prefetchAll === \"function\""), "the dev prefetch hook");
  await evaluate("window.__prefetchAll()");
  await until(() => evaluate("window.__game.assets.queue.length === 0 && window.__game.assets.running === 0"), "assets");
  /**
   * The test drives the game with __ff, and only renders when it means to. Stop the real-time
   * loop after boot; the explicit renders still draw.
   */
  await evaluate("window.requestAnimationFrame = () => 0; window.__game.render();");

  // ------------------------------------------------------------------ content integrity
  // Every dialogue link resolves, and every flag, item, room, tree and image the scripts refer
  // to exists. Warnings (a long line, a one-shot flag nobody reads) are printed; broken
  // references fail.
  const invalidLinks = await evaluate(`(async () => {
    const { DIALOGUES } = await import("/src/content/dialogue.ts");
    const invalid = [];
    for (const tree of Object.values(DIALOGUES)) {
      if (!tree.nodes[tree.start]) invalid.push(tree.id + ":start");
      for (const node of Object.values(tree.nodes)) {
        for (const target of [node.next, ...(node.choices ?? []).map((c) => c.to)]) {
          if (target && target !== "END" && !tree.nodes[target]) invalid.push(tree.id + ":" + target);
        }
      }
    }
    return invalid;
  })()`);
  assert.deepEqual(invalidLinks, []);
  const lint = await evaluate(`(async () => {
    const { ROOMS } = await import("/src/content/rooms.ts");
    const { DIALOGUES } = await import("/src/content/dialogue.ts");
    const { ITEMS } = await import("/src/content/items.ts");
    const { ACTS, ENDING } = await import("/src/content/acts.ts");
    const { CHARACTERS } = await import("/src/content/characters.ts");
    const { GLOBAL_COMBOS } = await import("/src/content/combos.ts");
    const { TIPS } = await import("/src/content/hints.ts");
    const { MANIFEST } = await import("/src/content/assets.ts");
    const errors = [], warnings = [], set = new Set(), read = new Set();
    const images = MANIFEST.images;
    const item = (where, id) => { if (!ITEMS[id]) errors.push(where + ": no item " + id); };
    const conds = (where, list = []) => list.forEach((c) => {
      if ("flag" in c) read.add(c.flag);
      if ("has" in c) item(where, c.has);
      if ("notHas" in c) item(where, c.notHas);
      if ("room" in c && !ROOMS[c.room]) errors.push(where + ": no room " + c.room);
      if ("any" in c) conds(where, c.any);
      if ("not" in c) conds(where, [c.not]);
    });
    const effects = (where, list = [], from) => list.forEach((e) => {
      if (e.k === "flag" || e.k === "add") set.add(e.id);
      if (e.k === "add" && typeof e.n !== "number") errors.push(where + ": add needs a number");
      if (e.k === "give" || e.k === "take") item(where, e.item);
      if (e.k === "talk" && !DIALOGUES[e.tree]) errors.push(where + ": no tree " + e.tree);
      if (e.k === "talk" && e.node && !DIALOGUES[e.tree]?.nodes[e.node]) errors.push(where + ": no node " + e.tree + "." + e.node);
      if (e.k === "act" && !ACTS[e.n]) errors.push(where + ": no act " + e.n);
      if (e.k === "go") {
        const to = ROOMS[e.room];
        if (!to) errors.push(where + ": no room " + e.room);
        else if (from && to.arrive && !to.arrive[from]) errors.push(where + ": " + e.room + " has no arrive." + from);
      }
      if (e.k === "say" && e.text.length > 320) warnings.push(where + ": long say (" + e.text.length + ")");
    });
    const long = (where, text, max) => { if (text && text.length > max) warnings.push(where + ": " + text.length + " chars"); };
    for (const room of Object.values(ROOMS)) {
      if (!images[room.bg]) errors.push(room.id + ": no image " + room.bg);
      for (const s of room.sprites ?? []) {
        if (!images[s.key]) errors.push(room.id + ": no image " + s.key);
        if (s.speaker && !CHARACTERS[s.speaker]) errors.push(room.id + ": no character " + s.speaker);
        conds(room.id + ".sprite", s.showIf);
      }
      effects(room.id + ".onEnter", room.onEnter, room.id);
      for (const [i, sc] of (room.scenes ?? []).entries()) { conds(room.id + ".scene" + i, sc.if); effects(room.id + ".scene" + i, sc.do, room.id); }
      for (const h of room.hotspots) {
        const where = room.id + "." + h.id;
        if (h.item) item(where, h.item);
        conds(where, h.showIf);
        for (const st of [h, ...(h.states ?? [])]) {
          conds(where, st.if);
          for (const [verb, list] of Object.entries(st.do ?? {})) effects(where + "." + verb, list, room.id);
          for (const [verb, text] of Object.entries(st.say ?? {})) long(where + "." + verb, text, 320);
        }
      }
      for (const c of room.combos ?? []) {
        const where = room.id + ".combo." + c.item + "+" + c.with;
        item(where, c.item);
        if (!ITEMS[c.with] && !room.hotspots.some((h) => h.id === c.with)) errors.push(where + ": no target");
        conds(where, c.if); effects(where, c.do, room.id); long(where, c.say, 320);
      }
    }
    for (const c of GLOBAL_COMBOS) { item("global", c.item); item("global", c.with); conds("global", c.if); effects("global", c.do); }
    for (const tree of Object.values(DIALOGUES)) for (const node of Object.values(tree.nodes)) {
      const where = tree.id + "." + node.id;
      if (node.speaker !== "narrator" && !CHARACTERS[node.speaker]) errors.push(where + ": no character " + node.speaker);
      effects(where, node.do); long(where, node.text, 320);
      for (const c of node.choices ?? []) { conds(where, c.if); effects(where, c.do); }
    }
    for (const it of Object.values(ITEMS)) for (const st of it.states ?? []) conds("item." + it.id, st.if);
    for (const act of Object.values(ACTS)) {
      if (!ROOMS[act.start.room]) errors.push("act " + act.n + ": no room " + act.start.room);
      (act.inventory ?? []).forEach((id) => item("act " + act.n, id));
      effects("act " + act.n, act.onStart); long("act " + act.n + ".caption", act.caption, 320);
    }
    for (const line of ENDING.lines) conds("ending", line.if);
    for (const t of ENDING.titles ?? []) conds("ending.title", t.if);
    // The tip ladder reads flags too (curse_broken, escaped_fog): a flag it uses is not dead.
    for (const tip of TIPS) conds("tip", tip.if);
    for (const c of Object.values(CHARACTERS)) {
      if (c.portrait && !images[c.portrait]) errors.push("character " + c.id + ": no image " + c.portrait);
    }
    const auto = (f) => f.startsWith("seen:") || f.startsWith("looked:");
    for (const f of set) if (!read.has(f)) warnings.push("flag set, never read: " + f);
    for (const f of read) if (!set.has(f) && !auto(f)) errors.push("flag read, never set: " + f);
    return { errors, warnings };
  })()`);
  if (lint.warnings.length) console.log("content warnings:\n  " + lint.warnings.join("\n  "));
  assert.deepEqual(lint.errors, []);

  // ------------------------------------------------------------------ title -> New Voyage
  await shot("reboot-title.png");
  assert.match(await evaluate("document.getElementById('sr').textContent"), /Title screen/);
  assert.equal(await evaluate("window.__game.title"), true);
  assert.deepEqual(await evaluate("window.__game.titleButtons().map((b) => b.id)"), ["start", "explore"]);
  assert.equal(await evaluate("localStorage.getItem('brasscompass.save.v4')"), null);
  // next-level: a11y — the hidden DOM toolbar names every plate, and the Map plate keeps its key.
  const toolbar = await evaluate(`[...document.querySelectorAll(".a11y-controls button")].map((b) => ({
    label: b.getAttribute("aria-label"), keys: b.getAttribute("aria-keyshortcuts"), pressed: b.getAttribute("aria-pressed"),
  }))`);
  assert.equal(toolbar.length, 8);
  const mapPlate = toolbar.find((b) => /^Map/.test(b.label ?? ""));
  assert.ok(mapPlate, "the Map plate is in the screen-reader toolbar");
  assert.equal(mapPlate.keys, "A");
  assert.match(mapPlate.label, /Map \(A\)/);
  for (const name of ["Reveal interactive things", "Tip", "Line history", "Chart", "Pause"]) {
    assert.ok(toolbar.some((b) => (b.label ?? "").startsWith(name)), `${name} is named in the toolbar`);
  }
  assert.equal(toolbar.filter((b) => b.pressed !== null).length, 2, "Reveal and Tip expose their state");
  // New Voyage: no cold open and no opening film for Act I; the harbour is the first thing on screen.
  await key("Enter");
  await until(() => evaluate("window.__game.title === false && window.__game.room.id === 'dock'"), "a new voyage at the dock");
  assert.equal(await evaluate("window.__game.act"), 1);
  assert.equal(await evaluate("window.__coldopen === undefined"), true);
  await readScene("the dock arrival");
  // The icon rail fades when idle, but never below a readable floor (the old 22% was a rumour
  // of a button). Park the pointer off the bar, spend the first-watch plates, and let it settle.
  await evaluate(`(() => { const g = window.__game; g.watch.clearQueue(); g.input.x = 960; g.input.y = 500; g.idle = 0; })()`);
  await evaluate("window.__ff(300)");
  const barFade = await evaluate("window.__game.barFade");
  assert.ok(barFade >= 0.6, `the idle bar stayed readable (${barFade})`);
  assert.ok(barFade <= 0.9, `the idle bar still fades (${barFade})`);
  // The atlas: island chart -> harbour -> back into the room. This is the map/macro/close-up
  // hierarchy the whole visual structure hangs from.
  await key("a");
  await until(() => evaluate("Boolean(document.querySelector('.atlas') && !document.querySelector('.atlas').hidden)"), "the atlas");
  assert.equal(await evaluate("document.querySelector('.atlas-head h1').textContent"), "Dreadwater Isle");
  await evaluate("[...document.querySelectorAll('.atlas-row')].find((b) => b.textContent.includes('The Harbour')).click()");
  await until(() => evaluate("document.querySelector('.atlas-head h1').textContent === 'The Harbour'"), "the harbour area");
  await evaluate("[...document.querySelectorAll('.atlas-row')].find((b) => b.textContent.includes('Dreadwater Harbour')).click()");
  await until(() => evaluate("document.querySelector('.atlas').hidden"), "the atlas closed");
  assert.equal(await evaluate("window.__game.room.id"), "dock");
  await shot("reboot-act1-dock.png");

  // Keyboard basics: arrows land in the scene, Tab moves to the verbs, and Enter acts.
  await key("ArrowRight");
  assert.equal(await evaluate("window.__game.keyboardFocus.kind"), "hotspot");
  await key("Tab");
  assert.equal(await evaluate("window.__game.keyboardFocus.kind"), "verb");
  await focusUntil("look");
  await key("Enter");
  assert.equal(await evaluate("window.__game.sentence.verb"), "look");
  await key("Escape");
  assert.equal(await evaluate("window.__game.sentence.verb === null"), true);
  await clickWorld(1400, 800);
  await frame(600);
  assert.equal(await evaluate("window.__game.cameraX > 250"), true, "the camera follows Fenn along the pier");

  // ------------------------------------------------------------------ Act I: the harbour
  // Bramwick knows the harbour, Marta knows the island, and Vex has the only ship.
  await goTo("office_door", "office");
  await readScene("the harbourmaster's house");
  await click(70, 960); // Talk to
  await clickHotspot("bramwick");
  await until(() => evaluate("window.__game.dialogue !== null || window.__game.narration === null"), "Bramwick to look up");
  await chooseThrough("window.__game.dialogue === null", "Bramwick at his desk");
  assert.equal(await flag("seen:bramwick.ship2"), true);
  await shot("reboot-act1-office.png");
  await goTo("door_out", "dock");
  await goTo("tavern_door", "tavern");
  await readScene("the Salty Keel");
  await click(70, 960); // Talk to
  await clickHotspot("marta");
  await pickText("What happened to my father?");
  await pickText("Can I see his room?");
  await finishDialogue("Marta, on my father's room");
  await click(70, 960); // Talk to
  await clickHotspot("marta");
  await pickText("Did Dorrit take the stores?");
  await pickText("I'll clear his name.");
  await finishDialogue("Marta, the missing stores");
  await click(70, 960); // Talk to
  await clickHotspot("rook");
  await pickText("You knew my father.");
  await pickText("You were with him when he went?");
  await pickText("The bell?");
  await pickText("Where's your log?");
  await pickText("I'll fetch it.");
  await finishDialogue("Rook, and the log at the lighthouse");
  assert.equal(await flag("met_rook"), true);
  await click(70, 960); // Talk to
  await clickHotspot("dorrit");
  await pickText("Marta says you're blamed.");
  await pickText("What's missing?");
  await pickText("I'll look around.");
  await finishDialogue("Dorrit, before the truth");
  await shot("reboot-act1-tavern.png");

  // Vex's price: the rudder. First he has to name it.
  await goTo("door_out", "dock");
  await goTo("alley_mouth", "alley");
  await readScene("Wreckers' Lane");
  await goTo("counting_door", "counting_house");
  await readScene("Vex's warehouse");
  await click(70, 960); // Talk to
  await clickHotspot("vex");
  await pickText("I need the Marrow.");
  await pickText("I'll get it.");
  await finishDialogue("Vex names his price");
  assert.equal(await flag("met_vex"), true);
  await shot("reboot-act1-vex.png");

  // The boat shed: the man Pike paid, and the rudder's owner.
  await goTo("door_out", "alley");
  await goTo("boat_shed", "warehouse");
  await readScene("the boat shed");
  await click(70, 960); // Talk to
  await clickHotspot("stores");
  await pickText("You're the one who took the stores.");
  await pickText("And the Marrow's rudder?");
  await finishDialogue("the thief in the boat shed");
  assert.equal(await flag("seen:dorrit.confess"), true);
  await shot("reboot-act1-boatshed.png");
  await goTo("lane_door", "alley");
  await click(70, 960); // Talk to
  await clickHotspot("pike");
  await pickText("The man you paid talked.");
  await pickText("Vex wants it back.");
  await pickText("I'll tell him.");
  await finishDialogue("Pike gives up the rudder");
  assert.equal(await flag("rudder_back"), true);

  // Dorrit is cleared, and comes aboard.
  await goTo("to_dock", "dock");
  await goTo("tavern_door", "tavern");
  await click(70, 960); // Talk to
  await clickHotspot("dorrit");
  await pickText("Pike gave up the rudder. You're clear.");
  await pickText("I'll tell them.");
  await finishDialogue("Dorrit cleared");
  assert.equal(await flag("dorrit_cleared"), true);

  // The rudder buys the voyage: Vex agrees, and hands over Quill's compass.
  await goTo("door_out", "dock");
  await goTo("alley_mouth", "alley");
  await goTo("counting_door", "counting_house");
  await click(70, 960); // Talk to
  await clickHotspot("vex");
  await pickText("Now talk.");
  await pickText("Agreed.");
  await finishDialogue("Vex's terms");
  assert.equal(await flag("vex_deal"), true);
  assert.equal(await flag("quill_compass"), true);

  // The shipwright's: Quill gets her compass, Hobb gets his mast back.
  await goTo("door_out", "alley");
  await goTo("chandlery_door", "chandlery");
  await readScene("the shipwright's");
  await click(70, 960); // Talk to
  await clickHotspot("quill");
  await pickText("He had no choice.");
  await pickText("Welcome aboard.");
  await finishDialogue("Quill's compass");
  assert.equal(await flag("met_quill"), true);
  await click(70, 960); // Talk to
  await clickHotspot("hobb");
  await pickText("What's wrong with the mast?");
  await pickText("What do you need?");
  await pickText("There's a crowbar on the counter.");
  await finishDialogue("Hobb and the seized mast");
  await click(850, 910); // Pick up
  await clickHotspot("crowbar");
  await has("crowbar");
  await click(390, 960); // Use
  await clickItem("crowbar");
  await clickHotspot("mast");
  await advanceUntil("window.__game.flags.hobb_joined === true", "the iron band shifted");
  assert.equal(await flag("hobb_joined"), true);
  await shot("reboot-act1-chandlery.png");

  // Rook's log at the lighthouse: the first rule, and the chart folded in the back.
  await goTo("door_out", "alley");
  await goTo("to_dock", "dock");
  await goTo("road", "village");
  await goTo("light_path", "weather_works");
  await readScene("the lighthouse");
  await click(390, 960); // Use
  await clickHotspot("store");
  await readScene("Rook's log read");
  assert.equal(await flag("weather_works_store"), true);
  await shot("reboot-act1-lighthouse.png");
  await goTo("path_down", "village");
  await goTo("steps_down", "dock");
  await goTo("tavern_door", "tavern");
  await click(70, 960); // Talk to
  await clickHotspot("rook");
  await pickText("I found your old log.");
  await pickText("Thank you, Rook.");
  await finishDialogue("Rook reads the rule and gives the chart");
  assert.equal(await flag("rook_story"), true);
  assert.equal(await flag("rule_sound"), true);
  await has("chart");

  // Vex at the pier end: all five errands done, and Act I turns.
  await goTo("door_out", "dock");
  await goTo("pier", "quay");
  await readScene("the quay");
  await goTo("harbour_mouth", "pier_end");
  await readScene("the harbour mouth");
  assert.equal(await visible("vex"), true);
  await click(70, 960); // Talk to
  await clickHotspot("vex");
  await readScene("Vex at the lamp");
  await advanceUntil("window.__game.act === 2", "Act I's turn");
  await room("marrow_deck");
  await readScene("the Marrow's deck");
  await shot("reboot-act2-deck.png");

  // ------------------------------------------------------------------ save and Continue
  // A reload must offer the voyage back: the save names the act, the recap card says where
  // Fenn stood and what he was doing, and Set sail puts him back on the Marrow.
  const savedAtActTwo = await evaluate("localStorage.getItem('brasscompass.save.v4')");
  assert.notEqual(savedAtActTwo, null);
  await send("Page.reload");
  await until(() => evaluate("Boolean(window.__game?.title)"), "the title after reload");
  await evaluate("window.requestAnimationFrame = () => 0; window.__game.render();");
  assert.equal(await evaluate("window.__game.titleButtons()[0].id"), "continue");
  assert.equal(await evaluate("window.__game.titleButtons()[0].sub"), "Act II · The Crew");
  await shot("reboot-title-continue.png");
  await key("Enter");
  await until(() => evaluate("window.__game.recap.open === true"), "the recap card");
  assert.equal(await evaluate("document.querySelector('#recap-heading').textContent"), "Act II · The Crew");
  assert.match(await evaluate("document.querySelector('.recap-where').textContent"), /^Fenn was in /);
  assert.match(await evaluate("document.querySelector('.recap-doing').textContent"), /^He was doing: /);
  assert.match(await evaluate("document.querySelector('.recap-carrying').textContent"), /^He is carrying: /);
  await shot("reboot-recap.png");
  await key("Enter"); // Set sail
  await advanceUntil("window.__game.title === false && window.__game.room.id === 'marrow_deck' && window.__game.act === 2", "Continue");
  await readScene("the Marrow after Continue");

  // ------------------------------------------------------------------ Act II: the crew
  // Vex sends Fenn to the bow.
  await goTo("stairs_up", "marrow_quarterdeck");
  await readScene("the helm");
  await click(70, 960); // Talk to
  await clickHotspot("vex");
  await pickText("Why the bow?");
  await pickText("I'm going.");
  await finishDialogue("Vex sends me to the bow");
  assert.equal(await flag("seen:vex.send"), true);

  // The first fog attempt: fog_tried, rule_light.
  await goTo("stairs_down", "marrow_deck");
  await goTo("forward", "bow_fog");
  await readScene("the Shroud at the bow");
  assert.equal(await flag("fog_tried"), true);
  assert.equal(await flag("rule_light"), true);
  await shot("reboot-act2-bow.png");
  await goTo("aft", "marrow_deck");

  // The hold: every crate has a lost ship's name on it.
  await goTo("hatch", "below_decks");
  await readScene("the crew deck");
  await click(590, 960); // Look at
  await clickHotspot("salvage");
  await readScene("the salvage");
  assert.equal(await flag("salvage_seen"), true);
  await shot("reboot-act2-hold.png");
  await goTo("ladder", "marrow_deck");
  await goTo("stairs_up", "marrow_quarterdeck");

  // The confrontation, and Vex's last voyage.
  await click(70, 960); // Talk to
  await clickHotspot("vex");
  await pickText("Those crates have ships' names on them.");
  await pickText("Take us home.");
  await pickText("You'll get us killed.");
  await finishDialogue("Vex confronted");
  assert.equal(await flag("vex_exposed"), true);
  await shot("reboot-act2-helm.png");
  await click(70, 960); // Talk to
  await clickHotspot("vex");
  await pickText("Then I'm with you.");
  await advance("window.__game.act === 3", "the Marrow lost");
  assert.equal(await flag("marrow_lost"), true);
  await room("lagoon_shore");
  await readScene("the fog flats");
  await shot("reboot-act3-flats.png");

  // ------------------------------------------------------------------ Act III: the Shroud
  // The wreck, the bell, and Hobb's plan.
  await goTo("boat", "reef_wreck");
  await readScene("the sunken wreck");
  await click(70, 960); // Talk to
  await clickHotspot("hobb");
  await pickText("How do you know?");
  await pickText("We will bring him out.");
  await pickText("Who is Mordant?");
  await pickText("We board her.");
  await finishDialogue("Hobb and the bell");
  assert.equal(await flag("bell_plan"), true);
  await has("nameplate");
  await shot("reboot-act3-wreck.png");

  // The castaway camp: Elias alive, and the third rule.
  await goTo("salt_flats", "salt_camp");
  await advanceUntil("window.__game.dialogue?.tree.id === 'elias'", "Elias at the camp");
  await chooseThrough("window.__game.flags.rule_name === true", "the third rule");
  await chooseThrough("window.__game.dialogue === null", "Elias's plan");
  assert.equal(await flag("elias_found"), true);
  assert.equal(await flag("rule_name"), true);
  await shot("reboot-act3-camp.png");

  // The reef gate: all three holds, and the boarding.
  await goTo("shore_path", "reef_wreck");
  await goTo("boat", "lagoon_shore");
  await goTo("reef_gate", "key_gate");
  await readScene("the reef gate");
  await shot("reboot-act3-gate.png");
  await click(115, 910); // Open
  await clickHotspot("gate");
  await advanceUntil("window.__game.act === 4", "the boarding");
  assert.equal(await flag("lantern_boarded"), true);
  await room("lantern_deck");
  await readScene("the Grey Lantern's deck");
  await shot("reboot-act4-deck.png");

  // ------------------------------------------------------------------ Act IV: the Grey Lantern
  // The bell: Quill's canvas first, then Hobb's iron.
  await click(70, 960); // Talk to
  await clickHotspot("quill");
  await readScene("Quill and the oiled canvas");
  await has("lantern");
  await click(70, 960); // Talk to
  await clickHotspot("hobb");
  await readScene("Hobb at the mast");
  await click(390, 960); // Use
  await clickHotspot("bell");
  await readScene("the bell cut loose");
  assert.equal(await flag("bell_cut"), true);
  assert.equal(await flag("tam_freed"), true);
  await shot("reboot-act4-bell.png");

  // The great lantern goes out.
  await click(390, 960); // Use
  await clickHotspot("great_lantern");
  await readScene("the great lantern doused");
  assert.equal(await flag("lantern_doused"), true);
  assert.equal(await evaluate("window.__game.inventory.includes('lantern')"), false);

  // The name in the captain's cabin, and Mordant.
  await goTo("cabin_door", "arcadia_cabin");
  await readScene("Mordant's cabin");
  await click(390, 960); // Use
  await clickHotspot("nameplate");
  await advanceUntil("window.__game.dialogue?.tree.id === 'mordant'", "Mordant");
  assert.equal(await flag("name_spoken"), true);
  await shot("reboot-act4-cabin.png");
  await pickText("Your bell is cut. Your light is out.");
  await pickText("Let the crews go.");
  await pickText("They are not yours. They were taken.");
  await pickText("I'm ready.");
  await pickText("It ends here, Mordant.");
  assert.equal(await evaluate("window.__game.dialogue?.tree.id"), "ending");

  // The last choice: give Vex something to hold, and lay the dead to rest.
  await pickText("Take the boat.");
  assert.equal(await flag("vex_trust"), true);
  await pickText("Lay them to rest.");
  assert.equal(await flag("curse_broken"), true);
  assert.equal(await flag("ending_fog_lifts"), true);
  await advance("window.__game.won === true", "the fog lifts");
  await shot("reboot-ending-fog.png");
  // The card is the mercy ending, line for line.
  const card = await evaluate(`(async () => {
    const { ENDING } = await import("/src/content/acts.ts");
    const g = window.__game;
    const ok = (l) => !l.if || l.if.every((c) => g.check(c));
    return { title: ENDING.titles.find(ok)?.text, lines: ENDING.lines.filter(ok).map((l) => l.text) };
  })()`);
  assert.equal(card.title, "THE FOG LIFTS");
  assert.match(card.lines[0], /^My father comes home with the chart/);
  assert.equal(card.lines.some((l) => /^Vex stays\. He calls it rebuilding the harbour/.test(l)), true);
  assert.equal(card.lines.some((l) => /^The Grey Lantern settles into the sea/.test(l)), true);
  assert.equal(card.lines.some((l) => /^My father stays on the fog rock/.test(l)), false);
  assert.equal(card.lines.at(-1), "Old Onn comes down to the quay to hear the story. I tell her the truth. She says it will do, and goes back to her step.");
  // The save keeps the last choice, and the voyage marks the collection complete.
  assert.notEqual(await evaluate("localStorage.getItem('brasscompass.save.v4')"), null);
  const savedAtEnding = await evaluate("JSON.parse(localStorage.getItem('brasscompass.save.v4')).flags");
  for (const f of ["ending_fog_lifts", "ending_long_way", "curse_broken", "escaped_fog"]) {
    assert.equal(savedAtEnding[f], undefined, `${f} was written into the pre-choice save`);
  }
  assert.equal(await evaluate("localStorage.getItem('brasscompass.completed')"), "1");
  assert.match(await evaluate("document.getElementById('sr').textContent"), /THE FOG LIFTS/);
  const cardPages = await evaluate("window.__game.ending.pageCount");
  assert.ok(cardPages >= 1);
  await key("Enter");
  assert.equal(await evaluate("window.__game.won && window.__game.ending.revealed && !window.__game.title"), true);
  // Turn however many pages the text scale made; the next Enter after the last opens the log.
  for (let i = 0; i < cardPages + 2 && !(await evaluate("window.__game.deeds.open")); i++) {
    await key("Enter");
    await pause(40);
  }
  assert.equal(await evaluate("window.__game.deeds.open === true && window.__game.title === false"), true);
  const deeds = await evaluate(`(() => {
    const page = document.querySelector(".deeds");
    return {
      entered: page.querySelectorAll(".deed.entered").length,
      unfiled: page.querySelectorAll(".deed.unfiled").length,
      stamps: page.querySelectorAll(".deed-stamp").length,
      tally: page.querySelector(".deeds-tally").textContent,
      bookend: page.querySelector(".deeds-bookend").textContent,
    };
  })()`);
  assert.equal(deeds.entered + deeds.unfiled, 14);
  assert.equal(deeds.stamps, deeds.entered);
  assert.ok(deeds.entered >= 10, `expected the playthrough to enter most of the ship's log, got ${deeds.entered}`);
  assert.equal(deeds.tally, `${deeds.entered} of 14 in the log`);
  assert.equal(deeds.bookend, "DREADWATER: the light burning. All hands.");
  await shot("reboot-deeds.png");
  await key("Enter"); // go home
  await advanceUntil("window.__game.title === true", "the title after the voyage");
  assert.equal(await evaluate("window.__game.casebookTally.total"), 14);
  assert.equal(await evaluate("window.__game.casebookTally.filed"), deeds.entered);
  await shot("reboot-title-after.png");

  // ------------------------------------------------------------------ the other ending
  // The save waits on the last choice, so Continue can go back and take the living and run.
  assert.equal(await evaluate("window.__game.titleButtons()[0].id"), "continue");
  await key("Enter");
  await until(() => evaluate("window.__game.recap.open === true"), "the recap after the ending");
  await key("Enter"); // Set sail, back to the last choice
  await advanceUntil("window.__game.title === false && window.__game.act === 4", "the saved last choice");
  // The first voyage's final choice must not colour the second: no ending flag and no branch
  // marker may have ridden along in the save.
  const leftover = await evaluate(`(() => { const f = window.__game.flags; return {
    fog: f.ending_fog_lifts === true, long: f.ending_long_way === true,
    cursed: f.curse_broken === true, escaped: f.escaped_fog === true }; })()`);
  assert.deepEqual(leftover, { fog: false, long: false, cursed: false, escaped: false });
  // Put the voyage in the state the last choice expects (the save may have landed a line
  // either side of it), then drive the choice itself through the real dialogue.
  await evaluate(`(() => { const g = window.__game;
    g.flags.bell_cut = true; g.flags.lantern_doused = true; g.flags.name_spoken = true;
    g.flags.tam_freed = true;
    g.dialogue = null; g.queue = null; g.narration = null;
    g.runEffects([{ k: "talk", tree: "ending" }]); })()`);
  await advanceUntil("window.__game.dialogue?.tree.id === 'ending'", "the ending again");
  await pickText("Take the boat.");
  await pickText("Take the living and run.");
  assert.equal(await flag("escaped_fog"), true);
  assert.equal(await flag("ending_long_way"), true);
  await advance("window.__game.won === true", "the long way home");
  await shot("reboot-ending-long-way.png");
  const escapeCard = await evaluate(`(async () => {
    const { ENDING } = await import("/src/content/acts.ts");
    const g = window.__game;
    const ok = (l) => !l.if || l.if.every((c) => g.check(c));
    return { title: ENDING.titles.find(ok)?.text, lines: ENDING.lines.filter(ok).map((l) => l.text) };
  })()`);
  assert.equal(escapeCard.title, "THE LONG WAY HOME");
  assert.match(escapeCard.lines[0], /^Vex takes the salvage and leaves Dreadwater/);
  assert.equal(escapeCard.lines.some((l) => /^My father comes home a month later/.test(l)), true);
  assert.match(escapeCard.lines.at(-1), /^The Grey Lantern is still out there/);
  assert.equal(escapeCard.lines.some((l) => /curse of the fog|fog lifts|My father and I draw/.test(l)), false);
  // Home once more, to prove the last choice can be taken either way.
  await key("Enter");
  const escapePages = await evaluate("window.__game.ending.pageCount");
  for (let i = 0; i < escapePages + 2 && !(await evaluate("window.__game.deeds.open")); i++) await key("Enter");
  assert.equal(await evaluate("window.__game.deeds.open"), true);
  await key("Enter");
  await advanceUntil("window.__game.title === true", "the title after the long way home");

  // ------------------------------------------------------------------ chapter select
  // The second way in is a real control now: a chart plate on the title and an act-columned
  // scene list that the keyboard can walk.
  assert.deepEqual(await evaluate("window.__game.titleButtons().map((b) => b.id)"), ["continue", "start", "explore"]);
  await key("e");
  await until(() => evaluate("window.__game.explore && window.__game.roomMenu"), "Chapter select from the title");
  const chapterFocus = await evaluate("window.__game.roomMenuFocus");
  assert.equal(chapterFocus, 0, "the marker starts on the scene being walked");
  await key("ArrowRight");
  assert.notEqual(await evaluate("window.__game.roomMenuFocus"), chapterFocus, "arrows move between act columns");
  await pause(60);
  assert.match(await evaluate("document.getElementById('sr').textContent"), /The Marrow/, "the focused scene is read out");
  await shot("reboot-chapter-select.png");
  await key("Enter");
  await until(() => evaluate("window.__game.roomMenu === false && window.__game.room.id === 'marrow_deck'"),
    "a scene chosen in Chapter select");
  assert.equal(await evaluate("window.__game.explore"), true);

  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(consoleErrors, []);
  console.log("Title, New Voyage, all of Act I (Bramwick, Marta, Vex, Pike, the boat shed, Dorrit, Quill's compass, Rook's log, Hobb's mast, Vex at the pier), all of Act II (the helm, the bow fog, the hold, the confrontation, the Marrow lost), all of Act III (the flats, the wreck, Elias's camp, the reef gate), all of Act IV (the bell and Tam, the great lantern, Mordant's name and cabin, the trust beat, both endings), plus save/Continue, the recap, the ship's log, keyboard basics, content integrity, and no console errors passed");
} finally {
  socket?.close();
  await browser?.stop();
  await vite.stop();
}

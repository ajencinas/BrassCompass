import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch {}
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

// Test screenshots go to an ignored folder; reference/screens holds the curated, tracked shots.
const output = resolve("test-output/screens");
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "brass-compass-test-"));
// Picking a fixed port makes back-to-back runs collide when a previous server lingers.
let port = 0;
let server;
for (let candidate = 5179; candidate < 5200 && !port; candidate++) {
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(candidate), "--strictPort"], {
    stdio: "ignore",
  });
  try {
    await until(async () => (await fetch(`http://127.0.0.1:${candidate}/`)).ok, "Vite", 20000);
    port = candidate;
    server = child;
  } catch {
    child.kill();
  }
}
if (!port) throw new Error("Could not start Vite on any port 5179-5199");
let browser;
let socket;
try {
  browser = spawn(process.env.CHROME_BIN || "google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  const debugPort = await until(async () => {
    const raw = await readFile(join(profile, "DevToolsActivePort"), "utf8");
    return Number(raw.split("\n")[0]);
  }, "Chromium");
  const targets = await until(async () => {
    const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return list.find((target) => target.type === "page");
  }, "browser page");
  socket = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });

  const runtimeErrors = [];
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
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
  async function key(key) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key });
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
   * Runs before any camera placement, since game frames move the camera.
   */
  async function settle() {
    await evaluate(`(() => { const g = window.__game;
      for (let i = 0; i < 400 && ((g.narration && g.narration.shown < g.narration.text.length) || g.queue); i++) window.__ff(1);
    })()`);
  }
  /** A real double-click: two presses, the second with clickCount 2 (event.detail === 2). */
  async function doubleClick(x, y, frames = 0) {
    await settle();
    const p = await evaluate(`(() => {
      const r = document.querySelector("canvas").getBoundingClientRect();
      return { x: r.left + ${x} * r.width / 1920, y: r.top + ${y} * r.height / 1080 };
    })()`);
    for (const clickCount of [1, 2]) {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount });
    }
    await frame(frames);
  }
  /** Where a hotspot is on screen, with the camera brought round to it first. */
  async function hotspotPoint(id) {
    await settle();
    return evaluate(`(() => {
      const g = window.__game;
      const h = g.room.hotspots.find((c) => c.id === "${id}");
      if (!h) throw new Error("Missing hotspot: ${id}");
      const c = h.area.rect ? { x: h.area.rect.x + h.area.rect.w / 2, y: h.area.rect.y + h.area.rect.h / 2 }
        : { x: h.area.reduce((s, p) => s + p.x, 0) / h.area.length, y: h.area.reduce((s, p) => s + p.y, 0) / h.area.length };
      const max = Math.max(0, (g.room.width ?? 1920) - 1920);
      g.cameraX = Math.max(0, Math.min(max, c.x - 960));
      g.focusCameraX = c.x;
      return { x: c.x - g.cameraX, y: c.y };
    })()`);
  }
  async function clickWorld(x, y, button = "left", frames = 240) {
    await click(x - await evaluate("window.__game.cameraX"), y, button, frames);
  }
  async function clickHotspot(id, button = "left", frames = 400) {
    await settle();
    // Centre the camera on the hotspot first: a scrolled room can push it off-screen,
    // which a real player would solve by walking. Camera behaviour is tested separately.
    await evaluate(`(() => {
      const g = window.__game;
      const h = g.room.hotspots.find((c) => c.id === "${id}");
      if (!h) return;
      const cx = h.area.rect
        ? h.area.rect.x + h.area.rect.w / 2
        : h.area.reduce((s, p) => s + p.x, 0) / h.area.length;
      const max = Math.max(0, (g.room.width ?? 1920) - 1920);
      g.cameraX = Math.max(0, Math.min(max, cx - 960));
      // Hold it there: a browser frame between this and the click would otherwise ease the
      // camera back toward Fenn. The click itself releases the focus.
      g.focusCameraX = cx;
      g.render();
    })()`);
    const point = await evaluate(`(() => {
      const g = window.__game;
      const h = g.room.hotspots.find((candidate) => candidate.id === "${id}");
      if (!h) throw new Error("Missing hotspot: ${id}");
      if (h.area.rect) {
        const r = h.area.rect;
        return { x: r.x + r.w / 2 - g.cameraX, y: r.y + r.h / 2 };
      }
      return {
        x: h.area.reduce((sum, p) => sum + p.x, 0) / h.area.length - g.cameraX,
        y: h.area.reduce((sum, p) => sum + p.y, 0) / h.area.length,
      };
    })()`);
    await click(point.x, point.y, button, frames);
  }
  async function shot(name) {
    await evaluate("window.__game.render()");
    await pause(100);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(output, name), Buffer.from(data, "base64"));
  }
  /** Click a hotspot until a condition holds — clicks can be swallowed between frames. */
  async function clickUntil(hotspotId, expression, label) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await clickHotspot(hotspotId);
      for (let i = 0; i < 12; i++) {
        if (await evaluate(expression)) return;
        await frame(60);
      }
    }
    throw new Error("Never satisfied: " + label + "\n" + await evaluate(`JSON.stringify((() => { const g = window.__game;
      return { room: g.room.id, x: Math.round(g.x), y: Math.round(g.y), narration: g.narration?.text, sentence: g.sentence,
        inventory: g.inventory, flags: Object.keys(g.flags).filter((f) => !f.includes(":")), dialogue: g.dialogue?.nodeId,
        act: g.act, queue: g.queue, fade: g.fade, pending: g.pendingRoom, paused: g.paused, cine: g.cinematic.active, title: g.title, won: g.won }; })())`));
  }
  /** Click a hotspot that leads to another room, retrying if the click lands mid-frame. */
  async function goTo(hotspotId, roomId) {
    // A click can be spent revealing a line that's still typing, so allow a few extra tries.
    for (let attempt = 0; attempt < 5; attempt++) {
      await clickHotspot(hotspotId);
      for (let i = 0; i < 15; i++) {
        if ((await evaluate("window.__game.room.id")) === roomId) return room(roomId);
        await frame(60);
      }
    }
    return room(roomId);
  }
  async function room(id) {
    // Fades and walks settle a few frames after the click, so poll before asserting.
    for (let i = 0; i < 20; i++) {
      if ((await evaluate("window.__game.room.id")) === id) break;
      await frame(60);
    }
    const actual = await evaluate("window.__game.room.id");
    assert.equal(actual, id);
    const saved = await evaluate('JSON.parse(localStorage.getItem("brasscompass.save.v3")).room');
    assert.equal(saved, id);
  }
  async function has(item) {
    assert.equal(await evaluate(`window.__game.inventory.includes("${item}")`), true);
  }
  /** Tab until a focus target is selected — inventory growth shifts tab order. */
  async function focusUntil(id, max = 80) {
    for (let i = 0; i < max; i++) {
      const current = await evaluate("window.__game.keyboardFocus?.id ?? null");
      if (current === id) return;
      await key("Tab");
    }
    throw new Error("Could not focus " + id);
  }
  /** Click an inventory chip by item id, regardless of slot or page. */
  async function clickItem(id, button = "left", frames = 4) {
    const slot = await evaluate(`(() => {
      const g = window.__game;
      const i = g.inventory.indexOf("${id}");
      if (i < 0) return -1;
      g.inventoryPage = Math.floor(i / 8);
      return i % 8;
    })()`);
    if (slot < 0) throw new Error("Missing item: " + id);
    const x = 1010 + (slot % 4) * 215 + 102;
    const y = 918 + Math.floor(slot / 4) * 84 + 37;
    await click(x, y, button, frames);
  }
  /** Read through a conversation, taking the first option each time, until `expression` holds. */
  async function talkThrough(expression, label) {
    for (let i = 0; i < 40; i++) {
      if (await evaluate(expression)) return;
      const state = await evaluate("(() => { const g = window.__game; return g.dialogue ? g.visibleChoices().length : -1; })()");
      if (state > 0) await key("1");
      else if (state === 0) await key("Enter");
      else await frame(60);
    }
    throw new Error("Never satisfied: " + label);
  }
  /** Pick dialogue option n through the real keyboard path. */
  async function choose(n) {
    // Enter reveals a line that's still typing; on a fully shown line it would pick option 1.
    if (await evaluate("(() => { const g = window.__game; const n = g.currentNode(); return Boolean(n && g.dialogue.shown < n.text.length); })()")) await key("Enter");
    await evaluate("window.__game.hoverChoice = -1");
    for (let i = 0; i <= n; i++) await key("ArrowDown");
    await key("Enter");
  }
  /** Read on through lines without options, then pick option n of the next node that has some. */
  async function pick(n) {
    for (let i = 0; i < 30; i++) {
      const state = await evaluate("(() => { const g = window.__game; return g.dialogue ? g.visibleChoices().length : -1; })()");
      if (state > 0) return choose(n);
      if (state === 0) await key("Enter");
      else await frame(60);
    }
    throw new Error("No options appeared for pick(" + n + ")");
  }
  /** Read on through lines without options until `expression` holds; fails on a choice. */
  async function advance(expression, label, max = 40) {
    for (let i = 0; i < max; i++) {
      if (await evaluate(expression)) return;
      const state = await evaluate("(() => { const g = window.__game; return g.dialogue ? g.visibleChoices().length : -1; })()");
      if (state > 0) throw new Error("Stopped at a choice (" + await node() + ") before: " + label);
      if (state === 0) await key("Enter");
      else await frame(60);
    }
    throw new Error("Never satisfied: " + label);
  }
  /** Read on to the next choice and pick the option whose text matches. */
  async function pickText(match) {
    for (let i = 0; i < 30; i++) {
      const texts = await evaluate("(() => { const g = window.__game; return g.dialogue ? g.visibleChoices().map((c) => c.text) : null; })()");
      if (texts && texts.length) {
        const n = texts.findIndex((t) => typeof match === "string" ? t === match : match.test(t));
        if (n < 0) throw new Error("No option " + match + " at " + await node() + ": " + JSON.stringify(texts));
        return choose(n);
      }
      if (texts) await key("Enter");
      else await frame(60);
    }
    throw new Error("No options appeared for " + match);
  }
  const node = () => evaluate("window.__game.dialogue?.nodeId ?? null");
  const flag = (id) => evaluate(`window.__game.flags[${JSON.stringify(id)}]`);
  const visible = (id) => evaluate(`window.__game.visibleHotspots().some((h) => h.id === ${JSON.stringify(id)})`);
  const said = () => evaluate("window.__game.narration?.text ?? ''");
  async function closeDialogue() {
    if (await evaluate("window.__game.dialogue !== null")) await click(960, 760, "right");
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  await until(() => evaluate("Boolean(window.__game)"), "game");
  await until(() => evaluate("!document.getElementById(\"boot\")"), "loading overlay");
  const invalidLinks = await evaluate(`(async () => {
    const { DIALOGUES } = await import("/src/content/dialogue.ts");
    const invalid = [];
    for (const tree of Object.values(DIALOGUES)) {
      if (!tree.nodes[tree.start]) invalid.push(tree.id + ":start");
      for (const node of Object.values(tree.nodes)) {
        for (const target of [node.next, ...(node.choices ?? []).map(c => c.to)]) {
          if (target && target !== "END" && !tree.nodes[target]) invalid.push(tree.id + ":" + target);
        }
      }
    }
    return invalid;
  })()`);
  assert.deepEqual(invalidLinks, []);
  // Placement lint: anything the player can be sent to is on the floor, nothing walkable stands
  // behind an occluder's floor line, and cut-off figures are always hidden by one.
  const placement = await evaluate(`(async () => {
    const { ROOMS, START_ROOM, START_POS } = await import("/src/content/rooms.ts");
    const { pointInPoly } = await import("/src/engine/walkbox.ts");
    const problems = [];
    const onFloor = (room, p) => room.walk.some((poly) => pointInPoly(p, poly));
    const check = (room, label, p) => { if (p && !onFloor(room, p)) problems.push(room.id + ":" + label); };
    check(ROOMS[START_ROOM], "start", START_POS);
    for (const room of Object.values(ROOMS)) {
      check(room, "entry", room.entry);
      for (const [from, p] of Object.entries(room.arrive ?? {})) check(room, "arrive." + from, p);
      for (const h of room.hotspots) if (!h.noWalk) check(room, "stand." + h.id, h.stand);
      const xs = room.walk.flat().map((p) => p.x), ys = room.walk.flat().map((p) => p.y);
      for (const o of room.occluders ?? []) {
        const left = Math.min(...o.area.map((p) => p.x)) - 40, right = Math.max(...o.area.map((p) => p.x)) + 40;
        for (let x = Math.min(...xs); x <= Math.max(...xs); x += 10) {
          for (let y = Math.min(...ys); y < o.y; y += 10) {
            if (x >= left && x <= right && onFloor(room, { x, y })) { problems.push(room.id + ":behind-occluder@" + x + "," + y); x = Infinity; break; }
          }
        }
      }
      for (const s of room.sprites ?? []) {
        if ((s.visible ?? 1) >= 1) continue;
        const hidden = (room.occluders ?? []).some((o) => o.y > s.y &&
          s.x > Math.min(...o.area.map((p) => p.x)) && s.x < Math.max(...o.area.map((p) => p.x)));
        if (!hidden) problems.push(room.id + ":uncovered-cut." + s.key);
      }
    }
    return problems;
  })()`);
  assert.deepEqual(placement, []);
  // Content lint: every reference resolves. Dead flags and overlong lines are warnings while
  // the story is being rewritten; broken references fail.
  const lint = await evaluate(`(async () => {
    const { ROOMS } = await import("/src/content/rooms.ts");
    const { DIALOGUES } = await import("/src/content/dialogue.ts");
    const { ITEMS } = await import("/src/content/items.ts");
    const { ACTS, ENDING } = await import("/src/content/acts.ts");
    const { CHARACTERS } = await import("/src/content/characters.ts");
    const { GLOBAL_COMBOS } = await import("/src/content/combos.ts");
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
        // One-door rooms arrive at their entry; rooms with several doors must list each.
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
  await shot("test-title.png");
  await key("Enter");
  assert.equal(await evaluate("window.__game.cinematic.active"), true);
  await until(() => evaluate("document.querySelector('.cinematic video').currentTime > 2.5"), "intro title");
  await shot("test-intro.png");
  await key("Enter");
  assert.equal(await evaluate("window.__game.title"), false);
  await shot("test-docks.png");
  await key("ArrowRight");
  for (let i = 0; i < 5; i++) await key("ArrowRight");
  await key("ArrowDown");
  await key("ArrowLeft");
  await key("ArrowLeft");
  assert.equal(await evaluate("window.__game.keyboardFocus.id"), "look");
  await key("Enter");
  assert.equal(await evaluate("window.__game.sentence.verb"), "look");
  await focusUntil("ship");
  await key("Enter");
  assert.match(await evaluate("window.__game.narration.text"), /Marrow/);
  await shot("test-keyboard.png");
  await clickWorld(1110, 840);
  await clickWorld(1090, 580, "left", 5);
  assert.equal(await evaluate("window.__game.moveDirection"), "up");
  await shot("test-direction-up.png");
  await frame();
  assert.equal(await evaluate("window.__game.y < 650"), true);
  await click(850, 910); // Pick up
  await clickHotspot("crowbar");
  await has("crowbar");
  await focusUntil("crowbar");
  await key("Enter");
  assert.equal(await evaluate("window.__game.sentence.a.id"), "crowbar");
  await shot("test-keyboard-inventory.png");
  await click(960, 760, "right");
  await click(550, 960); // Look at
  await clickItem("crowbar");
  assert.match(await evaluate("window.__game.narration.text"), /ambitions/);
  await click(300, 820); // walk back left so the water hotspot is on screen
  await frame(600);
  await click(720, 960); // Turn on
  await clickHotspot("water", "left", 1);
  assert.match(await evaluate("window.__game.narration.text"), /no switch/);
  assert.doesNotMatch(await evaluate("window.__game.narration.text"), /\bthe the\b/i);
  assert.equal(await evaluate("window.__game.rejection > 0"), true);
  await shot("test-rejection.png");
  await click(960, 100, "right"); // empty sky: cancels (on a thing it would act)
  await key("Escape");
  assert.equal(await evaluate("window.__game.paused"), true);
  await shot("test-settings.png");
  await key("Escape");
  assert.equal(await evaluate("window.__game.paused"), false);
  await click(390, 960); // Use
  await clickItem("crowbar");
  await clickHotspot("crate");
  await has("rum");
  assert.equal(await evaluate("window.__game.rejection"), 0);
  await clickHotspot("tavern_door", "left", 0);
  assert.equal(await evaluate("window.__game.pendingRoom"), null);
  assert.equal(await evaluate("window.__game.path.length > 0"), true);
  await frame();
  await room("tavern");
  await click(1450, 800);
  assert.equal(await evaluate("window.__game.cameraX > 0"), true);
  await shot("test-tavern.png");
  await send("Page.reload");
  await until(() => evaluate("Boolean(window.__game?.title)"), "title after reload");
  await key("c");
  await room("tavern");
  await click(1450, 800);
  // Smart click: with no verb chosen, a plain click on Marta does the lit-up verb (Talk to).
  assert.equal(await evaluate("window.__game.sentence.verb"), null);
  await clickHotspot("marta");
  assert.equal(await evaluate("window.__game.dialogue?.tree.id"), "tavernkeeper");
  assert.equal(await evaluate("window.__game.facing"), 1); // turned toward Marta
  await shot("test-dialogue.png");
  await key("ArrowDown");
  await key("ArrowDown");
  assert.equal(await evaluate("window.__game.hoverChoice"), 1);
  await key("Enter");
  assert.equal(await evaluate("window.__game.dialogue.nodeId"), "favour"); // she wants to know what for
  await click(960, 760, "right"); // close dialogue
  assert.equal(await evaluate("window.__game.dialogue"), null);
  // Right-click on a thing looks at it.
  await clickHotspot("marta", "right");
  assert.equal(await evaluate("window.__game.dialogue"), null);
  assert.equal(await evaluate("window.__game.flags['looked:tavern.marta']"), true);
  await click(220, 960); // Give
  await clickItem("rum");
  await clickHotspot("marta");
  await has("drawer_key");
  await click(250, 800);
  // Double-click a way out: through it at once, without the walk.
  const door = await hotspotPoint("door_out");
  await doubleClick(door.x, door.y);
  assert.equal(await evaluate("window.__game.path.length"), 0);
  assert.equal(await evaluate("window.__game.pendingRoom"), "dock");
  await room("dock");
  assert.equal(await evaluate("Math.hypot(window.__game.x - 1390, window.__game.y - 600) < 2"), true); // out of the tavern door
  // Double-click the floor: Fenn runs there.
  await doubleClick(1750, 800);
  assert.equal(await evaluate("window.__game.running && window.__game.path.length > 0"), true);
  await frame();
  assert.equal(await evaluate("window.__game.running"), false); // arrived
  assert.equal(await evaluate("window.__game.cameraX > 300"), true);
  await shot("test-dock-scrolled.png");
  await goTo("office_door", "office");
  await click(1750, 800);
  assert.equal(await evaluate("window.__game.cameraX > 0"), true);
  await shot("test-office.png");
  await click(850, 910); // Pick up
  await clickHotspot("licence");
  await has("licence_form");
  await click(390, 960); // Use
  await clickItem("drawer_key");
  await clickHotspot("drawer");
  await has("stamp");
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickItem("licence_form");
  await has("licence");

  // ---- Act I extras: the IOU in the drawer, Marta remembers it, and the regulars' wager ----
  await click(550, 960); // Look at
  await clickHotspot("iou");
  assert.match(await said(), /everything else/);
  assert.equal(await flag("seen_iou"), true);
  await click(250, 800);
  await goTo("door_out", "dock");
  await goTo("tavern_door", "tavern");
  await click(70, 960); // Talk to
  await clickHotspot("marta");
  await choose(0); // "What's everyone celebrating?"
  await choose(1); // "Who sails on her?"
  assert.equal(await node(), "crew");
  await pick(1); // "I'll mind her. Goodnight."
  await closeDialogue();
  await click(70, 960); // Talk to
  await clickHotspot("marta");
  assert.equal(await evaluate("window.__game.visibleChoices()[2].text"), "Bramwick still owes you a game of cards.");
  await choose(2);
  await pick(1); // tell her where he keeps it
  assert.equal(await node(), "front");
  await closeDialogue();
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickUntil("crowd", "window.__game.dialogue?.tree.id === 'regulars'", "wager");
  await pick(0);
  assert.equal(await flag("wager"), true);
  await closeDialogue();
  await shot("test-wager.png");

  // ---- the story gate: manifest from the chandler, then the loft ledger ----
  await goTo("door_out", "dock");
  await goTo("alley_mouth", "alley");
  // The first time into the lane, Cray steps out: a line, then his conversation.
  for (let i = 0; i < 40 && (await evaluate("window.__game.dialogue?.tree.id ?? null")) !== "silas"; i++) await frame(60);
  assert.equal(await node(), "root");
  await closeDialogue();
  await shot("test-alley.png");
  await goTo("chandlery_door", "chandlery");
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickHotspot("counter");
  await has("manifest");
  await shot("test-chandlery.png");

  await goTo("door_out", "alley");
  await click(390, 960); // Use
  await clickItem("crowbar");
  await clickUntil("warehouse_stairs", "window.__game.flags.loft_open === true", "loft opened");
  await goTo("loft_stairs_open", "warehouse");
  await click(390, 960); // Use
  await clickUntil("ledger", "window.__game.flags.ledger_read === true", "ledger read");
  await shot("test-warehouse.png");

  await goTo("stairs_down", "alley");
  await goTo("to_dock", "dock");
  await goTo("office_door", "office");

  await click(220, 960); // Give
  await clickItem("licence");
  await clickUntil("bramwick", "window.__game.dialogue !== null || window.__game.queue !== null", "confession");
  await talkThrough("window.__game.act === 2", "act I complete");
  // Two chained cinematics: the Act I outro, then the Act II title card.
  for (const [i, name] of [[0, "test-outro.png"], [1, "test-act2-title.png"]]) {
    await until(() => evaluate("window.__game.cinematic.active"), "cinematic " + i);
    await until(() => evaluate("document.querySelector('.cinematic video').currentTime > 0.5"), "video " + i);
    await shot(name);
    await key("Enter");
  }
  await room("marrow_deck");
  assert.equal(await evaluate("window.__game.inventory.includes('manifest')"), true);
  await shot("test-act2-deck.png");

  // ---- Act II: Quill and the spyglass ----
  await click(850, 910); // Pick up
  await clickHotspot("spyglass");
  await has("spyglass");
  await click(70, 960); // Talk to
  await clickHotspot("quill");
  await choose(1); // "I need to see the captain."
  await choose(0); // "What would get me past?" (she mentions the spyglass)
  await choose(0); // "Is this it?"
  await choose(0); // give it to her
  for (let i = 0; i < 10 && !(await flag("quill_helped")); i++) await frame(30);
  await pick(0); // "Thank you, Quill." (+aff)
  assert.equal(await flag("aff"), 1);
  await closeDialogue();

  // ---- Branch A, out of order: dinner and the chest before the captain has named her terms ----
  await goTo("hatch", "below_decks");
  await shot("test-act2-below.png");
  await click(70, 960); // Talk to
  await clickHotspot("hobb");
  await choose(1); // "Those tattoos."
  await choose(0); // "I'm sorry."
  assert.equal(await node(), "sorry");
  await closeDialogue();
  await click(220, 960); // Give
  await clickItem("manifest");
  await clickHotspot("hobb");
  assert.match(await said(), /empty stomach/);
  await click(115, 910); // Open
  await clickHotspot("chest");
  assert.match(await said(), /Hobb's hand/);
  await click(70, 960); // Talk to
  await clickHotspot("dorrit");
  await choose(0); // "Then why isn't dinner served?"
  assert.equal(await node(), "stamp");
  await closeDialogue();
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickUntil("stew", "window.__game.dialogue?.nodeId === 'passed'", "stew passed");
  await pick(0);
  assert.equal(await flag("dinner"), true);
  await closeDialogue();
  // The gong moves Hobb from the chest to the mess table.
  assert.equal(await visible("hobb"), false);
  assert.equal(await visible("hobb_table"), true);
  await click(115, 910); // Open
  await clickHotspot("chest");
  await has("sextant");
  await has("pell_log");
  await click(220, 960); // Give
  await clickItem("manifest");
  await clickHotspot("hobb_table");
  assert.match(await said(), /hasn't said south/);
  assert.equal(await flag("crew_agree"), undefined);
  await shot("test-act2-dinner.png");
  await goTo("ladder", "marrow_deck");
  await click(220, 960); // Give
  await clickItem("sextant");
  await clickHotspot("quill");
  assert.match(await said(), /long way steers itself/);
  await has("sextant");
  // Optional clue: Cray's kelp in the deck crates.
  await click(390, 960); // Use
  await clickItem("crowbar");
  await clickUntil("crates", "window.__game.flags.kelp_seen === true", "kelp clue");

  // ---- The captain's terms ----
  await goTo("stairs_up", "marrow_quarterdeck");
  await goTo("cabin_door", "marrow_cabin");
  await shot("test-act2-cabin.png");
  await click(390, 960); // Use
  await clickItem("compass");
  await clickUntil("chart", "window.__game.dialogue !== null || window.__game.queue !== null", "compass reveal");
  await talkThrough("window.__game.flags.vane_terms === true && window.__game.dialogue === null", "Vane's terms");
  assert.equal(await evaluate("window.__game.act"), 2);
  await click(220, 960); // Give
  await clickItem("pell_log");
  await clickHotspot("vane");
  assert.match(await said(), /Not yet/);

  // ---- Quill becomes navigator ----
  await goTo("door_out", "marrow_quarterdeck");
  await goTo("stairs_down", "marrow_deck");
  await click(220, 960); // Give
  await clickItem("sextant");
  await clickUntil("quill", "window.__game.dialogue?.tree.id === 'quill'", "sextant to Quill");
  await pick(0); // "I want the captain to hear it from a navigator."
  await pick(0); // "Not in the log, you're not." (+aff)
  assert.equal(await node(), "write");
  await pick(1); // "Tell her yourself." (+aff)
  assert.equal(await flag("quill_navigator"), true);
  await closeDialogue();
  assert.equal(await visible("quill"), false); // gone aft to the quarterdeck

  // ---- The night watch (optional) ----
  await click(390, 960); // Use
  await clickHotspot("shrouds");
  await room("crows_nest");
  await shot("test-act2-night.png");
  await click(70, 960); // Talk to
  await clickHotspot("quill");
  await pick(1); // "I wanted to see what you see up here." (+aff)
  await pick(1); // "What do you see, when you look out?"
  await pick(0); // "Ink." (+aff)
  await pick(0); // "He left the compass for me." (+aff)
  await pick(1); // say nothing (+aff)
  assert.equal(await flag("night_watch"), true);
  assert.equal(await flag("aff"), 7);
  await shot("test-act2-night-talk.png");
  await closeDialogue();
  await goTo("below", "marrow_deck");

  // ---- Branch B: Hobb and the manifest ----
  await goTo("hatch", "below_decks");
  await click(220, 960); // Give
  await clickItem("manifest");
  await clickUntil("hobb_table", "window.__game.dialogue?.tree.id === 'hobb'", "manifest to Hobb");
  await pick(0); // "It says lost."
  assert.equal(await flag("crew_agree"), true);
  await closeDialogue();
  await goTo("ladder", "marrow_deck");
  await goTo("stairs_up", "marrow_quarterdeck");
  await click(70, 960); // Talk to
  await clickHotspot("quill");
  assert.equal(await node(), "nav");
  await closeDialogue();

  // ---- Pell's reason ----
  await goTo("cabin_door", "marrow_cabin");
  await click(220, 960); // Give
  await clickItem("pell_log");
  await clickUntil("vane", "window.__game.dialogue?.tree.id === 'vane'", "Pell's log");
  await pick(0); // "May I read it to you?"
  await pick(1); // "I've never said aye before."
  assert.equal(await flag("vane_convinced"), true);
  await closeDialogue();
  assert.equal(await visible("vane"), false); // up on deck now
  await goTo("door_out", "marrow_quarterdeck");
  assert.equal(await visible("vane"), true);
  await goTo("stairs_down", "marrow_deck");
  await goTo("forward", "bow_fog");
  await shot("test-act2-bow.png");

  // ---- The fog run, with one wrong call ----
  await click(390, 960); // Use
  await clickItem("compass");
  await clickUntil("fog", "window.__game.dialogue?.tree.id === 'bearings'", "bearings");
  await pick(1); // "Starboard!" (wrong)
  await pick(0); // back round to the same needle: "Port!"
  assert.equal(await flag("seen:bearings.oneRock"), true);
  await pick(0); // "Steady as she goes."
  await pick(0); // (Listen.) Quill taught him last night
  assert.equal(await flag("seen:bearings.me"), true);
  await pick(0); // "Starboard, a little."
  await pick(1); // "Underlined." (+aff)
  for (let i = 0; i < 12 && (await node()) !== "vane"; i++) await key("Enter");
  assert.equal(await node(), "vane");
  await shot("test-act2-sighting.png");
  // High affection adds a look back at Quill before the act ends.
  assert.equal(await evaluate("window.__game.visibleChoices().length"), 2);
  await choose(1);
  assert.equal(await node(), "look");
  await pick(0); // "That's the Arcadia."
  // Vane gives her orders, then the Act II outro plays, then the Act III title card.
  await advance("window.__game.cinematic.active", "act II outro");
  await until(() => evaluate("document.querySelector('.cinematic video').currentTime > 4.5"), "outro line");
  await shot("test-act2-outro.png");
  await key("Enter");
  await until(() => evaluate("window.__game.cinematic.active && document.querySelector('.cinematic video').currentTime > 2.5"), "act III title");
  await shot("test-act3-title.png");
  await key("Enter");
  await room("reef_wreck");
  assert.equal(await evaluate("window.__game.act"), 3);

  // ---- Act III: the wreck. Quill hands back the crowbar after the caption. ----
  for (let i = 0; i < 40 && !(await evaluate("window.__game.inventory.includes('crowbar')")); i++) await frame(60);
  await has("crowbar");
  assert.equal(await evaluate("window.__game.inventory.includes('manifest')"), false); // stowed
  await shot("test-act3-reef.png");
  await click(70, 960); // Talk to
  await clickHotspot("quill");
  assert.equal(await node(), "boat");
  await pick(1); // "Thank you for rowing." (+aff)
  await pick(0); // "What did the captain say, exactly?"
  assert.equal(await node(), "plan");
  await closeDialogue();
  // Out of order: the hatch won't open by hand.
  await click(115, 910); // Open
  await clickHotspot("hatch");
  assert.match(await said(), /doesn't move/);
  assert.equal(await visible("flats"), false); // no way across without Ansel
  await click(390, 960); // Use
  await clickItem("crowbar");
  await clickUntil("hatch", "window.__game.flags.hatch_open === true", "hatch prised open");
  await goTo("hatch", "arcadia_cabin");
  await shot("test-act3-cabin.png");

  // ---- The cabin: Lise's portrait, the log Quill reads aloud, a blank bill, a bucket ----
  await click(550, 960); // Look at
  await clickHotspot("portrait");
  assert.match(await said(), /My mother/);
  await click(70, 960); // Talk to
  await clickHotspot("quill");
  await pick(0); // "That's my mother, on the wall." (+aff)
  assert.equal(await node(), "mother");
  await closeDialogue();
  await click(850, 910); // Pick up
  await clickUntil("log", "window.__game.dialogue?.tree.id === 'log'", "Ansel's log");
  await has("ansel_log");
  await pick(0); // hold the log out to Quill
  assert.equal(await node(), "reads");
  await pick(0); // "Thank you for reading it." (+aff)
  assert.equal(await flag("seen:log.anyway"), true);
  assert.equal(await node(), "thanks");
  await shot("test-act3-log.png");
  await closeDialogue();
  await click(850, 910); // Pick up
  await clickHotspot("pigeonholes");
  await has("bill");
  await click(850, 910); // Pick up
  await clickHotspot("bucket");
  await has("bucket");
  await goTo("ladder", "reef_wreck");
  await click(390, 960); // Use
  await clickItem("bucket");
  await clickHotspot("lagoon");
  await has("bucket_water");

  // ---- Gullet Key: the forms war at the gate ----
  await goTo("boat", "lagoon_shore");
  await shot("test-act3-shore.png");
  await goTo("path", "key_gate");
  await click(70, 960); // Talk to
  await clickHotspot("pike");
  await pick(0); // "What does a Bill of Health need, exactly?"
  assert.equal(await node(), "need");
  await closeDialogue();
  // Out of order: a blank bill is refused, and Pike says what's missing.
  await click(220, 960); // Give
  await clickItem("bill");
  await clickHotspot("pike");
  assert.match(await said(), /Not fumigated/);
  assert.equal(await flag("gate_open"), undefined);
  await click(390, 960); // Use
  await clickItem("bucket_water");
  await clickHotspot("brazier");
  assert.match(await said(), /fumigate me instead/);
  await has("bucket_water");
  await click(390, 960); // Use
  await clickItem("bill");
  await clickUntil("brazier", "window.__game.flags.bill_smoked === true", "bill fumigated");
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickItem("bill");
  assert.equal(await flag("bill_stamped"), true);
  await click(220, 960); // Give
  await clickItem("bill");
  await clickHotspot("pike");
  assert.match(await said(), /Not countersigned/);
  await click(220, 960); // Give
  await clickItem("bill");
  await clickUntil("quill", "window.__game.dialogue?.tree.id === 'quill3'", "Quill countersigns");
  await pick(0); // "It looks good." (+aff)
  assert.equal(await flag("bill_signed"), true);
  await closeDialogue();
  // The calendar is watched until Pike shuts his eyes for regulation six.
  await click(850, 910); // Pick up
  await clickHotspot("calendar");
  assert.match(await said(), /Station property/);
  await click(70, 960); // Talk to
  await clickHotspot("pike");
  assert.equal(await node(), "again");
  await pick(1); // "What's regulation six?"
  for (let i = 0; i < 10 && (await node()) !== null; i++) await key("Enter");
  assert.equal(await flag("pike_reading"), true);
  await click(850, 910); // Pick up
  await clickHotspot("calendar");
  await has("calendar_leaf");
  assert.equal(await flag("pike_reading"), false);
  await click(390, 960); // Use
  await clickItem("calendar_leaf");
  await clickItem("bill");
  assert.equal(await flag("bill_dated"), true);
  await click(220, 960); // Give
  await clickItem("bill");
  await clickUntil("pike", "window.__game.dialogue?.tree.id === 'pike'", "the finished bill");
  await pick(0); // "Thank you, Pike."
  assert.equal(await flag("gate_open"), true);
  assert.equal(await flag("seen:pike.beautiful"), true);
  await closeDialogue();
  await shot("test-act3-gate.png");

  // ---- The Weather Works: the fog comes down, and the halyard ----
  await goTo("gate", "weather_works");
  await shot("test-act3-works.png");
  await click(390, 960); // Use
  await clickItem("bucket_water");
  await clickUntil("great_brazier", "window.__game.dialogue?.tree.id === 'halyard'", "fog down");
  assert.equal(await flag("fog_down"), true);
  await pick(1); // "Run, Quill." (+aff)
  await pick(0); // "I am holding on to you." (+aff)
  assert.equal(await node(), "keep");
  await shot("test-act3-halyard.png");
  await key("Enter");
  await key("Enter"); // the swing
  await room("salt_camp");

  // ---- The salt camp: the cell, Form 9 and the kiss ----
  for (let i = 0; i < 20 && (await evaluate("window.__game.dialogue?.tree.id ?? null")) !== "pike"; i++) await frame(60);
  await pick(0); // "What would release her?"
  assert.equal(await node(), "nine");
  await pick(0); // "Then I'll write one."
  assert.equal(await flag("knows_form9"), true);
  await closeDialogue();
  assert.equal(await visible("quill"), false); // in the store hut
  await shot("test-act3-camp.png");
  await click(70, 960); // Talk to
  await clickHotspot("hut");
  await pick(0); // "I'm getting you out. I promise." (+aff)
  assert.equal(await node(), "promise");
  await closeDialogue();
  await click(70, 960); // Talk to
  await clickHotspot("tamhobb");
  await pick(0); // "You're Tam Hobb."
  await pick(0); // his brother's arm
  await pick(0); // "He left room on his arm." (+aff)
  assert.equal(await flag("seen:tamhobb.arm2"), true);
  await closeDialogue();
  // Out of order: the bill alone is not a Form 9.
  await click(220, 960); // Give
  await clickItem("bill");
  await clickHotspot("pike");
  assert.match(await said(), /isn't a Form 9/);
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickItem("bill");
  assert.equal(await flag("form9"), true);
  await click(220, 960); // Give
  await clickItem("bill");
  await clickUntil("pike", "window.__game.dialogue?.tree.id === 'pike'", "Form 9");
  await pick(0); // "Yes. I wrote it in the plural."
  await pick(1); // "I'd have written a hundred." (+aff)
  assert.equal(await node(), "kiss");
  await key("Enter");
  assert.equal(await node(), "ansel");
  await shot("test-act3-kiss.png");
  assert.equal(await flag("quill_free"), true);

  // ---- The reunion, straight on from the kiss ----
  await advance("window.__game.dialogue?.tree.id === 'ansel' && window.__game.dialogue.nodeId === 'taller'", "the reunion");
  await pickText("Hello, Father."); // (+aff)
  await pick(0); // "They wrote you down as lost."
  await pickText("I read the log. The L is for her.");
  await pickText(/ship outside the Needle/);
  await has("flag16");
  assert.equal(await flag("ansel_met"), true);
  await pickText("Why mustard?"); // (+aff)
  assert.equal(await node(), "why");
  await shot("test-act3-reunion.png");
  await closeDialogue();
  assert.equal(await visible("quill"), true);
  assert.equal(await visible("ansel"), true);
  // Pike files the form and hands over his roll of the crews.
  await click(70, 960); // Talk to
  await clickUntil("pike", "window.__game.dialogue?.tree.id === 'pike'", "Pike's roll");
  assert.equal(await node(), "done");
  await pickText("Customs is hiring. We have a great many forms.");
  assert.equal(await flag("pike_roll"), true);
  assert.equal(await node(), "hiring");
  await closeDialogue();

  // ---- The signal ----
  await goTo("flats", "reef_wreck");
  await click(390, 960); // Use
  await clickItem("flag16");
  await clickUntil("halyard", "window.__game.dialogue?.tree.id === 'signal'", "flag sixteen");
  assert.equal(await flag("flag16_up"), true);
  for (let i = 0; i < 6 && (await node()) !== "about"; i++) await key("Enter");
  assert.equal(await flag("aff") >= 12, true);
  assert.equal(await evaluate("window.__game.visibleChoices().length"), 2);
  await choose(1); // take Quill's hand
  assert.equal(await node(), "hand");
  await shot("test-act3-signal.png");
  await pick(0); // "Let him try. I have better handwriting."
  // The Act III outro plays, then the ending card.
  await until(() => evaluate("window.__game.cinematic.active"), "act III outro");
  await until(() => evaluate("document.querySelector('.cinematic video').currentTime > 4.5"), "act III outro line");
  await shot("test-act3-outro.png");
  await key("Enter");
  // The Act IV title card, then the dock: Act III's tools are stowed.
  await until(() => evaluate("window.__game.cinematic.active && document.querySelector('.cinematic video').currentTime > 2.5"), "act IV title");
  await shot("test-act4-title.png");
  await key("Enter");
  await room("dock");
  assert.equal(await evaluate("window.__game.act"), 4);
  assert.deepEqual(await evaluate("window.__game.inventory"), ["compass", "stamp", "crowbar", "ansel_log"]);

  // ---- Act IV: All Hands Returned. Quill's farewell from the rail opens after the caption. ----
  for (let i = 0; i < 40 && (await evaluate("window.__game.dialogue?.tree.id ?? null")) !== "quill4"; i++) await frame(60);
  assert.equal(await node(), "farewell");
  await pick(0); // "Then I have until dawn." (+aff)
  for (let i = 0; i < 6 && (await node()) !== "name"; i++) await key("Enter");
  assert.equal(await evaluate("window.__game.currentNode().text"), "Fenn.");
  await shot("test-act4-farewell.png");
  await pick(1); // "Say it again." (+aff)
  assert.equal(await node(), "again");
  assert.equal(await flag("farewell"), true);
  await closeDialogue();
  await shot("test-act4-dock.png");
  // The Act I pier furniture is gone; tonight's people and doors are here.
  for (const id of ["crate", "crowbar", "village_steps"]) assert.equal(await visible(id), false, id);
  for (const id of ["quill_rail", "ansel_rail", "boom", "pier_way", "steps_shut"]) assert.equal(await visible(id), true, id);
  await click(70, 960); // Talk to
  await clickHotspot("ansel_rail");
  await pick(0); // "Rook's in the Salty Keel."
  assert.equal(await node(), "rook");
  await closeDialogue();

  // ---- The office: Acting Harbourmaster Cray ----
  await goTo("office_door", "office");
  for (const id of ["bramwick", "licence", "iou"]) assert.equal(await visible(id), false, id);
  assert.equal(await visible("cray"), true);
  await shot("test-act4-office.png");
  await click(70, 960); // Talk to
  await clickHotspot("cray");
  await pick(0); // "You emptied six ships."
  assert.equal(await node(), "six");
  await pick(2); // "Where's Bramwick?"
  assert.equal(await node(), "where");
  await closeDialogue();
  await goTo("door_out", "dock");

  // ---- The Salty Keel: Bramwick, suspended, and Rook ----
  await goTo("tavern_door", "tavern");
  await shot("test-act4-tavern.png");
  await click(70, 960); // Talk to
  await clickHotspot("bramwick_t");
  await pick(1); // "How do we get you reinstated?"
  assert.equal(await node(), "reg2");
  await pick(0); // "What paper?"
  assert.equal(await node(), "paper");
  await closeDialogue();
  // Out of order: the evidence isn't for writing in yet.
  assert.equal(await visible("cray_t"), false);
  await click(70, 960); // Talk to
  await clickHotspot("rook");
  await pick(0); // "We found the Arcadia."
  for (let i = 0; i < 4 && (await node()) !== "inside"; i++) await key("Enter");
  assert.equal(await evaluate("window.__game.visibleChoices().length"), 2); // Ansel's message about the reef
  await choose(1); // "He says you owe him a reef."
  assert.equal(await node(), "reef");
  await pick(0); // "You could look at it now."
  for (let i = 0; i < 4 && !(await evaluate("window.__game.inventory.includes('purse')")); i++) await key("Enter");
  await has("purse");
  await closeDialogue();

  // ---- Cray & Co.: Nib and the requisition ----
  await goTo("door_out", "dock");
  await goTo("alley_mouth", "alley");
  assert.equal(await visible("silas"), false);
  await goTo("counting_door", "counting_house");
  await shot("test-act4-counting.png");
  await click(70, 960); // Talk to
  await clickHotspot("nib");
  await pick(1); // "I'd like your insurance claims book."
  for (let i = 0; i < 3 && (await node()) !== "claims2"; i++) await key("Enter");
  assert.equal(await node(), "claims2");
  await closeDialogue();
  await click(850, 910); // Pick up
  await clickHotspot("tray");
  await has("requisition");
  await click(220, 960); // Give
  await clickItem("requisition");
  await clickHotspot("nib");
  assert.match(await said(), /isn't stamped/);
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickItem("requisition");
  assert.equal(await flag("req_stamped"), true);
  await click(220, 960); // Give
  await clickItem("requisition");
  await clickUntil("nib", "window.__game.dialogue?.tree.id === 'nib'", "claims book");
  await has("claims_book");
  await pick(0); // "Do you know what you've just given me?"
  await closeDialogue();

  // ---- The loft: the crowbar takes the ledger off its chain ----
  await goTo("door_out", "alley");
  await goTo("loft_stairs_open", "warehouse");
  await click(115, 910); // Open
  await clickHotspot("ledger");
  assert.match(await said(), /chained/);
  await click(390, 960); // Use
  await clickItem("crowbar");
  await clickUntil("ledger", "window.__game.inventory.includes('ledger')", "ledger off its chain");
  assert.equal(await visible("ledger"), false);
  assert.equal(await visible("chain"), true);
  await shot("test-act4-loft.png");
  await goTo("stairs_down", "alley");
  await goTo("to_dock", "dock");

  // ---- The pier end (optional): the kelp manifest ----
  await goTo("pier_way", "pier_end");
  await shot("test-act4-pier.png");
  await click(70, 960); // Talk to
  await clickHotspot("wilf");
  await pick(1); // "Aren't you meant to be menacing me?"
  assert.equal(await node(), "menace");
  await closeDialogue();
  await click(850, 910); // Pick up
  await clickHotspot("kelp_manifest");
  await has("kelp_manifest");
  assert.equal(await flag("kelp_proof"), true);
  await goTo("town", "dock");

  // ---- The inquiry at the Salty Keel, with one wrong piece of evidence ----
  await goTo("tavern_door", "tavern");
  assert.equal(await visible("cray_t"), true);
  assert.match(await said(), /dawn|memory/);
  await click(70, 960); // Talk to
  await clickUntil("cray_t", "window.__game.dialogue?.tree.id === 'inquiry'", "the inquiry");
  await pick(0); // "I've come to hold an inquiry."
  await advance("window.__game.dialogue?.nodeId === 'c1'", "charge the first");
  assert.equal(await flag("inquiry_started"), true);
  assert.equal(await visible("dorrit_t"), true);
  assert.equal(await evaluate("window.__game.visibleChoices().length"), 5); // log, ledger, book, purse, kelp
  await choose(1); // the ledger: wrong
  assert.equal(await node(), "c1_ledger");
  await pick(0); // Marta repeats the charge; Ansel's log
  assert.equal(await flag("seen:inquiry.c1r"), true);
  for (let i = 0; i < 6 && (await node()) !== "c2"; i++) await key("Enter");
  await shot("test-act4-inquiry.png");
  await choose(1); // the ledger
  for (let i = 0; i < 6 && (await node()) !== "c3"; i++) await key("Enter");
  await choose(2); // the claims book
  assert.equal(await node(), "c3ok");
  for (let i = 0; i < 6 && (await node()) !== "c4"; i++) await key("Enter");
  await choose(3); // the purse: Rook stands up
  await advance("window.__game.dialogue?.nodeId === 'pair'", "the receipt");
  await pickText("(Show the kelp manifest.)"); // "for fog"
  assert.equal(await flag("kelp_read"), true);
  await advance("window.__game.dialogue?.nodeId === 'point'", "Cray's last word");
  await pickText(/This one pointed at you/);
  for (let i = 0; i < 12 && (await node()) !== null; i++) await key("Enter");
  assert.equal(await flag("inquiry_done"), true);
  assert.equal(await evaluate("window.__game.inventory.includes('purse') || window.__game.inventory.includes('claims_book')"), false);
  assert.equal(await visible("cray_t"), false);

  // ---- Bramwick reinstated: the stamp goes back, the quarantine comes down ----
  await click(220, 960); // Give
  await clickItem("stamp");
  await clickUntil("bramwick_t", "window.__game.dialogue?.tree.id === 'bramwick4'", "stamp back");
  for (let i = 0; i < 14 && (await node()) !== null; i++) await key("Enter");
  assert.equal(await flag("quarantine_lifted"), true);
  await has("stamp"); // lent back for the ledger
  assert.equal(await visible("ansel_t"), true);
  // The IOU, paid at last, and one more hand.
  await click(70, 960); // Talk to
  await clickHotspot("bramwick_t");
  await pick(0); // "The IOU in your drawer."
  await pick(0); // "Including the small writing."
  for (let i = 0; i < 10 && (await node()) !== "deal"; i++) await key("Enter");
  assert.equal(await flag("iou_paid"), true);
  assert.equal(await evaluate("window.__game.visibleChoices()[0].text"), "You'd have found it right at the front of the drawer.");
  await choose(0);
  assert.equal(await node(), "front");
  await shot("test-act4-iou.png");
  await closeDialogue();
  // The regulars pay up on the wager.
  await click(70, 960); // Talk to
  await clickHotspot("crowd");
  for (let i = 0; i < 6 && (await node()) !== null; i++) await key("Enter");
  assert.equal(await flag("wager_paid"), true);
  // The ledger, corrected at the bar.
  await click(390, 960); // Use
  await clickItem("stamp");
  await clickItem("ledger");
  for (let i = 0; i < 20 && (await evaluate("window.__game.dialogue?.tree.id ?? null")) !== "ledger4"; i++) await frame(30);
  await pick(0); // (Write.)
  assert.equal(await node(), "write_roll"); // Pike's roll goes in too
  await advance("window.__game.dialogue?.nodeId === 'ending'", "the ledger entry");
  assert.equal(await flag("ledger_written"), true);
  await shot("test-act4-ledger.png");
  await pick(0);
  await closeDialogue();

  // ---- Dawn on the pier: sea or desk ----
  await goTo("door_out", "dock");
  assert.equal(await visible("quill_rail"), false);
  assert.equal(await visible("quill_pier"), true);
  await click(70, 960); // Talk to
  await clickHotspot("quill_pier");
  await pick(0); // "You called me Fenn. Earlier."
  assert.equal(await node(), "once");
  await pick(0); // "Sign me on. Purser."
  for (let i = 0; i < 3 && (await node()) !== "biscuits"; i++) await key("Enter");
  assert.equal(await evaluate("window.__game.visibleChoices().length"), 2); // high affection: a kiss
  await choose(1); // (Kiss her.)
  assert.equal(await node(), "pkiss");
  await shot("test-act4-dawn.png");
  await pick(0); // (Go aboard.)
  assert.equal(await flag("ending_pirate"), true);
  // The finale, then the ending card.
  await until(() => evaluate("window.__game.cinematic.active"), "finale");
  await until(() => evaluate("document.querySelector('.cinematic video').currentTime > 7"), "the ledger line, stamped");
  await shot("test-act4-finale.png");
  await key("Enter");
  await until(() => evaluate("window.__game.won === true"), "ending card");
  const card = await evaluate(`(async () => {
    const { ENDING } = await import("/src/content/acts.ts");
    const g = window.__game;
    const ok = (l) => !l.if || l.if.every((c) => g.check(c));
    return { title: ENDING.titles.find(ok)?.text, lines: ENDING.lines.filter(ok).map((l) => l.text) };
  })()`);
  assert.equal(card.title, "THE PURSER OF THE MARROW");
  assert.match(card.lines[0], /crow's nest/);
  assert.equal(card.lines.some((l) => /Her hand is in mine/.test(l)), true);
  assert.equal(card.lines.some((l) => /married in the spring/.test(l)), true);
  assert.equal(card.lines.some((l) => /smelled of fog/.test(l)), true);
  assert.equal(card.lines.some((l) => /customs-house window/.test(l)), false);
  assert.equal(card.lines.at(-1), "ARCADIA: returned. All hands.");
  // The ending keeps the save (Continue goes back to choose again) and unlocks Chapter select.
  assert.notEqual(await evaluate("localStorage.getItem('brasscompass.save.v3')"), null);
  assert.equal(await evaluate("localStorage.getItem('brasscompass.completed')"), "1");
  await shot("test-ending.png");
  await key("Enter");
  assert.equal(await evaluate("window.__game.title"), true);
  // New Voyage over a save asks first; Escape keeps the save.
  const savedBefore = await evaluate("localStorage.getItem('brasscompass.save.v3')");
  const startButton = await evaluate("window.__game.titleButtons().find((b) => b.id === 'start')");
  await click(960, startButton.y + 29);
  assert.equal(await evaluate("window.__game.confirmNew"), true);
  assert.equal(await evaluate("window.__game.title && !window.__game.cinematic.active"), true);
  assert.equal(await evaluate("window.__game.titleButtons()[0].label"), "Yes — start anew");
  await shot("test-title-confirm.png");
  await key("Escape");
  assert.equal(await evaluate("window.__game.confirmNew || window.__game.paused"), false);
  assert.equal(await evaluate("localStorage.getItem('brasscompass.save.v3')"), savedBefore);
  // Choosing it twice does start anew (the intro plays); back to the title for Chapter select.
  await click(960, startButton.y + 29);
  await click(960, startButton.y + 29);
  assert.equal(await evaluate("window.__game.cinematic.active"), true);
  await evaluate("(() => { const g = window.__game; g.cinematic.skip(); g.title = true; })()");
  // Chapter select from the title: every room reachable from a menu, and nothing saved.
  await shot("test-title-explore.png");
  const saveBeforeExplore = await evaluate("localStorage.getItem('brasscompass.save.v3')");
  const exploreButton = await evaluate("window.__game.titleButtons().find((b) => b.id === 'explore')");
  await click(960, exploreButton.y + 29);
  assert.equal(await evaluate("window.__game.explore && window.__game.roomMenu"), true);
  await shot("test-explore-menu.png");
  const menu = await evaluate("window.__game.exploreRooms().map((r) => r.id)");
  assert.equal(menu.length, await evaluate("(async () => Object.keys((await import('/src/content/rooms.ts')).ROOMS).length)()"));
  const cabin = await evaluate("window.__game.roomMenuRect(window.__game.exploreRooms().findIndex((r) => r.id === 'marrow_cabin'))");
  await click(cabin.x + 40, cabin.y + 20);
  assert.equal(await evaluate("window.__game.room.id"), "marrow_cabin");
  assert.equal(await evaluate("window.__game.act"), 2);
  assert.equal(await evaluate("localStorage.getItem('brasscompass.save.v3')"), saveBeforeExplore);
  await key("r");
  assert.equal(await evaluate("window.__game.roomMenu"), true);
  await key("Escape");
  assert.equal(await evaluate("window.__game.roomMenu"), false);
  await evaluate("window.__game.explore = false; window.__game.title = true");
  // Second solutions: trade the rum and present the licence in conversation instead of Give.
  const alt = await evaluate(`(() => {
    const g = window.__game;
    g.title = false; g.newGame();
    g.narration = null; // the opening line has been read
    g.inventory = ["rum"];
    g.flags = { knows_key: true };
    g.runEffects([{ k: "talk", tree: "tavernkeeper" }]);
    const opening = g.visibleChoices().map((c) => c.text);
    g.pickChoice(1);
    const asked = g.dialogue.nodeId;
    g.pickChoice(0);
    const traded = g.inventory.includes("drawer_key") && !g.inventory.includes("rum") && g.flags.marta_paid === true;
    g.dialogue = null;
    g.runEffects([{ k: "talk", tree: "tavernkeeper" }]);
    const after = g.visibleChoices().map((c) => c.text);
    g.dialogue = null;
    g.inventory = ["licence", "manifest"];
    g.flags = { ledger_read: true };
    g.runEffects([{ k: "talk", tree: "bramwick" }]);
    g.pickChoice(0); g.pickChoice(0); // licence, then the evidence
    g.advanceDialogue(); g.advanceDialogue(); // the confession
    g.pickChoice(0);
    return { opening, asked, traded, after, act: g.act };
  })()`);
  // Regressions: a talk line stays up until read, then the conversation opens; a hotspot's
  // own "use" line plays as a hint; fallback lines name people and things properly.
  const fixes = await evaluate(`(() => {
    const g = window.__game;
    for (let i = 0; i < 4 && g.cinematic.active; i++) g.cinematic.skip();
    g.title = false; g.newGame(); g.narration = null;
    const hintStart = g.itemLook("compass");
    g.inventory.push("rum");
    const hintRum = g.itemLook("compass");
    g.inventory = ["compass"];
    g.speak("Marta looks up.");
    g.runEffects([{ k: "talk", tree: "tavernkeeper" }]);
    const waited = g.dialogue === null && g.queue !== null;
    window.__ff(200);
    const opened = g.dialogue?.tree.id === "tavernkeeper";
    g.dialogue = null;
    g.loadRoom("chandlery");
    g.setVerb("use");
    g.onHotspotClick(g.room.hotspots.find((h) => h.id === "counter"));
    const hint = g.narration?.text ?? "";
    const pending = g.sentence.a?.id;
    g.clearSentence();
    g.loadRoom("tavern");
    const marta = g.room.hotspots.find((h) => h.id === "marta");
    const carry = g.hotspotTarget(marta);
    // Easy play: hovering Marta lights up "Talk to"; a plain click on her starts the conversation.
    g.hoverHotspot = "marta";
    const suggest = g.panelModel().suggestVerb;
    const suggestLine = g.panelModel().suggestLine;
    g.hoverHotspot = null;
    g.narration = null;
    const r = marta.area.rect;
    g.cameraX = Math.max(0, Math.min(640, r.x - 900)); g.focusCameraX = r.x + r.w / 2;
    g.onClick(r.x + r.w / 2 - g.cameraX, r.y + r.h / 2, 0);
    window.__ff(400);
    const quick = g.dialogue?.tree.id;
    g.dialogue = null;
    const tip = g.currentTip();
    return { waited, opened, hint, pending, person: carry.person, hintStart, hintRum, suggest, suggestLine, quick, tip };
  })()`);
  assert.equal(fixes.waited, true);
  assert.equal(fixes.opened, true);
  assert.match(fixes.hint, /stamp/i);
  assert.equal(fixes.pending, "counter");
  assert.equal(fixes.person, true);
  assert.match(fixes.hintStart, /customs house/);
  assert.match(fixes.hintRum, /tavern/);
  assert.equal(fixes.suggest, "talk");
  assert.equal(fixes.suggestLine, "Talk to Marta");
  assert.equal(fixes.quick, "tavernkeeper");
  assert.match(fixes.tip, /Bramwick/);
  assert.deepEqual(alt.opening, ["What's everyone celebrating?", "Bramwick says you have his drawer key.", "Nothing. Goodnight."]);
  assert.equal(alt.asked, "key");
  assert.equal(alt.traded, true);
  assert.equal(alt.after.includes("Thanks again for the key."), true);
  assert.equal(alt.after.includes("I need a favour."), false);
  assert.equal(alt.act, 2);
  // The desk ending, scripted: the card's title and lines follow the choice and the voyage.
  const desk = await evaluate(`(async () => {
    const { ENDING } = await import("/src/content/acts.ts");
    const g = window.__game;
    for (let i = 0; i < 4 && g.cinematic.active; i++) g.cinematic.skip();
    window.__act(4);
    g.narration = null; g.dialogue = null; g.queue = null;
    g.flags = { farewell: true, inquiry_done: true, quarantine_lifted: true, ledger_written: true, night_watch: true, aff: 3 };
    g.loadRoom("dock");
    g.runEffects([{ k: "talk", tree: "quill4", node: "dawn" }]);
    g.advanceDialogue(); g.advanceDialogue(); // sea, then tide
    const offered = g.visibleChoices().map((c) => c.text);
    g.pickChoice(offered.findIndex((t) => /keep the ledger honest/.test(t)));
    g.advanceDialogue();
    const kiss = g.visibleChoices().some((c) => c.text === "(Kiss her.)");
    g.pickChoice(0); // "I'll underline it."
    g.pickChoice(0); // (Watch her go.)
    for (let i = 0; i < 4 && g.cinematic.active; i++) g.cinematic.skip();
    const ok = (l) => !l.if || l.if.every((c) => g.check(c));
    return { offered, kiss, won: g.won, title: ENDING.titles.find(ok)?.text, lines: ENDING.lines.filter(ok).map((l) => l.text) };
  })()`);
  assert.equal(desk.offered.some((t) => /^Sign me on/.test(t)), true);
  assert.equal(desk.offered.some((t) => /keep the ledger honest/.test(t)), true);
  assert.equal(desk.kiss, false); // not enough affection for the kiss
  assert.equal(desk.won, true);
  assert.equal(desk.title, "THE HONEST LEDGER");
  assert.match(desk.lines[0], /customs-house window/);
  assert.equal(desk.lines.some((l) => /still calls me cargo/.test(l)), true);
  assert.equal(desk.lines.some((l) => /crow's nest|Her hand is in mine/.test(l)), false);
  assert.equal(desk.lines.some((l) => /still playing for it/.test(l)), true); // no wager
  assert.equal(desk.lines.some((l) => /smelled of fog/.test(l)), false); // no kelp at the inquiry
  assert.equal(desk.lines.at(-1), "ARCADIA: returned. All hands.");
  // Who is where: the Act I rooms in Act I have none of tonight's people, and vice versa.
  const cast = await evaluate(`(() => {
    const g = window.__game;
    g.won = false;
    const seen = (act) => {
      window.__act(act);
      g.narration = null; g.dialogue = null; g.queue = null;
      const out = {};
      for (const id of ["dock", "office", "tavern", "alley", "chandlery", "warehouse"]) {
        g.loadRoom(id);
        out[id] = g.visibleHotspots().map((h) => h.id);
      }
      return out;
    };
    return { one: seen(1), four: seen(4) };
  })()`);
  const actFour = ["quill_rail", "ansel_rail", "boom", "pier_way", "steps_shut", "quill_pier", "cray", "card", "chair",
    "bramwick_t", "ansel_t", "cray_t", "dorrit_t", "counting_door", "chain"];
  const actOne = ["crate", "crowbar", "village_steps", "bramwick", "licence", "iou", "silas"];
  for (const ids of Object.values(cast.one)) for (const id of actFour) assert.equal(ids.includes(id), false, "act I shows " + id);
  for (const ids of Object.values(cast.four)) for (const id of actOne) assert.equal(ids.includes(id), false, "act IV shows " + id);
  for (const id of ["quill_rail", "ansel_rail", "pier_way"]) assert.equal(cast.four.dock.includes(id), true, id);
  assert.equal(cast.four.office.includes("cray"), true);
  assert.equal(cast.four.tavern.includes("bramwick_t"), true);
  assert.equal(cast.four.alley.includes("counting_door"), true);
  assert.equal(cast.one.dock.includes("crowbar"), true);
  assert.equal(cast.one.alley.includes("silas"), true);
  // Casebook: an entry is filed once, attributed to the act it was earned in, survives a save,
  // and opens as a real overlay.
  const casebook = await evaluate(`(() => {
    const g = window.__game;
    g.title = false; g.cinematic.skip(); g.setPaused(false);
    g.act = 3;
    g.notes = [];
    g.runEffects([{ k: "note", id: "test_note", text: "A test entry." }]);
    g.runEffects([{ k: "note", id: "test_note", text: "A test entry." }]);
    const deduped = g.notes.length === 1;
    const act = g.notes[0]?.act;
    g.persist();
    const saved = JSON.parse(localStorage.getItem("brasscompass.save.v3") ?? "{}").notes?.length;
    g.casebook.show(g.notes);
    const el = document.querySelector(".casebook");
    const opened = el && el.hidden === false;
    const rendered = el.querySelectorAll(".casebook-entry").length;
    g.casebook.hide();
    return { deduped, act, saved, opened, rendered, closed: el.hidden === true };
  })()`);
  assert.equal(casebook.deduped, true);
  assert.equal(casebook.act, 3);
  assert.equal(casebook.saved, 1);
  assert.equal(casebook.opened, true);
  assert.equal(casebook.rendered, 1);
  assert.equal(casebook.closed, true);

  assert.deepEqual(runtimeErrors, []);
  console.log("casebook, Act I (both routes, IOU, wager), all of Act II (both branches, night watch, fog run), all of Act III (the bill in any order, the halyard, Form 9, the reunion, the signal), all of Act IV (the farewell, Cray, the purse, the requisition, the ledger, the kelp, the inquiry with a wrong answer, the stamp, the IOU, the ledger entry, the pirate ending; the desk ending scripted; who appears in which act), placement, movement, camera, cinematics, keyboard, dialogue, and save/load passed");
} finally {
  socket?.close();
  for (const child of [browser, server]) {
    if (!child || child.exitCode !== null || child.signalCode !== null) continue;
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await Promise.race([exited, pause(2000)]);
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

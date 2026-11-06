/**
 * The Adventure Editor, end to end in headless Chrome: F2, the script tab (errors, Apply,
 * hot-swap without losing state), keyboard isolation, Alt+click, the save endpoint's guard,
 * the State, Log and Map panels, and dragging a stand point on the overlay. Screenshots of
 * each panel land in test-output/screens/editor-*.png (ignored by git).
 *
 *   node tools/editor-test.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const outDir = resolve("test-output/screens");
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch {}
    await pause(100);
  }
  throw new Error("Timed out waiting for " + label);
}

await mkdir(outDir, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "brass-compass-editor-"));
let server, browser, socket, port = 0;
try {
  for (let p = 5220; p < 5240 && !port; p++) {
    const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(p), "--strictPort"], { stdio: "ignore" });
    try { await until(async () => (await fetch(`http://127.0.0.1:${p}/`)).ok, "Vite"); port = p; server = child; }
    catch { child.kill(); }
  }
  if (!port) throw new Error("Could not start Vite");
  const base = `http://127.0.0.1:${port}`;
  browser = spawn(process.env.CHROME_BIN || "google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-allow-origins=*",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1920,1080", "about:blank",
  ], { stdio: "ignore" });
  const debugPort = await until(async () => Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]), "Chrome");
  const target = await until(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === "page"), "page");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  let seq = 0; const pending = new Map(); const errors = [];
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    const job = m.id && pending.get(m.id);
    if (job) { pending.delete(m.id); m.error ? job.reject(new Error(m.error.message)) : job.resolve(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { resolve: res, reject: rej }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (name) => {
    await pause(250);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(outDir, name), Buffer.from(data, "base64"));
    console.log("  " + join("test-output/screens", name));
  };
  const key = async (k, extra = {}) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, ...extra });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, ...extra });
  };
  const mouse = async (type, x, y, modifiers = 0) =>
    send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseMoved" ? 1 : 0, clickCount: 1, modifiers });
  /** Client coordinates of a scene point (world x, scene y). */
  const client = (x, y) => evaluate(`(() => { const r = document.getElementById("game").getBoundingClientRect(), g = window.__game;
    return { x: r.left + (${x} - g.cameraX) * r.width / 1920, y: r.top + ${y} * r.height / 1080 }; })()`);
  const ff = (n = 120) => evaluate(`window.__ff(${n})`);

  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base + "/" });
  await until(() => evaluate("Boolean(window.__game && window.__editor) && !document.getElementById('boot')"), "game and editor");

  // ---- F2 opens the panel and narrows the stage
  await evaluate("window.__game.devAct(1)");
  await ff(400);
  await evaluate("(() => { const g = window.__game; g.narration = null; g.queue = null; })()");
  const wide = await evaluate("document.getElementById('game').getBoundingClientRect().width");
  await key("F2", { code: "F2", windowsVirtualKeyCode: 113 });
  assert.equal(await evaluate("document.getElementById('adv').classList.contains('open')"), true, "F2 opens the editor");
  const narrow = await evaluate("document.getElementById('game').getBoundingClientRect().width");
  assert.ok(narrow < wide, "the game shrinks beside the panel");

  // ---- Script tab
  await evaluate(`window.__editor.tab("script"); window.__editor.select("rooms/tavern.adv")`);
  await shot("editor-script.png");

  // Keys typed in the editor don't reach the game: H would show a tip.
  await evaluate("document.querySelector('#adv textarea').focus(); document.querySelector('#adv textarea').setSelectionRange(0, 0)");
  await key("h", { text: "h", code: "KeyH", windowsVirtualKeyCode: 72 });
  await ff(5);
  assert.equal(await evaluate("window.__game.narration"), null, "the game ignores keys typed into the editor");
  assert.ok((await evaluate("document.querySelector('#adv textarea').value")).startsWith("hroom tavern"), "the key went to the editor");

  // A typo is reported at its line and blocks Apply.
  await evaluate(`(() => { const ta = document.querySelector("#adv textarea");
    ta.value = ta.value.replace(/^hroom/, "room").replace("    look \\"Marta, who", "    lok \\"Marta, who"); ta.dispatchEvent(new Event("input")); })()`);
  await pause(500);
  const errs = await evaluate("[...document.querySelectorAll('.adv-errors .err')].map((e) => e.textContent)");
  assert.ok(errs.some((e) => /^rooms\/tavern\.adv:\d+:5: 'lok' doesn't belong in a hotspot/.test(e)), errs.join("\n"));
  assert.equal(await evaluate("window.__editor.apply()"), false, "a script with errors doesn't apply");
  await shot("editor-errors.png");

  // Apply hot-swaps new content without touching the game state.
  await evaluate(`(() => { const ta = document.querySelector("#adv textarea");
    ta.value = ta.value.replace("    lok \\"Marta, who", "    look \\"EDITED. Marta, who"); ta.dispatchEvent(new Event("input")); })()`);
  await evaluate("window.__game.devGoRoom('tavern'); window.__game.devGive('rum'); window.__game.devSetFlag('knows_key', true)");
  const before = await evaluate("JSON.stringify((({ room, inventory, flags, act }) => ({ room, inventory, flags, act }))(window.__game.devState()))");
  assert.equal(await evaluate("window.__editor.apply()"), true);
  const after = await evaluate("JSON.stringify((({ room, inventory, flags, act }) => ({ room, inventory, flags, act }))(window.__game.devState()))");
  assert.equal(after, before, "Apply keeps the game state");
  assert.ok(await evaluate(`(async () => { const { ROOMS } = await import("/src/content/rooms.ts");
    return ROOMS.tavern.hotspots.find((h) => h.id === "marta").say.look.startsWith("EDITED.") && window.__game.room === ROOMS.tavern; })()`), "the new content is live");
  await evaluate(`(() => { const ta = document.querySelector("#adv textarea");
    ta.value = ta.value.replace("EDITED. ", ""); ta.dispatchEvent(new Event("input")); window.__editor.apply(); })()`);
  assert.equal(await evaluate("(() => { const b = window.__editor.buffers.get('rooms/tavern.adv'); return b.text === b.saved; })()"), true);

  // ---- The save endpoint writes scripts only
  const post = (body) => fetch(base + "/__adv/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  for (const path of ["../rooms.ts", "rooms/../../rooms.ts", "/etc/passwd", "rooms/dock.ts", "rooms\\dock.adv", "nofolder/x.adv"]) {
    assert.equal((await post({ path, text: "x" })).status, 403, `save refuses ${path}`);
  }
  // The endpoint only writes into existing script folders, so a throwaway file would land in
  // src/ and be picked up by the editor and HMR. Rewrite dock.adv with its own text instead, and
  // put the original bytes back if anything differs afterwards.
  const dockPath = "src/content/scripts/rooms/dock.adv";
  const dockBytes = await readFile(dockPath);
  const dock = dockBytes.toString("utf8");
  try {
    assert.equal((await post({ path: "rooms/dock.adv", text: dock })).status, 200, "save writes a script");
    assert.ok((await readFile(dockPath)).equals(dockBytes), "save writes the text byte for byte");
  } finally {
    if (!(await readFile(dockPath)).equals(dockBytes)) await writeFile(dockPath, dockBytes);
  }
  assert.equal((await fetch(base + "/__adv/files")).ok, true);

  // ---- Alt+click a hotspot opens its script line
  await evaluate("window.__game.devGoRoom('tavern'); window.__game.cameraX = 640");
  await ff(2);
  await evaluate("window.__game.cameraX = 640; window.__game.focusCameraX = 640 + 960");
  const marta = await client(1960, 520);
  await mouse("mousePressed", marta.x, marta.y, 1);
  await mouse("mouseReleased", marta.x, marta.y, 1);
  await pause(100);
  const opened = await evaluate(`(() => { const ta = document.querySelector("#adv textarea");
    const line = ta.value.slice(0, ta.selectionStart).split("\\n").length;
    return { file: document.querySelector(".adv-file").textContent, line: ta.value.split("\\n")[line - 1] }; })()`);
  assert.equal(opened.file.trim(), "rooms/tavern.adv");
  assert.match(opened.line, /^ {2}hotspot marta "Marta"/);

  // ---- Log: a few things happen
  await evaluate("document.getElementById('game').focus()");
  await evaluate(`(() => { const g = window.__game;
    g.sentence = { verb: "look", a: { kind: "hotspot", id: "marta", name: "Marta" }, b: null }; g.execute(); })()`);
  await ff(200);
  await evaluate(`window.__game.runCombo("give", "rum", { kind: "hotspot", id: "marta", name: "Marta" })`);
  await ff(300);
  await evaluate(`window.__game.runEffects([{ k: "talk", tree: "tavernkeeper" }])`);
  await ff(60);
  await evaluate("window.__editor.tab('log')");
  await pause(200);
  const log = await evaluate("document.querySelector('.adv-log').textContent");
  assert.match(log, /Look at Marta/);
  assert.match(log, /give drawer_key/);
  assert.match(log, /tavernkeeper\.root/);
  await shot("editor-log.png");

  // ---- State
  await evaluate("window.__editor.tab('state')");
  await pause(500);
  const stateText = await evaluate("document.querySelector('[data-panel=state]').textContent");
  assert.match(stateText, /tavernkeeper · root/);
  assert.match(stateText, /drawer_key/);
  await shot("editor-state.png");
  await evaluate("document.querySelector('[data-toggle=marta_paid]').click()");
  assert.equal(await evaluate("window.__game.devState().flags.marta_paid"), false, "clicking a flag toggles it");
  await evaluate("window.__game.devSetFlag('marta_paid', true)");

  // ---- Map
  await evaluate("window.__game.dialogue = null; window.__editor.tab('map')");
  await pause(300);
  const nodes = await evaluate("document.querySelectorAll('.adv-map .node').length");
  assert.ok(nodes > 40, `the act I map has nodes (${nodes})`);
  assert.ok(await evaluate("Boolean(document.querySelector('.adv-map [data-key=\"item:rum\"]'))"));
  assert.match(await evaluate("document.querySelector('.adv-issues').textContent"), /^No problems/, "the puzzle map finds no problems in the shipped content");
  await shot("editor-map.png");
  await evaluate(`document.querySelector('.adv-map [data-key="item:drawer_key"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
  assert.equal((await evaluate("document.querySelector('.adv-file').textContent")).trim().length > 0, true);
  await evaluate("window.__editor.tab('map'); document.querySelector('.adv-mapacts [data-act=\"3\"]').click()");
  await pause(300);
  await shot("editor-map-act3.png");

  // ---- Overlay: drag the crate's stand point on the dock
  await evaluate("window.__game.devGoRoom('dock')");
  await ff(10);
  await evaluate("window.__editor.tab('overlay'); document.querySelector('.adv-ov').click()");
  assert.equal(await evaluate("window.__game.devOverlay()"), true);
  await evaluate("window.__game.cameraX = 300; window.__game.focusCameraX = 300 + 960");
  const from = await client(1110, 840), to = await client(1150, 820);
  await mouse("mouseMoved", from.x, from.y);
  await mouse("mousePressed", from.x, from.y);
  for (let i = 1; i <= 5; i++) await mouse("mouseMoved", from.x + (to.x - from.x) * i / 5, from.y + (to.y - from.y) * i / 5);
  await mouse("mouseReleased", to.x, to.y);
  const crate = await evaluate(`(async () => { const { ROOMS } = await import("/src/content/rooms.ts");
    return ROOMS.dock.hotspots.find((h) => h.id === "crate").stand; })()`);
  assert.deepEqual(crate, { x: 1150, y: 820 }, "the drag moves the live stand point");
  const dockBuf = await evaluate("window.__editor.buffers.get('rooms/dock.adv').text");
  assert.match(dockBuf, /hotspot crate "stacked crate"\n(?:.*\n){2}    stand 1150,820\n/, "the drag rewrites the script line");
  await evaluate("window.__game.devHandle = { x: 1150, y: 820 }; window.__game.render()");
  await shot("editor-overlay.png");
  // Put it back without saving.
  await evaluate(`(() => { window.__editor.select("rooms/dock.adv"); document.querySelector(".adv-revert").click(); window.__editor.apply(); })()`);
  assert.equal(await readFile("src/content/scripts/rooms/dock.adv", "utf8"), dock, "nothing was saved");

  // ---- F2 closes it; the stage is whole again
  await evaluate("document.getElementById('game').focus()");
  await key("F2", { code: "F2", windowsVirtualKeyCode: 113 });
  assert.equal(await evaluate("document.getElementById('adv').classList.contains('open')"), false);
  assert.equal(await evaluate("document.getElementById('game').getBoundingClientRect().width"), wide);
  assert.deepEqual(errors, [], "no runtime errors");
  console.log("Adventure Editor: F2, errors, Apply with state kept, key isolation, Alt+click, save guard, log, state, map and overlay drag passed");
} finally {
  socket?.close();
  for (const c of [browser, server]) if (c && c.exitCode === null) c.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

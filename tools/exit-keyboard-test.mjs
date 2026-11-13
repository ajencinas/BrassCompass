/**
 * Every way out, taken by keyboard.
 *
 * The mouse has a gate of its own (tools/exit-walk-test.mjs: click the arrow, Fenn walks and
 * goes through). This is the same promise through the keyboard: Tab into the scene, walk the
 * focus to the way out, press Enter, and Fenn must walk to it and go through.
 *
 *   node tools/exit-keyboard-test.mjs            # human report, exit code 1 on a failure
 *   node tools/exit-keyboard-test.mjs --json     # machine report
 *   node tools/exit-keyboard-test.mjs --room dock
 *
 * Real key events (CDP Input.dispatchKeyEvent), not a call into the game: the keyboard route
 * has its own traps - a focus that never lands on the exit, a Tab the browser swallows, an
 * Enter that the sentence line takes instead - and only a real key press finds them.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { startVite, startChrome, firstPage, ROOT } from "./browser-env.mjs";

const json = process.argv.includes("--json");
const onlyArg = process.argv.indexOf("--room");
const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : null;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* not yet */ }
    await pause(100);
  }
  throw new Error("Timed out waiting for " + label);
}

const failures = [];
const rows = [];
let server, browser, socket;
try {
  server = await startVite(5200, 5219);
  browser = await startChrome({ name: "exitkeys", args: ["--window-size=1280,800"] });
  const target = await firstPage(browser);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  let seq = 0; const pending = new Map();
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data); const job = m.id && pending.get(m.id);
    if (job) { pending.delete(m.id); m.error ? job.reject(new Error(m.error.message)) : job.resolve(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { resolve: res, reject: rej }); socket.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  // A real key press carries its text for Enter: without it the CDP key event drives the
  // game's window handler but does not activate a focused DOM control.
  const KEY = {
    Tab: { vk: 9, code: "Tab" }, Enter: { vk: 13, code: "Enter" },
    ArrowLeft: { vk: 37, code: "ArrowLeft" }, ArrowRight: { vk: 39, code: "ArrowRight" },
  };
  const key = async (name) => {
    const info = KEY[name];
    const text = name === "Enter" ? "\r" : undefined;
    const base = {
      key: name, code: info.code, windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk,
      ...(text === undefined ? {} : { text, unmodifiedText: text }),
    };
    await send("Input.dispatchKeyEvent", { type: "keyDown", ...base });
    await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await pause(25);
  };
  const TAB = "Tab";
  const RIGHT = "ArrowRight";
  const LEFT = "ArrowLeft";
  const ENTER = "Enter";

  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/?nomobile=1` });
  await until(() => ev("Boolean(window.__game) && !document.getElementById('boot')"), "game");
  await ev("window.__act(1);");
  await until(() => ev("typeof window.__prefetchAll === 'function'"), "prefetch");
  await ev("window.__prefetchAll()");
  await until(() => ev("window.__game.assets.queue.length === 0 && window.__game.assets.running === 0"), "art", 120000);
  await pause(200);

  const rooms = only
    ? [only]
    : readdirSync(join(ROOT, "src/content/scripts/rooms"))
        .filter((f) => f.endsWith(".adv"))
        .map((f) => f.slice(0, -4))
        .sort();

  for (const roomId of rooms) {
    const exits = await ev(`(() => {
      const g = window.__game;
      g.loadRoom(${JSON.stringify(roomId)});
      g.narration = null; g.queue = null; g.dialogue = null;
      window.__ff(30);
      g.narration = null; g.queue = null; g.dialogue = null;
      return g.visibleHotspots().filter((h) => (g.hotspotState(h).do?.walk ?? []).some((e) => e.k === "go"))
        .map((h) => {
          const go = g.hotspotState(h).do.walk.find((e) => e.k === "go");
          return { id: h.id, to: go.room };
        });
    })()`);
    if (!exits.length) continue;

    for (const exit of exits) {
      // Fresh room, the canvas focused, nothing said.
      await ev(`(() => {
        const g = window.__game;
        g.loadRoom(${JSON.stringify(roomId)});
        g.narration = null; g.queue = null; g.dialogue = null; g.sentence = { verb: null, a: null, b: null };
        g.title = false; g.fade = 0; g.fadeTarget = 0;
        window.__ff(30);
        g.narration = null; g.queue = null; g.dialogue = null;
        g.keyboardFocus = null; g.focusMemory = {};
        document.getElementById("game").focus();
        return null;
      })()`);

      // Tab into the scene, then walk the focus to the way out.
      await key(TAB);
      let focused = await ev("window.__game.keyboardFocus ? window.__game.keyboardFocus.id : null");
      if (focused !== exit.id) {
        // Walk the scene group with the arrow keys.
        for (let i = 0; i < 40; i++) {
          focused = await ev("window.__game.keyboardFocus ? window.__game.keyboardFocus.id : null");
          if (focused === exit.id) break;
          await key(RIGHT);
        }
      }
      if (focused !== exit.id) {
        // It may be to the LEFT of where the focus started.
        for (let i = 0; i < 40; i++) {
          focused = await ev("window.__game.keyboardFocus ? window.__game.keyboardFocus.id : null");
          if (focused === exit.id) break;
          await key(LEFT);
        }
      }
      if (focused !== exit.id) {
        failures.push(`${roomId}.${exit.id}: the keyboard focus never reached the way out`);
        rows.push({ room: roomId, exit: exit.id, ok: false, why: "focus never reached it" });
        continue;
      }

      const said = await ev("window.__sr?.textContent ?? document.querySelector('[aria-live]')?.textContent ?? ''");
      const shot = await ev(`(() => {
        const g = window.__game;
        const before = g.room.id;
        return { before, focus: g.keyboardFocus?.id ?? null, verb: g.sentence.verb };
      })()`);
      await key(ENTER);
      const after = await ev(`(() => {
        const g = window.__game;
        const from = ${JSON.stringify(roomId)};
        let frames = 0;
        while (g.room.id === from && frames < 900) { window.__ff(1); frames++; }
        return { room: g.room.id, frames, verb: g.sentence.verb,
          said: document.querySelector('[aria-live]')?.textContent ?? '' };
      })()`);

      if (after.room !== exit.to) {
        failures.push(`${roomId}.${exit.id}: Enter ended in ${after.room}, expected ${exit.to}`);
        rows.push({ room: roomId, exit: exit.id, ok: false, why: `ended in ${after.room}, expected ${exit.to}` });
      } else {
        rows.push({ room: roomId, exit: exit.id, ok: true, frames: after.frames, said: (said ?? "").slice(0, 40) });
      }
      void shot;
    }
  }
} finally {
  socket?.close();
  await browser?.stop();
  await server?.stop();
}

if (json) {
  console.log(JSON.stringify({ failures, rows }, null, 2));
} else {
  for (const row of rows) {
    if (!row.ok) console.log(`FAIL ${row.room}.${row.exit} — ${row.why}`);
    else console.log(`ok   ${row.room}.${row.exit} (${row.frames} frames)${row.said ? ` — "${row.said}"` : ""}`);
  }
  console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} ways out taken by keyboard.`);
}
process.exit(failures.length ? 1 : 0);

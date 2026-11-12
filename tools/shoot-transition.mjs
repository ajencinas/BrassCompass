/**
 * Passage contact sheets: put Fenn at a room's way out, take it, and capture every 50 ms of the
 * curtain so the cut between two paintings can be looked at instead of argued about.
 *
 *   node tools/shoot-transition.mjs <room> <hotspot> [--act N] [--flags a,b] [--out DIR]
 *                                   [--steps N] [--every N] [--debug] [--click door|chevron]
 *
 * Frames land as PNGs and one `index.jpg` strip (every 2nd frame by default) for a quick read.
 * The clock is frozen first (`__ff` steps the game 50 ms at a time, rAF is parked), so a sheet
 * is reproducible: the same room and exit always give the same frames.
 */
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { startVite, startChrome, firstPage } from "./browser-env.mjs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const has = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const act = Number(flag("--act") ?? 0);
const flags = (flag("--flags") ?? "").split(",").filter(Boolean);
const steps = Number(flag("--steps") ?? 60);
const every = Number(flag("--every") ?? 2);
const clickMode = flag("--click") ?? "chevron";
const debug = has("--debug");
const outDir = resolve(flag("--out") ?? "reference/screens/passage");
const [roomId, exitId] = args;
if (!roomId || !exitId) {
  console.error("usage: node tools/shoot-transition.mjs <room> <hotspot> [--act N] [--flags a,b] [--out DIR]");
  process.exit(1);
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* not yet */ }
    await pause(100);
  }
  throw new Error("Timed out waiting for " + label);
}

await mkdir(outDir, { recursive: true });
const tag = `${roomId}-${exitId.replace(/\W+/g, "_")}`;
for (const f of await import("node:fs/promises").then((m) => m.readdir(outDir))) {
  if (f.startsWith(tag + "-")) await rm(join(outDir, f), { force: true });
}

let server, browser, socket;
try {
  server = await startVite(5200, 5219);
  const port = server.port;
  browser = await startChrome({ name: "passage", args: ["--window-size=1920,1080"] });
  const target = await firstPage(browser);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  let seq = 0; const pending = new Map();
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data); const job = m.id && pending.get(m.id);
    if (job) { pending.delete(m.id); m.error ? job.reject(new Error(m.error.message)) : job.resolve(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { resolve: res, reject: rej }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (file) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(file, Buffer.from(data, "base64"));
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/${debug ? "?debug" : ""}` });
  await until(() => evaluate("Boolean(window.__game) && !document.getElementById('boot')"), "game");

  // The room, the art, and Fenn standing a short walk short of the way out.
  const plan = await evaluate(`(() => {
    const g = window.__game;
    ${act ? `window.__act(${act});` : "g.title = false; g.newGame();"}
    for (const f of ${JSON.stringify(flags)}) g.flags[f] = true;
    g.loadRoom(${JSON.stringify(roomId)});
    g.narration = null; g.dialogue = null; g.queue = null;
    window.__ff(40);
    return null;
  })()`);
  await until(() => evaluate("window.__game.roomReady() && window.__game.fade < 0.02"), "room curtain");
  await until(() => evaluate("window.__game.assets.queue.length === 0 && window.__game.assets.running === 0"), "art");

  const setup = await evaluate(`(() => {
    const g = window.__game;
    const hs = g.room.hotspots.find((h) => h.id === ${JSON.stringify(exitId)});
    if (!hs) return { error: "no such hotspot" };
    const st = g.hotspotState(hs);
    if (!st.do?.walk?.length) return { error: "not a way out" };
    const stand = st.stand ?? g.areaStand(st.area);
    // Stand a couple of hundred pixels back toward the middle of the floor, so the click has a
    // walk to make before the door.
    const pts = g.room.walk.flat();
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dx = cx - stand.x, dy = cy - stand.y, len = Math.hypot(dx, dy) || 1;
    const reach = Math.min(240, len * 0.7);
    const start = { x: stand.x + (dx / len) * reach, y: stand.y + (dy / len) * reach };
    // Snap to the nearest walk vertex's y so the feet sit on the floor plane.
    let near = pts[0];
    for (const p of pts) if (Math.hypot(p.x - start.x, p.y - start.y) < Math.hypot(near.x - start.x, near.y - start.y)) near = p;
    if (Math.abs(near.x - start.x) < 260) start.y = near.y;
    g.x = start.x; g.y = start.y; g.path = []; g.walkGoal = null; g.onArrive = null;
    const max = Math.max(0, (g.room.width ?? 1920) - 1920);
    g.cameraX = Math.max(0, Math.min(max, g.x - 960)); g.focusCameraX = null;
    g.narration = null; g.queue = null; g.dialogue = null;
    g.sentence = { verb: null, a: null, b: null };
    window.__ff(6);
    // A fresh room can queue its own arrival lines: a click would finish those instead of
    // taking the exit, so the slate is cleared after they have run.
    g.narration = null; g.queue = null; g.dialogue = null;
    g.render();
    const chev = g.exitChevrons().find((c) => c.hs === hs || c.id === hs.id ||
      Math.hypot(c.x - (g.exitThreshold(st).x), c.y - (g.exitThreshold(st).y)) < 200);
    return { room: g.room.id, start, stand, chev: chev ? { x: chev.x, y: chev.y } : null,
      threshold: g.exitThreshold(st), fade: g.fade };
  })()`);
  if (setup.error) throw new Error(`${roomId}.${exitId}: ${setup.error}`);
  if (clickMode === "chevron" && !setup.chev) throw new Error(`${roomId}.${exitId}: no chevron on screen`);
  console.log(JSON.stringify(setup));

  // Park rAF and take the way out exactly as a player would: one click.
  await evaluate("window.requestAnimationFrame = () => 0;");
  await pause(250);
  const hit = clickMode === "chevron" ? setup.chev : setup.threshold;
  const clicked = await evaluate(`(() => {
    const g = window.__game;
    g.narration = null; g.queue = null; g.dialogue = null;
    const before = { room: g.room.id, x: g.x, y: g.y, fade: g.fade };
    g.onClick(${hit.x} - g.cameraX, ${hit.y}, 0, 1);
    return { before, path: g.path.length, goal: g.walkGoal, arrived: Boolean(g.onArrive) };
  })()`);
  console.log("click →", JSON.stringify(clicked));

  const frames = [];
  for (let i = 0; i < steps; i++) {
    await evaluate("window.__game.render()");
    if (i % every === 0 || i === steps - 1) {
      const file = join(outDir, `${tag}-${String(i).padStart(2, "0")}.png`);
      await shot(file);
      frames.push(file);
    }
    const moving = await evaluate(`(() => { const g = window.__game;
      return { room: g.room.id, fade: g.fade, curtain: Boolean(g.curtain), passage: Boolean(g.pendingPassage),
        x: Math.round(g.x), y: Math.round(g.y), path: g.path.length }; })()`);
    if (i % 5 === 0) console.log(String(i).padStart(2, "0"), JSON.stringify(moving));
    await evaluate("window.__ff(1)");
    // Stop a few frames after the new room has settled, or on a blank tail.
    if (moving.room !== roomId && moving.fade < 0.01 && i > 6) break;
  }

  // One strip of every 2nd frame, top to bottom, for a single look.
  if (frames.length) {
    const strip = join(outDir, `${tag}-index.jpg`);
    await new Promise((res, rej) => {
      const p = spawn("montage", [
        ...frames, "-thumbnail", "470x264", "-tile", "4x", "-geometry", "+4+4",
        "-background", "#101010", "-label", "%f", "-pointsize", "13", "-fill", "#dddddd", strip,
      ], { stdio: "ignore" });
      p.on("exit", (c) => (c === 0 ? res() : rej(new Error("montage failed " + c))));
    }).catch((e) => console.error(e.message));
    console.log(strip);
  }
} finally {
  socket?.close();
  await browser?.stop();
  await server?.stop();
}

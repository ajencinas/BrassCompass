/**
 * Calibration screenshots: put Fenn at given spots in a room and capture each, with the
 * `?debug` overlay (walk areas, occluders, hotspots, horizon).
 *
 *   node tools/shoot.mjs <room> [x,y ...] [--act N] [--flags a,b] [--clean] [--out DIR]
 *
 * With no points, shoots Fenn at six spots across the walk area (back/front × left/mid/right).
 * --flags sets story flags first (for sprites that move with the story). --clean drops the overlay. Files land in DIR (default reference/screens/cal).
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const clean = args.includes("--clean") && args.splice(args.indexOf("--clean"), 1);
const act = Number(flag("--act") ?? 0);
const flags = (flag("--flags") ?? "").split(",").filter(Boolean);
const outDir = resolve(flag("--out") ?? "reference/screens/cal");
const [roomId, ...pointArgs] = args;
if (!roomId) { console.error("usage: node tools/shoot.mjs <room> [x,y ...] [--act N] [--clean]"); process.exit(1); }

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
const profile = await mkdtemp(join(tmpdir(), "brass-compass-shoot-"));
let server, browser, socket, port = 0;
try {
  for (let p = 5200; p < 5220 && !port; p++) {
    const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(p), "--strictPort"], { stdio: "ignore" });
    try { await until(async () => (await fetch(`http://127.0.0.1:${p}/`)).ok, "Vite"); port = p; server = child; }
    catch { child.kill(); }
  }
  browser = spawn(process.env.CHROME_BIN || "google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-allow-origins=*",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1920,1080", "about:blank",
  ], { stdio: "ignore" });
  const debugPort = await until(async () => Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]), "Chrome");
  const target = await until(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === "page"), "page");
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
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/${clean ? "" : "?debug"}` });
  await until(() => evaluate("Boolean(window.__game) && !document.getElementById('boot')"), "game");

  await evaluate(`(() => { const g = window.__game; ${act ? `window.__act(${act});` : "g.title = false; g.newGame();"}
    for (const f of ${JSON.stringify(flags)}) g.flags[f] = true;
    g.loadRoom(${JSON.stringify(roomId)}); g.narration = null; g.dialogue = null; g.queue = null; window.__ff(60); })()`);
  let points = pointArgs.map((s) => s.split(",").map(Number));
  if (!points.length) {
    points = await evaluate(`(() => {
      const w = window.__game.room.walk.flat();
      const xs = w.map((p) => p.x), ys = w.map((p) => p.y);
      const x0 = Math.min(...xs) + 120, x1 = Math.max(...xs) - 120, y0 = Math.min(...ys) + 15, y1 = Math.max(...ys) - 10;
      const out = [];
      for (const y of [y0, y1]) for (const x of [x0, (x0 + x1) / 2, x1]) out.push([Math.round(x), Math.round(y)]);
      return out;
    })()`);
  }
  for (const [i, [x, y]] of points.entries()) {
    const at = await evaluate(`(() => { const g = window.__game;
      g.x = ${x}; g.y = ${y}; g.path = [];
      const max = Math.max(0, (g.room.width ?? 1920) - 1920);
      g.cameraX = Math.max(0, Math.min(max, ${x} - 960)); g.focusCameraX = null;
      g.narration = null; g.render(); return [g.x, g.y, Math.round(g.personHeight(g.y))]; })()`);
    await pause(150);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const file = join(outDir, `${roomId}-${i}.png`);
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`${file}  fenn@${at[0]},${at[1]}  height ${at[2]}px`);
  }
} finally {
  socket?.close();
  for (const c of [browser, server]) if (c && c.exitCode === null) c.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

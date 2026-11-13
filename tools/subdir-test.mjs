/**
 * The built game, served from a SUBDIRECTORY, with every request watched.
 *
 * itch.io serves a game from /html/<id>/, and a GitHub Pages project from /<repo>/. A URL that
 * is root-absolute (/assets/...) works on a domain root and 404s one directory up - so the
 * built game has to resolve every asset against its own path.
 *
 * The static check in CI (grep the built index.html and CSS for root-absolute URLs) cannot see
 * this: the atlas's plates are built from a table in the JavaScript and were served from the
 * domain root, 404ing under a subdirectory, with the built HTML and CSS both clean. This test
 * loads the real page, opens the atlas, and watches the network.
 *
 *   node tools/subdir-test.mjs            # human report, exit code 1 on a failure
 *   node tools/subdir-test.mjs --json
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { startChrome, firstPage, ROOT } from "./browser-env.mjs";

const json = process.argv.includes("--json");
const SUB = "game";
const PORT = 8137;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg",
  ".json": "application/json", ".woff2": "font/woff2",
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  if (!path.startsWith(`/${SUB}/`)) {
    res.writeHead(404).end("outside the subdirectory");
    return;
  }
  let file = path.slice(`/${SUB}/`.length);
  if (!file || file.endsWith("/")) file += "index.html";
  try {
    const body = await readFile(join(resolve(ROOT, "dist"), file));
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

const bad = [];
const outside = [];
const seen = new Set();
let browser, socket;
try {
  await new Promise((ok) => server.listen(PORT, "127.0.0.1", ok));
  browser = await startChrome({ name: "subdir", args: ["--window-size=1280,800"] });
  const target = await firstPage(browser);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  let seq = 0; const pending = new Map();
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === "Network.responseReceived") {
      const r = m.params.response;
      seen.add(r.url);
      if (r.status >= 400) bad.push(`${r.status} ${r.url}`);
      // Blob and data URLs are in-memory: they are not requests against the server.
      const local = r.url.startsWith(`http://127.0.0.1:${PORT}/`);
      if (local && !r.url.startsWith(`http://127.0.0.1:${PORT}/${SUB}/`)) outside.push(r.url);
    }
    const job = m.id && pending.get(m.id);
    if (job) { pending.delete(m.id); m.error ? job.reject(new Error(m.error.message)) : job.resolve(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { resolve: res, reject: rej }); socket.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${SUB}/` });
  await pause(5000);

  // Begin the voyage: the title's BEGIN is painted on the canvas.
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 640, y: 590 });
  await pause(100);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 590, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 590, button: "left", clickCount: 1 });
  await pause(5000);

  // The opening cinematic holds the atlas shut, so skip it the way a player would.
  const skipped = await ev(`(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /skip cinematic/i.test(x.textContent ?? "")
      && x.getClientRects().length > 0);
    if (b) { b.click(); return "skipped"; }
    return "no cinematic";
  })()`);
  await pause(2500);
  // The opening lines have to be read before the atlas will open, so clear them the way a
  // player does: Enter.
  const press = async (key, code, vk) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: key === "Enter" ? "\r" : undefined });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await pause(260);
  };
  for (let i = 0; i < 12; i++) await press("Enter", "Enter", 13);
  // Open the atlas with the key the player uses (A), and pick an area: the atlas's plates are
  // DOM images built from a table in the bundle, and THAT is where a root-absolute URL hides.
  await press("a", "KeyA", 65);
  await pause(3500);
  const opened = await ev(`(() => {
    const markers = document.querySelectorAll(".atlas-marker");
    const overlay = document.querySelector(".atlas-overlay");
    return { markers: markers.length,
      overlay: overlay ? (overlay.hidden ? "hidden" : "shown") : "none",
      classes: [...document.querySelectorAll("[class*=atlas]")].slice(0, 6).map((e) => e.className) };
  })()`);
  const picked = await ev(`(() => {
    const markers = [...document.querySelectorAll(".atlas-marker")];
    const free = markers.find((m) => !/beyond the fog/i.test(m.getAttribute("aria-label") ?? "")) ?? markers[0];
    if (free) { free.click(); return free.getAttribute("aria-label") ?? "clicked"; }
    return "no area to pick";
  })()`);
  await pause(3500);

  const plates = await ev(`(() => {
    const imgs = [...document.querySelectorAll("img")].map((i) => i.getAttribute("src")).filter(Boolean);
    return { count: imgs.length, outside: imgs.filter((s) => s.startsWith("/") && !s.startsWith("/${SUB}/")) };
  })()`);

  const result = {
    skipped, opened, picked, requests: seen.size, bad, outside, plates,
    verdict: bad.length === 0 && outside.length === 0 ? "pass" : "fail",
  };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`cinematic: ${skipped}; atlas: ${JSON.stringify(opened)}; area picked: ${picked}; ${seen.size} requests`);
    console.log(`responses >= 400: ${bad.length}`);
    for (const b of bad.slice(0, 10)) console.log("  ", b);
    console.log(`requests outside /${SUB}/: ${outside.length}`);
    for (const o of outside.slice(0, 10)) console.log("  ", o);
    console.log(`area plates in the DOM: ${plates.count}${plates.outside.length ? ` (${plates.outside.length} root-absolute)` : ""}`);
    console.log(result.verdict === "pass" ? "\nsubdirectory check passed" : "\nsubdirectory check FAILED");
  }
  process.exitCode = result.verdict === "pass" ? 0 : 1;
} finally {
  socket?.close();
  await browser?.stop();
  server.close();
}

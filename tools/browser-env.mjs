/**
 * Start-up shared by the browser tests (playthrough, editor-test, shoot, fuzz): this checkout's
 * Vite dev server on a free port, and headless Chrome on a throwaway profile.
 *
 * Several checkouts (git worktrees) run these side by side, and old dev servers linger. So a
 * port that anything already answers on is skipped, never reused, and a server only counts once
 * our own Vite has said it is listening there and is still running: a fetch alone can be
 * answered by another checkout's server, and the run would silently test the wrong code.
 *
 * Whatever is started here goes when the run does, however it ends. Vite is run directly (not
 * under `npm run dev`, whose kill left Vite itself behind), a finally calls stop(), and a run
 * that is interrupted (Ctrl+C, SIGTERM, SIGHUP) or crashes (an uncaught error or rejection)
 * still kills its servers and browsers and deletes their temporary profiles on the way out.
 */

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { constants, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (child) => child.exitCode === null && child.signalCode === null;

/**
 * Signal a child, or with `group` its whole process group: Chrome's helper processes (network,
 * GPU, renderers) are its children, and can outlive it long enough to write into its profile.
 */
function signal(child, sig, group) {
  try {
    if (group) process.kill(-child.pid, sig);
    else if (alive(child)) child.kill(sig);
  } catch { /* already gone */ }
}

/** Stop a child (politely, then not), waiting briefly for it to go. */
async function stopProcess(child, { group = false } = {}) {
  if (alive(child)) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    signal(child, "SIGTERM", group);
    await Promise.race([exited, pause(3000)]);
  }
  // Anything still there: the process itself after the grace period, or helpers that outlived it.
  signal(child, "SIGKILL", group);
}

/** What is still running (and its profile folder), to clean up if the run ends abruptly. */
const running = new Set();
let hooked = false;
function track(child, { profile, group = false } = {}) {
  const entry = { child, profile, group };
  running.add(entry);
  if (!hooked) {
    hooked = true;
    // "exit" also comes after an uncaught error or rejection; a signal has to be turned into an
    // exit first, or the process just dies.
    process.on("exit", () => {
      for (const e of running) signal(e.child, "SIGKILL", e.group);
      const profiles = [...running].map((e) => e.profile).filter(Boolean);
      if (!profiles.length) return;
      // A moment for the killed processes to be gone before their folders are.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
      for (const p of profiles) {
        try { rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* best effort */ }
      }
    });
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(sig, () => process.exit(128 + constants.signals[sig]));
  }
  return entry;
}

async function until(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch { /* not yet */ }
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

/** Whether something already accepts connections on a local port. */
export function portInUse(port) {
  return new Promise((done) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => { socket.destroy(); done(true); });
    socket.once("error", () => done(false));
  });
}

/**
 * This checkout's dev server (vite.config.ts, as `npm run dev` runs it) on the first free port
 * from `first` to `last`. Returns { port, url, process, stop }.
 */
export async function startVite(first, last) {
  const bin = join(ROOT, "node_modules/vite/bin/vite.js");
  for (let port = first; port <= last; port++) {
    if (await portInUse(port)) continue;
    const child = spawn(process.execPath, [bin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
      cwd: ROOT, stdio: ["ignore", "pipe", "ignore"],
    });
    const entry = track(child);
    const stop = async () => { await stopProcess(child); running.delete(entry); };
    // Keep reading what it prints (a full pipe would stall it); remember the start of it.
    let said = "";
    child.stdout.on("data", (chunk) => { if (said.length < 20000) said += chunk; });
    const ours = () => alive(child) && said.replace(/\x1b\[[0-9;]*m/g, "").includes(`127.0.0.1:${port}/`);
    try {
      await until(async () => ours() && (await fetch(`http://127.0.0.1:${port}/`)).ok, `Vite on ${port}`);
      return { port, url: `http://127.0.0.1:${port}/`, process: child, stop };
    } catch {
      await stop();
    }
  }
  throw new Error(`Could not start Vite on any port ${first}-${last}`);
}

/**
 * Headless Chrome with remote debugging, on a throwaway profile that is deleted with it. `args`
 * add to the usual flags; `name` labels the profile folder. Returns { process, port (DevTools),
 * stop }. Chrome gets a process group of its own, so stopping it stops its helpers too.
 */
export async function startChrome({ name = "test", args = [] } = {}) {
  const profile = await mkdtemp(join(tmpdir(), `brass-compass-${name}-`));
  const child = spawn(process.env.CHROME_BIN || "google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-allow-origins=*",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, ...args, "about:blank",
  ], { stdio: "ignore", detached: true });
  const entry = track(child, { profile, group: true });
  const stop = async () => {
    await stopProcess(child, { group: true });
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
    running.delete(entry);
  };
  try {
    const port = await until(async () => Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]), "Chrome");
    return { process: child, port, stop };
  } catch (e) {
    await stop();
    throw e;
  }
}

/** The page target of a Chrome from startChrome (its first tab). */
export function firstPage(chrome) {
  return until(async () => (await (await fetch(`http://127.0.0.1:${chrome.port}/json/list`)).json())
    .find((target) => target.type === "page"), "browser page");
}

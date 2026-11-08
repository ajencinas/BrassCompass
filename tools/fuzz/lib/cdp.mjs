/**
 * Minimal Chrome DevTools Protocol client: launch headless Chrome, open pages in isolated
 * browser contexts (separate localStorage per page, so parallel tabs never share a save),
 * evaluate code, dispatch real input, and collect console errors / exceptions / failed loads.
 *
 * No dependencies: Node 22's global WebSocket. Chrome starts as the other browser tests start
 * it (tools/browser-env.mjs).
 */
import { startChrome } from "../../browser-env.mjs";

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function until(fn, label, timeout = 30000, every = 100) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await pause(every);
  }
  throw new Error(`Timed out waiting for ${label}${last ? ": " + last.message : ""}`);
}

class Socket {
  constructor(url) {
    this.url = url;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((ok, fail) => { this.ws.onopen = ok; this.ws.onerror = fail; });
    this.ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.id) {
        const job = this.pending.get(m.id);
        if (!job) return;
        this.pending.delete(m.id);
        m.error ? job.reject(new Error(m.error.message + (m.error.data ? ": " + m.error.data : ""))) : job.resolve(m.result);
        return;
      }
      for (const fn of this.listeners.get(m.method) ?? []) fn(m.params, m.sessionId);
      for (const fn of this.listeners.get("*") ?? []) fn(m);
    };
    this.ws.onclose = () => {
      for (const job of this.pending.values()) job.reject(new Error("socket closed"));
      this.pending.clear();
    };
    return this;
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  close() { try { this.ws.close(); } catch { /* gone */ } }
}

export class Browser {
  static async launch({ extraArgs = [] } = {}) {
    const b = new Browser();
    b.chrome = await startChrome({ name: "fuzz", args: [
      "--autoplay-policy=no-user-gesture-required", "--mute-audio",
      "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--window-size=1920,1080", "--js-flags=--max-old-space-size=6144", ...extraArgs,
    ] });
    b.port = b.chrome.port;
    const version = await (await fetch(`http://127.0.0.1:${b.port}/json/version`)).json();
    b.sock = await new Socket(version.webSocketDebuggerUrl).open();
    return b;
  }
  /** A new page in its own browser context (own storage), connected and with domains enabled. */
  async newPage(url, { isolated = true } = {}) {
    let browserContextId;
    if (isolated) ({ browserContextId } = await this.sock.send("Target.createBrowserContext", { disposeOnDetach: false }));
    const { targetId } = await this.sock.send("Target.createTarget", { url: "about:blank", browserContextId, width: 1920, height: 1080 });
    const page = new Page(this, targetId, browserContextId);
    await page.connect();
    if (url) await page.goto(url);
    return page;
  }
  async close() {
    try { await this.sock.send("Browser.close"); } catch { /* already gone */ }
    this.sock?.close();
    await this.chrome.stop();
  }
}

export class Page {
  constructor(browser, targetId, contextId) {
    this.browser = browser;
    this.targetId = targetId;
    this.contextId = contextId;
    /** Everything the page complained about, in order: { t, kind, text, url? }. */
    this.events = [];
    this.label = "";
  }
  async connect() {
    this.sock = await new Socket(`ws://127.0.0.1:${this.browser.port}/devtools/page/${this.targetId}`).open();
    const push = (kind, text, extra = {}) => this.events.push({ t: Date.now(), label: this.label, kind, text, ...extra });
    this.sock.on("Runtime.exceptionThrown", (p) => {
      const d = p.exceptionDetails;
      push("exception", d.exception?.description || d.text, { url: d.url, line: d.lineNumber });
    });
    this.sock.on("Runtime.consoleAPICalled", (p) => {
      if (p.type !== "error" && p.type !== "warning" && p.type !== "assert") return;
      const text = p.args.map((a) => a.value ?? a.description ?? a.type).join(" ");
      push("console." + p.type, text);
    });
    this.sock.on("Log.entryAdded", (p) => {
      if (p.entry.level === "error" || p.entry.level === "warning") push("log." + p.entry.level, p.entry.text, { url: p.entry.url });
    });
    this.sock.on("Network.responseReceived", (p) => {
      if (p.response.status >= 400) push("http." + p.response.status, p.response.url);
    });
    this.sock.on("Network.loadingFailed", (p) => {
      if (!p.canceled) push("net.failed", p.errorText, { requestId: p.requestId });
    });
    await this.sock.send("Page.enable");
    await this.sock.send("Runtime.enable");
    await this.sock.send("Log.enable");
    await this.sock.send("Network.enable");
    await this.sock.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  }
  send(method, params) { return this.sock.send(method, params); }
  async goto(url) {
    await this.send("Page.navigate", { url });
  }
  async evaluate(expression, { timeout } = {}) {
    const params = { expression, returnByValue: true, awaitPromise: true };
    if (timeout) params.timeout = timeout;
    const r = await this.send("Runtime.evaluate", params);
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error(d.exception?.description || d.text || "evaluate failed");
    }
    return r.result.value;
  }
  /** Evaluate a function with JSON arguments: fn is source text of `(args...) => ...`. */
  call(fnSource, ...args) {
    return this.evaluate(`(${fnSource})(...${JSON.stringify(args)})`);
  }
  async key(key, { code, repeat = false } = {}) {
    const text = key.length === 1 ? key : undefined;
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, text, autoRepeat: repeat });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
  }
  /** Click at logical game coordinates (1920x1080 space). */
  async click(x, y, { button = "left", clickCount = 1 } = {}) {
    const p = await this.evaluate(`(() => { const r = document.querySelector("canvas").getBoundingClientRect();
      return { x: r.left + ${x} * r.width / 1920, y: r.top + ${y} * r.height / 1080 }; })()`);
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
    for (let c = 1; c <= clickCount; c++) {
      await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button, clickCount: c, buttons: button === "right" ? 2 : 1 });
      await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button, clickCount: c });
    }
  }
  async reload() { await this.send("Page.reload", { ignoreCache: false }); }
  async screenshot() {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    return Buffer.from(data, "base64");
  }
  async close() {
    try { await this.browser.sock.send("Target.closeTarget", { targetId: this.targetId }); } catch { /* gone */ }
    if (this.contextId) { try { await this.browser.sock.send("Target.disposeBrowserContext", { browserContextId: this.contextId }); } catch { /* gone */ } }
    this.sock?.close();
  }
}

/** Wait for the game: __game present, boot overlay gone, and (optionally) every image settled. */
export async function waitForGame(page, { allAssets = true, timeout = 120000 } = {}) {
  await until(() => page.evaluate("Boolean(window.__game)"), "game", timeout);
  await until(() => page.evaluate("!document.getElementById('boot')"), "boot overlay", timeout);
  if (allAssets) {
    await until(() => page.evaluate(`(() => { const a = window.__game.assets;
      return a.queue.length === 0 && a.running === 0; })()`), "assets", timeout, 250);
  }
}

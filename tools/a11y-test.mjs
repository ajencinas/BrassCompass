/**
 * Keyboard and screen-reader accessibility, in headless Chrome.
 *
 *   node tools/a11y-test.mjs
 *
 * It drives the real game through the real input path (CDP key events and a phone viewport),
 * and asserts the parts a canvas game usually gets wrong:
 *
 *  - Tab/Shift+Tab leave the canvas for real DOM controls at the ends of the title and play
 *    focus cycles, instead of trapping focus on the canvas forever;
 *  - settings, the chart, history and the atlas put focus inside, and restore it (to the
 *    triggering button or the canvas) when they close;
 *  - the touch UI is keyboard-reachable, and Chapter select, the satchel, conversations,
 *    settings and the atlas move focus with the screen they open;
 *  - a boot failure focuses its retry, takes the dead canvas out of the tab order and is read
 *    out; reloading recovers to the canvas;
 *  - a repeated frame failure is a real modal above every overlay, traps Tab, restores focus
 *    and announces the recovery;
 *  - reduced motion and text size keep their promises: instant text, the speed control
 *    disabled, and the chosen size applied to the DOM overlays as well as the canvas;
 *  - save errors reach the live region.
 *
 * The painted art is gitignored and published separately; this test needs the shared art shelf
 * in public/assets (see README). Screenshots are not written: every assertion is state-based.
 */
import assert from "node:assert/strict";
import { startVite, startChrome, firstPage } from "./browser-env.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch { /* not yet */ }
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const KEY = {
  Tab: { vk: 9, code: "Tab" }, Enter: { vk: 13, code: "Enter" }, Escape: { vk: 27, code: "Escape" },
  ArrowUp: { vk: 38, code: "ArrowUp" }, ArrowDown: { vk: 40, code: "ArrowDown" },
  ArrowLeft: { vk: 37, code: "ArrowLeft" }, ArrowRight: { vk: 39, code: "ArrowRight" },
  " ": { vk: 32, code: "Space" },
};
const keyInfo = (key) => KEY[key] ?? { vk: key.toUpperCase().charCodeAt(0), code: `Key${key.toUpperCase()}` };

const server = await startVite(5280, 5300);
let browser;
let socket;
let runtimeErrors = [];
try {
  browser = await startChrome({ name: "a11y" });
  const target = await firstPage(browser);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });

  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") {
      runtimeErrors.push(message.params.exceptionDetails.text);
    }
    if (!message.id) return;
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(details.exception?.description || details.text || "evaluate failed");
    }
    return result.result.value;
  };
  const key = async (name, { shift = false } = {}) => {
    const info = keyInfo(name);
    // A real key press carries its text for Enter (and Space): without it Chrome's CDP key
    // events drive the game's window handler but do not activate a focused DOM button.
    const text = name === "Enter" ? "\r" : name === " " ? " " : undefined;
    const base = {
      key: name, code: info.code, windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk,
      modifiers: shift ? 8 : 0,
      ...(text === undefined ? {} : { text, unmodifiedText: text }),
    };
    await send("Input.dispatchKeyEvent", { type: "keyDown", ...base });
    await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await pause(140);
  };
  const tap = async (x, y) => {
    await send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
    });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await pause(200);
  };
  const rect = (selector) => evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((candidate) => candidate.getClientRects().length > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);
  const focus = (selector) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus({ preventScroll: true });
    return document.activeElement === el;
  })()`);
  const sr = () => evaluate('document.getElementById("sr").textContent');
  const active = () => evaluate(`(() => {
    const el = document.activeElement;
    if (!el) return { id: null, cls: null, text: null, inside: [] };
    return {
      id: el.id || null, cls: el.className || null, tag: el.tagName,
      text: (el.getAttribute?.("aria-label") || el.textContent || "").trim().slice(0, 80) || null,
      inside: [...el.classList],
    };
  })()`);
  const game = (expression) => evaluate(`(() => { const g = window.__game; return ${expression}; })()`);
  const waitFocus = (expression, label) => until(
    () => evaluate(`(() => { const a = document.activeElement; return Boolean(a && (${expression})); })()`), label);
  const waitTitle = () => until(() => evaluate('Boolean(window.__game) && window.__game.title && !document.getElementById("boot")'), "the title");
  const waitPlay = () => until(() => evaluate('Boolean(window.__game) && !window.__game.title && Boolean(window.__game.room)'), "a scene");
  const waitNoOverlays = () => until(() => evaluate(`(() => { const g = window.__game;
    return !g.paused && !g.casebook.open && !g.history.open && !g.atlas.open && !g.deeds.open &&
      !g.recap.open && !g.cinematic.active; })()`), "no overlay");
  /** Clear the intro queue/walk so a shortcut (J/L/A) is not legitimately parked behind it. */
  const settleForShortcuts = async () => {
    await evaluate(`(() => { const g = window.__game;
      g.narration = null; g.queue = null; g.path = []; g.onArrive = null; g.walkGoal = null;
      g.running = false; window.__ff(20); return true; })()`);
    await pause(150);
  };

  /* ---------------------------------------------------------------- setup */
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  // Every fresh document starts with no save and no preferences. This runs before the game's
  // modules, so the old page's pagehide autosave cannot leak a save into the next check.
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: "try { localStorage.clear(); } catch (e) { /* storage unavailable */ }",
  });
  const desktop = async (url = server.url + "?nomobile=1") => {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await send("Emulation.setEmulatedMedia", { features: [] });
    await send("Page.navigate", { url });
    await waitTitle();
    await pause(250);
  };

  /* ------------------------------------------------------- desktop keyboard */
  await desktop();
  assert.equal(await game("g.title"), true, "the desktop game starts on the title");
  let state = await active();
  assert.equal(state.id, "game", "desktop boot focuses the canvas");
  assert.match(await sr(), /Title screen\./, "the title is announced to the live region");
  let toolbar = await evaluate('document.querySelector(".a11y-controls").hidden');
  assert.equal(toolbar, true, "the in-play toolbar is hidden while the title is up");

  await key("Tab");
  assert.equal(await game("g.titleFocus"), "explore", "Tab moves between the title's answers");
  await key("Tab");
  state = await active();
  assert.notEqual(state.id, "game", "Tab at the end of the title menu leaves the canvas");
  await key("Tab", { shift: true });
  state = await active();
  assert.equal(state.id, "game", "Tab from the page lands back on the canvas");

  // Chapter select is a keyboard path too: E from the title, arrows/Tab through the scenes,
  // Escape out; the canvas list is read out because it is not real DOM.
  await focus("canvas");
  await key("e");
  await until(() => game("g.explore && g.roomMenu"), "desktop Chapter select");
  assert.match(await sr(), /chapter select/i, "desktop Chapter select is announced");
  await key("Tab");
  assert.equal(await game("g.roomMenuFocus"), 1, "Tab walks the Chapter select list");
  assert.match(await sr(), /scene 2 of/i, "the focused scene is read out");
  await key("Escape");
  await until(() => game("!g.roomMenu"), "desktop Chapter select to close");
  assert.match(await sr(), /chapter select closed/i, "closing Chapter select is announced");
  await key("Escape");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "settings from Chapter select");
  await evaluate('document.querySelector(".settings [data-action=\\"title\\"]").click()');
  await waitTitle();
  await pause(200);
  await focus("canvas");
  // Enter with no title focus does what Enter always does: Continue, else Begin.
  await evaluate("window.__game.titleFocus = null");
  await key("Enter");
  await waitPlay();
  assert.equal(await game("g.explore"), false, "Enter starts a voyage, not Chapter select");
  await until(() => evaluate('!document.querySelector(".area-card") && !window.__game.cinematic.active'), "the opening card");
  await settleForShortcuts();

  // Tab: scene -> verbs -> satchel, then out to a real toolbar button.
  assert.equal(await game("g.keyboardFocus"), null, "keyboard focus starts in the scene");
  await key("Tab");
  assert.equal(await game("g.keyboardFocus.kind"), "hotspot", "Tab reaches the scene");
  await key("Tab");
  assert.equal(await game("g.keyboardFocus.kind"), "verb", "Tab reaches the verbs");
  await key("Tab");
  assert.equal(await game("g.keyboardFocus.kind"), "item", "Tab reaches the satchel");
  await key("Tab");
  state = await active();
  assert.equal(await evaluate("Boolean(document.activeElement.closest('.a11y-controls'))"), true,
    "Tab at the end of the play cycle reaches the real screen-reader controls");
  assert.equal(await game("g.keyboardFocus.kind"), "item", "the canvas remembers where Tab left it");

  // The real toolbar is usable, and overlays opened from it return focus to it (not to <body>).
  await key("Tab");
  await key("Tab");
  await key("Enter");
  await until(() => game("g.history.open"), "history from the screen-reader toolbar");
  await key("Escape");
  await until(() => game("!g.history.open"), "history from the toolbar to close");
  assert.equal(await evaluate("Boolean(document.activeElement.closest('.a11y-controls'))"), true,
    "an overlay opened from the toolbar returns focus to that button");

  // Shift+Tab at the front of the cycle leaves the canvas for the browser.
  await focus("canvas");
  await evaluate("window.__game.keyboardFocus = { kind: 'hotspot', id: window.__game.groupIds('hotspot')[0] };");
  await key("Tab", { shift: true });
  state = await active();
  assert.notEqual(state.id, "game", "Shift+Tab at the front of the focus cycle leaves the canvas");
  await focus("canvas");

  /* ------------------------------------------------------ overlay focus */
  await key("j");
  await until(() => game("g.casebook.open"), "the chart");
  assert.equal((await active()).cls.includes("casebook-body"), true, "the chart focuses its reading pane");
  await key("Tab");
  assert.equal(await evaluate("Boolean(document.activeElement.dataset.action === 'close')"), true,
    "Tab stays inside the chart");
  await key("Escape");
  await until(() => game("!g.casebook.open"), "the chart to close");
  assert.equal((await active()).id, "game", "closing the chart returns focus to the canvas");

  await key("l");
  await until(() => game("g.history.open"), "line history");
  assert.equal((await active()).cls.includes("history-body"), true, "line history focuses its list");
  await key("Escape");
  await until(() => game("!g.history.open"), "line history to close");
  assert.equal((await active()).id, "game", "closing line history returns focus to the canvas");

  await key("a");
  await until(() => game("g.atlas.open"), "the atlas");
  assert.equal((await active()).cls.includes("atlas-marker"), true, "the atlas focuses a place on the chart");
  await key("Tab");
  assert.equal((await active()).cls.includes("atlas-marker"), true, "Tab moves between atlas places");
  await key("Escape");
  await until(() => game("!g.atlas.open"), "the atlas to close");
  assert.equal((await active()).id, "game", "closing the atlas returns focus to the canvas");

  await key("Escape");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "the pause dialog");
  assert.equal(await evaluate("Boolean(document.activeElement.closest('.settings'))"), true,
    "the pause dialog takes focus");
  assert.equal(await evaluate("document.activeElement.dataset.action === 'resume'"), true,
    "the pause dialog focuses Resume");
  await key("Tab", { shift: true });
  assert.equal(await evaluate("Boolean(document.activeElement.closest('.settings'))"), true,
    "Tab stays inside the pause dialog");
  await key("Escape");
  await until(() => evaluate('document.querySelector(".settings").hidden'), "the pause dialog to close");
  assert.equal((await active()).id, "game", "closing the pause dialog returns focus to the canvas");

  // Opened with focus on <body>: the fallback must still be the canvas, not a no-op.
  await evaluate('document.querySelector("canvas").blur()');
  await key("l");
  await until(() => game("g.history.open"), "history from body focus");
  await key("Escape");
  await until(() => game("!g.history.open"), "history from body focus to close");
  assert.equal((await active()).id, "game", "an overlay opened without canvas focus still restores the canvas");

  /* ------------------------------------------------------- save error */
  await evaluate(`(() => { const g = window.__game;
    window.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "brasscompass.save.v4") throw new DOMException("quota", "QuotaExceededError");
      return window.__setItem.call(this, key, value);
    };
    g.saveBroken = false;
    g.persist();
    return true; })()`);
  await pause(250);
  assert.match(await sr(), /won't take ink/, "a save failure is announced in the live region");
  assert.match(await game("g.saveNotice.text"), /not being saved/, "the same failure is in the visible banner");
  await evaluate("Storage.prototype.setItem = window.__setItem");

  /* -------------------------------------- reduced motion and text size */
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await send("Page.navigate", { url: server.url + "?nomobile=1" });
  await waitTitle();
  await pause(250);
  assert.equal(await evaluate('document.body.classList.contains("reduced-motion")'), true,
    "the OS reduced-motion setting reaches the page");
  assert.equal(await game("g.reduced"), true, "reduced motion is in effect");
  assert.equal(await game("g.textSpeed"), "instant", "reduced motion makes text instant");

  await key("Escape");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "settings under reduced motion");
  assert.equal(await evaluate('document.querySelector(\'select[data-pref="textSpeed"]\').disabled'), true,
    "the text speed control is disabled while text is instant");
  assert.equal(await evaluate('document.querySelector(\'select[data-pref="textSpeed"]\').value'), "instant");
  assert.equal(await evaluate('document.getElementById("speed-note").hidden'), false,
    "the reduced-motion note explains the disabled speed");
  await evaluate(`(() => { const s = document.querySelector('select[data-pref="textScale"]');
    s.value = "1.5"; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
  await pause(200);
  assert.equal(await evaluate('document.documentElement.style.getPropertyValue("--text-scale")'), "1.5",
    "a chosen text size reaches the DOM");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".settings")).fontSize'), "24px",
    "the pause dialog follows the text size");
  await key("Escape");
  await until(() => evaluate('document.querySelector(".settings").hidden'), "settings to close");
  await focus("canvas");
  await key("Enter");
  await waitPlay();
  await until(() => evaluate('!document.querySelector(".area-card") && !window.__game.cinematic.active'), "the opening card");
  await settleForShortcuts();
  await key("j");
  await until(() => game("g.casebook.open"), "the chart at 150%");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".casebook")).fontSize'), "24px",
    "the chart follows the chosen text size");
  await key("Escape");
  await until(() => game("!g.casebook.open"), "the chart to close");

  // Tab walks a conversation's answers, but leaves them at either end instead of trapping focus.
  await focus("canvas");
  await evaluate('window.__game.startDialogue("bramwick", "root")');
  await until(() => game("Boolean(g.dialogue)"), "a conversation");
  await evaluate("window.__game.dialogue.shown = 1e6");
  await key("Tab");
  assert.equal(await game("g.hoverChoice"), 0, "Tab moves to the first answer");
  await key("Tab");
  assert.equal(await game("g.hoverChoice"), 1, "and on to the next");
  await key("ArrowDown"); await key("ArrowDown"); await key("ArrowDown");
  assert.equal(await game("g.hoverChoice"), 4, "arrows still walk to the last answer");
  await key("Tab");
  assert.notEqual((await active()).id, "game", "Tab past the last answer leaves the canvas");
  await focus("canvas");
  await key("Tab", { shift: true });
  assert.equal(await game("g.hoverChoice"), 3, "Shift+Tab walks back through the answers");
  await evaluate("window.__game.leaveDialogue()");
  await focus("canvas");

  await key("Escape");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "settings to turn motion off");
  await evaluate(`(() => { const s = document.querySelector('select[data-pref="reducedMotion"]');
    s.value = "off"; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
  await pause(200);
  assert.equal(await evaluate('document.body.classList.contains("reduced-motion")'), false,
    "turning reduced motion off restores motion");
  assert.equal(await evaluate('document.querySelector(\'select[data-pref="textSpeed"]\').disabled'), false,
    "turning reduced motion off re-enables the speed control");
  await key("Escape");
  await until(() => evaluate('document.querySelector(".settings").hidden'), "settings to close");
  await send("Emulation.setEmulatedMedia", { features: [] });

  /* ------------------------------ contrast, text size, reading time, reveal */
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-contrast", value: "more" }] });
  await send("Page.navigate", { url: server.url + "?nomobile=1" });
  await waitTitle();
  await pause(250);
  assert.equal(await evaluate('document.body.classList.contains("high-contrast")'), true,
    "the OS prefers-contrast setting is the default for high contrast");
  await key("Escape");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "settings for the new options");
  const setPref = (name, value) => evaluate(`(() => { const s = document.querySelector('select[data-pref="${name}"]');
    s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event("change", { bubbles: true })); return s.value; })()`);
  assert.equal(await setPref("highContrast", "off"), "off");
  await pause(150);
  assert.equal(await evaluate('document.body.classList.contains("high-contrast")'), false,
    "high contrast can be turned off against the OS");
  assert.match(await sr(), /High contrast off/, "the change is announced");
  await setPref("highContrast", "on");
  await pause(150);
  assert.equal(await evaluate('document.body.classList.contains("high-contrast")'), true, "high contrast turns on");
  assert.match(await sr(), /High contrast on/, "the change is announced");
  assert.equal(await setPref("textScale", "2"), "2", "200% is a text size");
  await pause(150);
  assert.equal(await evaluate('document.documentElement.style.getPropertyValue("--text-scale")'), "2",
    "the largest text size reaches the DOM");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".settings")).fontSize'), "32px");
  assert.equal(await game("g.textScale"), 2, "and the canvas");
  assert.equal(await setPref("textScale", "1.75"), "1.75", "175% is a text size");
  await setPref("textScale", "1.5");
  await setPref("readingTime", "xlong");
  assert.equal(await game("g.readingFactor > 2"), true, "Very long reading time lengthens every hold");
  assert.match(await evaluate('document.querySelector(\'[data-action="wait"]\').textContent'),
    /Keep each line until I click/, "the wait toggle says what it does");
  assert.equal(await evaluate('Boolean(document.getElementById(document.querySelector(\'[data-action="wait"]\').getAttribute("aria-describedby")))'),
    true, "and has its explanation");
  await setPref("revealMode", "toggle");
  assert.equal(await game("g.prefs.revealMode"), "toggle");
  await setPref("highContrast", "auto");
  await setPref("readingTime", "normal");
  await setPref("revealMode", "hold");
  await key("Escape");
  await until(() => evaluate('document.querySelector(".settings").hidden'), "settings to close");
  await send("Emulation.setEmulatedMedia", { features: [] });

  /* ----------------------------------------------------- frame failure */
  await evaluate("window.__step0 = window.__game.step; window.__game.step = () => { throw new Error('a11y forced failure'); };");
  await until(() => evaluate('Boolean(document.getElementById("fatal"))'), "the frame-failure dialog", 10000);
  assert.equal(await evaluate("document.activeElement.id"), "fatal-retry", "the failure dialog focuses Try again");
  assert.equal(await evaluate('document.getElementById("fatal").getAttribute("role")'), "alertdialog");
  assert.equal(await evaluate('getComputedStyle(document.getElementById("fatal")).zIndex'), "100",
    "the failure dialog is above every game overlay");
  assert.equal(await evaluate('document.getElementById("stage").inert'), true,
    "the frozen game behind the failure is inert");
  assert.equal(await evaluate('document.querySelector(".a11y-controls").inert'), true,
    "the screen-reader toolbar is inert behind the failure");
  assert.match(await sr(), /game hit a problem/i, "the failure is announced");
  await key("Tab");
  assert.equal(await evaluate("document.activeElement.id"), "fatal-reload", "Tab stays inside the failure dialog");
  await key("Tab");
  assert.equal(await evaluate("document.activeElement.id"), "fatal-retry", "Tab cycles the failure dialog's answers");
  await evaluate("window.__game.step = window.__step0");
  await key("Escape");
  await until(() => evaluate('!document.getElementById("fatal")'), "the failure dialog to close");
  assert.equal((await active()).id, "game", "Try again/Escape restores focus to the canvas");
  assert.equal(await evaluate('document.getElementById("stage").inert'), false,
    "the game is interactive again");
  assert.match(await sr(), /running again/i, "the recovery is announced");

  /* -------------------------------------------------------- boot failure */
  await send("Network.setBlockedURLs", { urls: ["*title_night.webp*"] });
  await send("Page.navigate", { url: server.url + "?nomobile=1" });
  await until(() => evaluate('!document.getElementById("bootfail").hidden'), "the boot-failure alert", 20000);
  assert.equal(await evaluate("document.activeElement.id"), "bootfail-retry", "the boot failure focuses Try again");
  assert.equal(await evaluate('document.getElementById("bootfail").getAttribute("role")'), "alertdialog");
  assert.equal(await evaluate('document.getElementById("stage").inert'), true,
    "the dead canvas is inert in the boot failure");
  assert.equal(await evaluate('document.getElementById("game").tabIndex'), -1,
    "the dead canvas is out of the tab order");
  assert.match(await sr(), /harbour is still in fog/i, "the boot failure is announced in the live region");
  await key("Tab");
  assert.equal(await evaluate("document.activeElement.id === 'game'"), false,
    "Tab does not land on the dead canvas");
  await key("Tab", { shift: true });
  assert.equal(await evaluate("document.activeElement.id"), "bootfail-retry",
    "Shift+Tab returns to Try again");
  await send("Network.setBlockedURLs", { urls: [] });
  await evaluate('document.getElementById("bootfail-retry").click()');
  await until(() => evaluate('Boolean(window.__game) && document.getElementById("bootfail").hidden && !document.getElementById("boot")'), "boot recovery", 30000);
  await pause(400);
  assert.equal((await active()).id, "game", "a recovered boot focuses the canvas");
  assert.equal(await evaluate('document.getElementById("stage").inert'), false,
    "the recovered canvas is interactive again");
  assert.equal(await evaluate('document.getElementById("game").tabIndex'), 0,
    "the recovered canvas is back in the tab order");
  assert.match(await sr(), /Title screen\./, "the recovered title is announced");

  /* ------------------------------- boot failure: no 2D canvas context */
  const noCanvas = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => { const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return this.id === "game" && type === "2d" ? null : get.call(this, type, ...rest);
      }; })()`,
  });
  await send("Page.navigate", { url: server.url + "?nomobile=1" });
  await until(() => evaluate('!document.getElementById("bootfail").hidden'), "the boot-failure alert without a canvas", 20000);
  assert.equal(await evaluate("document.activeElement.id"), "bootfail-retry", "the canvas failure focuses Try again");
  assert.match(await evaluate('document.getElementById("bootfail-detail").textContent'), /2D canvas unavailable/,
    "the dialog says what failed");
  assert.match(await sr(), /could not start/i, "the canvas failure is announced");
  await until(() => evaluate('!document.getElementById("boot")'), "the loading screen to go");
  assert.equal(await evaluate('document.getElementById("stage").inert'), true, "the dead canvas is inert");
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: noCanvas.identifier });
  await send("Page.navigate", { url: server.url + "?nomobile=1" });
  await waitTitle();

  /* ------------------------------------------------------------ mobile */
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenOrientation: { type: "portraitPrimary", angle: 0 },
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url: server.url + "?mobile=1" });
  await until(() => evaluate('Boolean(window.__game) && !document.getElementById("boot")'), "the phone game");
  await pause(450);
  assert.equal(await evaluate('document.body.classList.contains("mobile")'), true, "the phone layout is used");

  // The phone title focuses its real primary button immediately; the canvas is not a tab stop
  // behind the title sheet.
  state = await active();
  assert.equal(await evaluate("Boolean(document.activeElement.dataset.title)"), true,
    "the phone title starts on a real title button");
  const firstTitle = await evaluate("document.activeElement.dataset.title");
  assert.equal(firstTitle, "start", "with no save, Begin is the first title button");
  await key("Tab");
  assert.equal(await evaluate("document.activeElement.dataset.title"), "explore",
    "Tab reaches Chapter select on the title");
  await key("Enter");
  await until(() => game("g.roomMenu"), "phone Chapter select");
  await until(() => evaluate('Boolean(document.activeElement.classList?.contains("m-room"))'), "focus in the scene sheet");
  assert.match(await sr(), /chapter select/i, "opening Chapter select is announced");
  const firstRoom = await evaluate("document.activeElement.dataset.room");
  await key("Tab");
  const secondRoom = await evaluate("document.activeElement.dataset.room");
  assert.ok(secondRoom && secondRoom !== firstRoom, "Tab walks the real scene buttons");
  await key("Escape");
  await until(() => game("!g.roomMenu"), "phone Chapter select to close");
  await waitFocus("a.classList.contains('m-scenes')", "focus on the Scenes button");
  assert.match(await sr(), /chapter select closed/i, "closing Chapter select is announced");

  // Reopen and close with the keyboard alone; Shift+Tab from the first scene reaches Done.
  await key("Enter");
  await until(() => game("g.roomMenu"), "phone Chapter select reopened");
  await until(() => evaluate('Boolean(document.activeElement.classList?.contains("m-room"))'), "focus back in the scene sheet");
  await key("Tab", { shift: true });
  assert.equal(await evaluate("document.activeElement.classList.contains('m-rooms-close')"), true,
    "Shift+Tab from the first scene reaches Done");
  await key("Enter");
  await until(() => game("!g.roomMenu"), "phone Chapter select closed by Done");
  await waitFocus("a.classList.contains('m-scenes')", "focus back on the Scenes button");

  // Choosing a scene closes the sheet and returns focus to Scenes as well.
  await key("Enter");
  await until(() => game("g.roomMenu"), "phone Chapter select for choosing");
  await until(() => evaluate('Boolean(document.activeElement.classList?.contains("m-room"))'), "focus in the scene sheet again");
  await key("Enter");
  await until(() => game("!g.roomMenu"), "phone scene chosen");
  await waitFocus("a.classList.contains('m-scenes')", "focus on the Scenes button after choosing");

  // Settings from the real Pause button, and back.
  await focus('[data-bar="pause"]');
  await key("Enter");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "phone pause dialog");
  assert.equal(await evaluate("document.activeElement.dataset.action"), "resume",
    "the phone pause dialog focuses Resume");
  await key("Escape");
  await until(() => evaluate('document.querySelector(".settings").hidden'), "phone pause dialog to close");
  await waitFocus("a.dataset.bar === 'pause'", "focus on Pause after settings");

  // Atlas from the real Map button, and back.
  await focus('[data-bar="map"]');
  await key("Enter");
  await until(() => game("g.atlas.open"), "phone atlas");
  await waitFocus("a.classList.contains('atlas-marker')", "focus on an atlas place");
  await key("Escape");
  await until(() => game("!g.atlas.open"), "phone atlas to close");
  await waitFocus("a.dataset.bar === 'map'", "focus on Map after the atlas");

  // Satchel: opening focuses inside the drawer; Done returns to the bag.
  await focus(".m-bag");
  await key("Enter");
  await until(() => evaluate('!document.querySelector(".m-drawer").hidden'), "phone satchel");
  assert.equal(await evaluate("document.querySelector('.m-drawer').contains(document.activeElement)"), true,
    "opening the satchel moves focus inside it");
  if (await evaluate("document.activeElement.classList.contains('m-item')")) await key("Tab", { shift: true });
  assert.equal(await evaluate("document.activeElement.classList.contains('m-drawer-close')"), true,
    "the satchel's Done is reachable from its items");
  await key("Enter");
  await until(() => evaluate('document.querySelector(".m-drawer").hidden'), "phone satchel to close");
  await waitFocus("a.classList.contains('m-bag')", "focus on the bag after the satchel");

  // A conversation takes focus, its choices are reachable, and closing it returns to play.
  const tree = await evaluate(`(async () => {
    const { DIALOGUES } = await import("/src/content/dialogue.ts");
    return Object.keys(DIALOGUES).find((id) => {
      const t = DIALOGUES[id];
      return t.nodes[t.start]?.choices?.length > 0;
    }) ?? Object.keys(DIALOGUES)[0];
  })()`);
  await evaluate(`window.__game.startDialogue(${JSON.stringify(tree)})`);
  await until(() => evaluate('!document.querySelector(".m-dialogue").hidden'), "the phone conversation");
  await waitFocus("a.classList.contains('m-dialogue-text')", "focus on the conversation text");
  await key("Tab");
  await waitFocus("a.classList.contains('m-choice')", "focus on a conversation choice");
  await evaluate("window.__game.leaveDialogue()");
  await until(() => evaluate('document.querySelector(".m-dialogue").hidden'), "the conversation to close");
  await waitFocus("a.classList.contains('m-bag')", "focus back on the bag after the conversation");

  // The chosen text size reaches the touch chrome, not just the canvas and the page overlays.
  await key("Escape");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "phone pause dialog for text size");
  await evaluate(`(() => { const s = document.querySelector('select[data-pref="textScale"]');
    s.value = "1.5"; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
  await pause(200);
  assert.equal(await evaluate('document.documentElement.style.getPropertyValue("--text-scale")'), "1.5",
    "the phone's chosen text size is recorded");
  await key("Escape");
  await until(() => evaluate('document.querySelector(".settings").hidden'), "phone settings after text size");
  await pause(150);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".m-bag")).fontSize'), "22.5px",
    "the touch HUD follows the chosen text size");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1"), true,
    "the phone still has no horizontal overflow at 150% text");
  assert.equal(await evaluate('document.querySelector(".m-bag").getBoundingClientRect().height >= 44'), true,
    "the bag stays a touch target at 150% text");

  // Returning to the title from the pause menu focuses the recommended answer and keeps the size.
  await key("Escape");
  await until(() => evaluate('!document.querySelector(".settings").hidden'), "phone pause dialog for title");
  await evaluate('document.querySelector(".settings [data-action=\\"title\\"]").click()');
  await until(() => game("g.title"), "the title after returning");
  await waitFocus("Boolean(a.dataset.title)", "focus on a title button");
  assert.match(await sr(), /Title screen\./, "the returned title is announced");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".m-title-button")).fontSize'), "22.5px",
    "the phone title follows the chosen text size");

  assert.deepEqual(runtimeErrors, [], `page exceptions: ${runtimeErrors.join("; ")}`);
  console.log("a11y browser test passed: desktop focus/tab/overlays/save error, boot and frame failures, reduced motion/text size, phone keyboard + focus");
} finally {
  socket?.close();
  await browser?.stop();
  await server.stop();
}

/**
 * The touch layout, in a real phone viewport.
 *
 *   node tools/mobile-test.mjs
 *
 * Two frames: 390x844 portrait and 844x390 landscape. For each, the page must have no horizontal
 * overflow, its canvas must fit inside the viewport, every visible touch control must be at least
 * 44 CSS pixels on both sides, and a scene must be reachable from the DOM title menu. The
 * portrait pass then exercises the confirm rule (a quick double tap does not confirm; a later
 * tap does) and the window-owned long-press timer (a release outside must not fire it after the
 * fact). The landscape pass confirms through the visible action plate instead. A desktop load
 * follows, to prove the phone path did not leak into the mouse UI.
 *
 * Screenshots of the title, the scene and an armed action land in test-output/mobile/.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startChrome, startVite, firstPage } from "./browser-env.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch { /* not yet */ }
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const output = resolve("test-output/mobile");
await mkdir(output, { recursive: true });
const server = await startVite(5210, 5230);
let browser;
let socket;
try {
  browser = await startChrome({ name: "mobile" });
  const target = await firstPage(browser);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });

  let sequence = 0;
  const pending = new Map();
  const runtimeErrors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
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
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(details.exception?.description || details.text || "evaluate failed");
    }
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");

  const visible = `(el) => { const s = getComputedStyle(el); if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }`;
  const snapshot = `(() => {
    const visible = ${visible};
    const canvas = document.querySelector("canvas");
    const c = canvas.getBoundingClientRect();
    const buttons = [...document.querySelectorAll("#mobile-ui button")].filter(visible).map((b) => {
      const r = b.getBoundingClientRect();
      return { label: b.getAttribute("aria-label") || b.textContent.trim().slice(0, 40), w: r.width, h: r.height };
    });
    return {
      body: document.body.className, vw: innerWidth, vh: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      canvas: { left: c.left, top: c.top, right: c.right, bottom: c.bottom, width: c.width, height: c.height },
      title: Boolean(window.__game?.title), room: window.__game?.room?.id ?? null, fade: window.__game?.fade ?? null,
      hud: visible(document.querySelector(".m-hud")), top: visible(document.querySelector(".m-top")),
      buttons,
    };
  })()`;

  async function viewport(width, height, mobile, touch) {
    await send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 2, mobile,
      screenOrientation: { type: width > height ? "landscapePrimary" : "portraitPrimary", angle: width > height ? 90 : 0 },
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 0 });
    await send("Page.navigate", { url: server.url });
    await until(() => evaluate("Boolean(window.__game) && !document.getElementById('boot')"), `game at ${width}x${height}`);
    await pause(450);
  }

  async function tap(x, y) {
    try {
      await send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
      });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } catch (e) {
      throw new Error(`tap at ${x},${y} failed: ${e.message}`);
    }
    await pause(80);
  }

  /** A tap with no settle time: used to put two taps inside one gesture's window. */
  async function tapFast(x, y) {
    await send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
    });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await pause(10);
  }

  async function buttonRect(selector) {
    const rect = await evaluate(`(() => {
      const visible = ${visible};
      const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find(visible);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    assert.ok(rect, `expected a visible ${selector}`);
    return rect;
  }

  async function enterScene() {
    // A real route in: the DOM title menu -> Chapter select -> the first room.
    const explore = await buttonRect('[data-title="explore"]');
    await tap(explore.x, explore.y);
    await until(() => evaluate("!document.querySelector('.m-rooms').hidden"), "chapter select sheet");
    const room = await buttonRect(".m-room");
    await tap(room.x, room.y);
    await until(() => evaluate("Boolean(window.__game) && !window.__game.title && Boolean(window.__game.room)"), "a scene");
    await pause(350);
  }

  async function screenshot(name) {
    const shot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(output, name), Buffer.from(shot.data, "base64"));
  }

  async function checkFrame(width, height, minButtons = 2) {
    const state = await evaluate(snapshot);
    assert.match(state.body, /\bmobile\b/, "phone viewport must take the touch layout");
    assert.ok(state.scrollWidth <= state.vw + 1 && state.bodyScrollWidth <= state.vw + 1,
      `no horizontal overflow: scrollWidth ${state.scrollWidth}/${state.bodyScrollWidth} vs ${state.vw}`);
    assert.ok(state.canvas.left >= -0.5 && state.canvas.top >= -0.5 &&
      state.canvas.right <= state.vw + 0.5 && state.canvas.bottom <= state.vh + 0.5,
      `canvas fits ${width}x${height}: ${JSON.stringify(state.canvas)}`);
    assert.ok(state.canvas.width > 0 && state.canvas.height > 0, "canvas has a box");
    const visibleButtons = state.buttons.filter((b) => b.w > 0 && b.h > 0);
    assert.ok(visibleButtons.length >= minButtons, `expected touch controls, saw ${visibleButtons.length}`);
    for (const button of visibleButtons) {
      assert.ok(button.h >= 43.5, `"${button.label}" is ${button.h.toFixed(1)}px tall, under 44`);
      assert.ok(button.w >= 43.5, `"${button.label}" is ${button.w.toFixed(1)}px wide, under 44`);
    }
    return state;
  }

  async function pickHotspot() {
    return evaluate(`(() => {
      const g = window.__game;
      const candidates = g.visibleHotspots().filter((h) => !g.isExit(g.hotspotState(h)));
      const raw = candidates.find((h) => g.hotspotAt(areaCentre(h.area).x, areaCentre(h.area).y)) || candidates[0];
      if (!raw) return null;
      function areaCentre(area) {
        if (area.rect) return { x: area.rect.x + area.rect.w / 2, y: area.rect.y + area.rect.h / 2 };
        return { x: area.reduce((s, p) => s + p.x, 0) / area.length, y: area.reduce((s, p) => s + p.y, 0) / area.length };
      }
      const c = areaCentre(raw.area);
      const r = g.view.canvas.getBoundingClientRect();
      const x = Math.max(90, Math.min(1830, c.x - g.cameraX));
      return {
        id: raw.id, name: g.hotspotState(raw).name,
        clientX: r.left + (x / 1920) * r.width,
        clientY: r.top + (Math.max(4, Math.min(876, c.y)) / 880) * r.height,
      };
    })()`);
  }

  async function resetTouchTest() {
    await evaluate(`(() => { const g = window.__game;
      g.narration = null; g.queue = null; g.path = []; g.onArrive = null; g.sentence = { verb: null, a: null, b: null };
      g.committed = null; g.touchArmed = null; g.touchArmedAt = 0; g.hoverHotspot = null; window.__ff(10);
      return true; })()`);
  }

  // ---- 390 x 844 portrait
  await viewport(390, 844, true, true);
  let frame = await checkFrame(390, 844);
  assert.equal(frame.title, true, "starts on the title");
  await screenshot("title-390x844.png");
  await enterScene();
  frame = await checkFrame(390, 844, 8);
  assert.ok(frame.room, "a scene was entered");
  assert.equal(frame.hud, true, "the touch HUD is up in play");
  assert.equal(frame.top, true, "the touch top bar is up in play");
  await screenshot("play-390x844.png");

  // The pause panel is part of the touch surface too.
  const pauseButton = await buttonRect('[data-bar="pause"]');
  await tap(pauseButton.x, pauseButton.y);
  await until(() => evaluate("!document.querySelector('.settings').hidden"), "pause panel");
  const settings = await evaluate(`(() => { const s = document.querySelector(".settings");
    return [...s.querySelectorAll("button, select, summary")].filter((b) => b.getBoundingClientRect().height > 0)
      .map((b) => ({ label: b.textContent.trim().slice(0, 30) || b.getAttribute("aria-label") || b.tagName, h: b.getBoundingClientRect().height })); })()`);
  for (const control of settings) assert.ok(control.h >= 43.5, `pause control "${control.label}" is ${control.h}px tall`);
  const resume = await buttonRect('.settings [data-action="resume"]');
  await tap(resume.x, resume.y);
  await until(() => evaluate("document.querySelector('.settings').hidden"), "resumed");

  // The satchel is a drawer of real buttons, and it closes again.
  const bag = await buttonRect(".m-bag");
  await tap(bag.x, bag.y);
  await until(() => evaluate("!document.querySelector('.m-drawer').hidden"), "satchel drawer");
  const drawer = await evaluate(`(() => { const d = document.querySelector(".m-drawer");
    return [...d.querySelectorAll("button")].filter((b) => b.offsetParent !== null).map((b) => ({ label: b.textContent.trim(), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })); })()`);
  for (const button of drawer) {
    assert.ok(button.h >= 43.5, `drawer "${button.label}" is ${button.h}px tall`);
    assert.ok(button.w >= 43.5, `drawer "${button.label}" is ${button.w}px wide`);
  }
  const drawerDone = await buttonRect(".m-drawer-close");
  await tap(drawerDone.x, drawerDone.y);
  await until(() => evaluate("document.querySelector('.m-drawer').hidden"), "closed satchel drawer");

  // Chapter select stays reachable: the Scenes plate opens the room sheet again.
  const scenes = await buttonRect(".m-scenes");
  assert.ok(scenes.h >= 43.5, "the Scenes button is a touch target");
  await tap(scenes.x, scenes.y);
  await until(() => evaluate("!document.querySelector('.m-rooms').hidden"), "reopened chapter select");
  const done = await buttonRect(".m-rooms-close");
  await tap(done.x, done.y);
  await until(() => evaluate("document.querySelector('.m-rooms').hidden"), "closed chapter select");

  // A first tap arms; a second tap inside the same gesture must not spend it. The two taps go
  // back to back, before any assertion can eat into the 400 ms window.
  await resetTouchTest();
  let pick = await pickHotspot();
  assert.ok(pick, "a scene has a touchable thing");
  await tapFast(pick.clientX, pick.clientY);
  const bounceAge = await evaluate("performance.now() - window.__game.touchArmedAt");
  await tapFast(pick.clientX, pick.clientY);
  await until(() => evaluate("!document.querySelector('.m-action').hidden"), "action plate after arming");
  let armed = await evaluate(`(() => { const g = window.__game; const a = document.querySelector(".m-action");
    return { touchArmed: g.touchArmed, at: performance.now() - g.touchArmedAt, hidden: a.hidden, text: a.innerText,
      height: a.getBoundingClientRect().height, committed: g.committed, verb: g.sentence.verb }; })()`);
  assert.equal(armed.touchArmed, pick.id, "the first tap arms the thing it hit");
  assert.equal(armed.hidden, false, "arming shows an action plate");
  assert.ok(armed.text.toLowerCase().includes(pick.name.toLowerCase()), `action plate names the thing: ${armed.text}`);
  assert.ok(armed.height >= 43.5, "the action plate is a touch target");
  assert.equal(armed.committed, null, "a quick double tap does not confirm the armed action");
  assert.equal(armed.verb, null, "a quick double tap runs nothing");
  assert.ok(bounceAge < 400, `the bouncing tap arrived inside the confirmation window (${bounceAge.toFixed(0)} ms)`);
  await screenshot("armed-390x844.png");

  const elapsed = await evaluate("performance.now() - window.__game.touchArmedAt");
  await pause(Math.max(0, 460 - elapsed));
  await tap(pick.clientX, pick.clientY);
  await until(() => evaluate("window.__game.touchArmed === null"), "delayed confirmation");
  const confirmed = await evaluate(`(() => { const g = window.__game; return { committed: g.committed, verb: g.sentence.verb, path: g.path.length, narration: g.narration?.text ?? null }; })()`);
  assert.ok(confirmed.committed || confirmed.verb || confirmed.path > 0 || confirmed.narration,
    "a later tap confirms the action");

  // A press released outside the canvas must not leave a long-press timer to fire.
  await resetTouchTest();
  await evaluate(`(() => {
    const c = document.querySelector("canvas");
    const r = c.getBoundingClientRect();
    const x = r.left + r.width * 0.5, y = r.top + r.height * 0.5;
    c.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", pointerId: 91, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", pointerId: 91, clientX: -60, clientY: y, bubbles: true, cancelable: true }));
    return true;
  })()`);
  await pause(700);
  const outside = await evaluate("({ narration: window.__game.narration?.text ?? null, armed: window.__game.touchArmed })");
  assert.equal(outside.narration, null, "a release outside the canvas cancels the long press");
  assert.equal(outside.armed, null, "a release outside the canvas arms nothing");

  // ---- 844 x 390 landscape
  await viewport(844, 390, true, true);
  await checkFrame(844, 390);
  await screenshot("title-844x390.png");
  await enterScene();
  frame = await checkFrame(844, 390, 8);
  assert.equal(frame.hud, true, "the touch HUD is up in landscape play");
  await screenshot("play-844x390.png");

  // Here the visible action plate itself confirms, not just a second tap on the scene.
  await resetTouchTest();
  pick = await pickHotspot();
  await tap(pick.clientX, pick.clientY);
  assert.equal(await evaluate("window.__game.touchArmed"), pick.id, "landscape first tap arms");
  await screenshot("armed-844x390.png");
  const plate = await buttonRect(".m-action");
  await tap(plate.x, plate.y);
  await until(() => evaluate("window.__game.touchArmed === null"), "action plate confirmation");
  const plateResult = await evaluate(`(() => { const g = window.__game; return { committed: g.committed, verb: g.sentence.verb, path: g.path.length, narration: g.narration?.text ?? null }; })()`);
  assert.ok(plateResult.committed || plateResult.verb || plateResult.path > 0 || plateResult.narration,
    "the action plate confirms the armed action");

  // ---- desktop must keep the desktop UI
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Page.navigate", { url: server.url });
  await until(() => evaluate("Boolean(window.__game) && !document.getElementById('boot')"), "desktop game");
  const desktop = await evaluate(`(() => { const c = document.querySelector("canvas").getBoundingClientRect();
    return { mobile: document.body.classList.contains("mobile"), canvas: { width: c.width, height: c.height, left: c.left, top: c.top, right: c.right, bottom: c.bottom }, vw: innerWidth, vh: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, hasTouchUI: Boolean(document.getElementById("mobile-ui")) }; })()`);
  assert.equal(desktop.mobile, false, "a desktop viewport keeps the desktop UI");
  assert.equal(desktop.hasTouchUI, false, "no touch HUD is built on desktop");
  assert.ok(Math.abs(desktop.canvas.width / desktop.canvas.height - 16 / 9) < 0.01, "desktop canvas stays 16:9");
  assert.ok(desktop.canvas.left >= -0.5 && desktop.canvas.right <= desktop.vw + 0.5 && desktop.canvas.bottom <= desktop.vh + 0.5,
    "desktop canvas still fits");
  assert.ok(desktop.scrollWidth <= desktop.vw + 1, "desktop has no horizontal overflow");

  // The existing browser suite runs its desktop pages at 800x600; that must stay desktop.
  await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: server.url });
  await until(() => evaluate("Boolean(window.__game) && !document.getElementById('boot')"), "800x600 game");
  const smallDesktop = await evaluate(`(() => { const c = document.querySelector("canvas").getBoundingClientRect();
    return { mobile: document.body.classList.contains("mobile"), hasTouchUI: Boolean(document.getElementById("mobile-ui")),
      width: c.width, height: c.height, left: c.left, top: c.top, right: c.right, bottom: c.bottom, vw: innerWidth, vh: innerHeight }; })()`);
  assert.equal(smallDesktop.mobile, false, "an 800x600 desktop window stays on the desktop UI");
  assert.equal(smallDesktop.hasTouchUI, false, "an 800x600 window builds no touch HUD");
  assert.ok(smallDesktop.width > 0 && smallDesktop.right <= smallDesktop.vw + 0.5 && smallDesktop.bottom <= smallDesktop.vh + 0.5,
    "an 800x600 canvas still fits");

  assert.deepEqual(runtimeErrors, [], `page exceptions: ${runtimeErrors.join("; ")}`);
  console.log("mobile browser test passed: 390x844, 844x390, and desktop regression");
  console.log(`screenshots: ${output}`);
} finally {
  socket?.close();
  await browser?.stop();
  await server.stop();
}

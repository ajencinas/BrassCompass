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
const server = await startVite(Number(process.env.MOBILE_TEST_PORT) || 5210, (Number(process.env.MOBILE_TEST_PORT) || 5210) + 20);
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
    const st = document.getElementById("stage").getBoundingClientRect();
    const buttons = [...document.querySelectorAll("#mobile-ui button")].filter(visible).map((b) => {
      const r = b.getBoundingClientRect();
      return { label: b.getAttribute("aria-label") || b.textContent.trim().slice(0, 40), w: r.width, h: r.height };
    });
    return {
      body: document.body.className, vw: innerWidth, vh: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      canvas: { left: c.left, top: c.top, right: c.right, bottom: c.bottom, width: c.width, height: c.height },
      stage: { left: st.left, top: st.top, right: st.right, bottom: st.bottom, width: st.width, height: st.height },
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
    assert.ok(rect, `expected a visible ${selector}; saw ${await evaluate(`[...document.querySelectorAll("#mobile-ui button")].filter(${visible}).map((b) => b.textContent.trim().slice(0, 20)).join("|") + " body=" + document.body.className`)}`);
    return rect;
  }

  /** Text on the touch chrome keeps its floor: 15px for what is read or tapped, 12px for hints. */
  async function checkType(label) {
    const small = await evaluate(`(() => {
      const visible = ${visible};
      const body = ".m-verbs button, .m-narration, .m-line, .m-action, .m-bag, .m-choice, .m-dialogue-text, .m-lesson, .m-primary, .m-title-button .m-title-label";
      const hint = ".m-action-hint, .m-speaker, .m-bag-count, .m-title-sub, .m-pager-label, .m-where";
      const bad = [];
      for (const el of document.querySelectorAll("#mobile-ui " + body)) if (visible(el) && parseFloat(getComputedStyle(el).fontSize) < 14.95) bad.push(el.className + " " + getComputedStyle(el).fontSize);
      for (const el of document.querySelectorAll("#mobile-ui " + hint)) if (visible(el) && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11.95) bad.push(el.className + " " + getComputedStyle(el).fontSize);
      return bad; })()`);
    assert.deepEqual(small, [], `${label}: text under its floor`);
  }

  /** The portrait scene is a tall crop around Fenn, not a thin strip, and the panel fits under it. */
  async function checkPortraitScene(label, vh) {
    const m = await evaluate(`(() => {
      const g = window.__game;
      const st = document.getElementById("stage").getBoundingClientRect();
      const c = g.view.canvas.getBoundingClientRect();
      const hud = document.querySelector(".m-hud").getBoundingClientRect();
      const fx = c.left + ((g.x - g.cameraX) / 1920) * c.width, fy = c.top + (g.y / 880) * c.height;
      const verbs = [...document.querySelectorAll(".m-verbs button")].map((b) => b.getBoundingClientRect());
      const bag = document.querySelector(".m-bag").getBoundingClientRect();
      return { st: { t: st.top, b: st.bottom, l: st.left, r: st.right, h: st.height }, c: { l: c.left, r: c.right, w: c.width, h: c.height },
        hudTop: hud.top, fenn: { x: fx, y: fy }, vw: innerWidth, vh: innerHeight,
        verbsBottom: Math.max(...verbs.map((r) => r.bottom)), verbsLeft: Math.min(...verbs.map((r) => r.left)), verbsRight: Math.max(...verbs.map((r) => r.right)),
        bagBottom: bag.bottom, bagTop: bag.top, covered: g.view.visible };
    })()`);
    assert.ok(m.st.h >= Math.min(0.5 * vh, vh - 52 - 292) - 2, `${label}: portrait scene uses the height (${m.st.h}px of ${vh})`);
    assert.ok(m.hudTop >= m.st.b - 1, `${label}: the panel starts under the scene`);
    assert.ok(m.fenn.x > m.st.l && m.fenn.x < m.st.r && m.fenn.y > m.st.t && m.fenn.y < m.st.b, `${label}: Fenn is inside the visible crop ${JSON.stringify(m.fenn)}`);
    assert.ok(m.verbsBottom <= m.bagTop + 0.5 && m.bagBottom <= m.vh + 0.5, `${label}: verbs and satchel fit on screen`);
    assert.ok(m.verbsLeft >= 0 && m.verbsRight <= m.vw + 0.5, `${label}: verbs fit the width`);
    return m;
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
    // A portrait crop makes the canvas wider than the screen on purpose; the stage that clips it
    // is what must fit, and the canvas must cover that stage completely.
    assert.ok(state.stage.left >= -0.5 && state.stage.top >= -0.5 &&
      state.stage.right <= state.vw + 0.5 && state.stage.bottom <= state.vh + 0.5,
      `stage fits ${width}x${height}: ${JSON.stringify(state.stage)}`);
    assert.ok(state.canvas.top >= -0.5 && state.canvas.bottom <= state.vh + 0.5 &&
      state.canvas.left <= state.stage.left + 1 && state.canvas.right >= state.stage.right - 1,
      `canvas covers its stage at ${width}x${height}: ${JSON.stringify(state.canvas)}`);
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
      // A portrait crop shows only a slice of the width: pick a thing whose centre is in view.
      const st = document.getElementById("stage").getBoundingClientRect();
      const cr = g.view.canvas.getBoundingClientRect();
      const inView = (h) => { const c = areaCentre(h.area);
        const px = cr.left + ((c.x - g.cameraX) / 1920) * cr.width, py = cr.top + (c.y / 880) * cr.height;
        return px > st.left + 24 && px < st.right - 24 && py > st.top + 24 && py < st.bottom - 24; };
      // Landscape shows the whole width: any thing will do, clamped onto the screen as before.
      const seen = candidates.filter(inView);
      if (!seen.length && g.view.visible.w >= 1920) seen.push(...candidates);
      const raw = seen.find((h) => g.hotspotAt(areaCentre(h.area).x, areaCentre(h.area).y)) || seen[0];
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
        logicalX: x, logicalY: Math.max(4, Math.min(876, c.y)),
      };
    })()`);
  }

  /** A finger dragging across the scene: touchStart, a few touchMoves, touchEnd. */
  async function drag(x0, y0, x1, y1) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y: y0 + ((y1 - y0) * i) / 8, id: 1 }] });
      await pause(16);
    }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await pause(120);
  }

  /** Portrait shows a crop: drag the scene until some touchable thing is in the window. */
  async function bringSomethingIntoView() {
    const want = await evaluate(`(() => {
      const g = window.__game; const st = document.getElementById("stage").getBoundingClientRect(); const cr = g.view.canvas.getBoundingClientRect();
      const mid = (a) => a.rect ? { x: a.rect.x + a.rect.w / 2, y: a.rect.y + a.rect.h / 2 } : { x: a.reduce((s, p) => s + p.x, 0) / a.length, y: a.reduce((s, p) => s + p.y, 0) / a.length };
      const list = g.visibleHotspots().filter((h) => !g.isExit(g.hotspotState(h))).map((h) => { const c = mid(h.area);
        return { px: cr.left + ((c.x - g.cameraX) / 1920) * cr.width, y: st.top + st.height / 2 }; });
      if (!list.length) return null;
      const centre = (st.left + st.right) / 2;
      list.sort((a, b) => Math.abs(a.px - centre) - Math.abs(b.px - centre));
      return { dx: Math.max(-(st.width - 60), Math.min(st.width - 60, centre - list[0].px)), y: list[0].y, centre, w: st.width };
    })()`);
    if (!want || Math.abs(want.dx) < 8) return;
    await drag(want.centre - want.dx / 2, want.y, want.centre + want.dx / 2, want.y);
    // Still not in the window (it is past the room's scroll limit): walk Fenn to it, as a player would.
    const near = await evaluate(`(() => {
      const g = window.__game; const st = document.getElementById("stage").getBoundingClientRect(); const cr = g.view.canvas.getBoundingClientRect();
      const mid = (a) => a.rect ? a.rect.x + a.rect.w / 2 : a.reduce((s, p) => s + p.x, 0) / a.length;
      const list = g.visibleHotspots().filter((h) => !g.isExit(g.hotspotState(h)));
      const shown = list.some((h) => { const px = cr.left + ((mid(h.area) - g.cameraX) / 1920) * cr.width; return px > st.left + 40 && px < st.right - 40; });
      if (shown || !list.length) return false;
      g.x = mid(list[0].area) + 140; window.__ff(80); return true; })()`);
    if (near) await pause(900);
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
  const tall = await checkPortraitScene("390x844", 844);
  assert.ok(tall.st.h >= 0.45 * 844, `the 390x844 scene is at least 45% of the screen tall (${tall.st.h}px)`);
  assert.ok(tall.c.w > tall.st.r - tall.st.l + 50, "the portrait canvas is wider than its stage: a crop, not a strip");
  await checkType("portrait play");
  // The first-watch lesson lives in the panel under the scene, not over the painting.
  await evaluate(`(() => { const g = window.__game; g.explore = false; g.watch.offer("keys"); window.__ff(2); return true; })()`);
  await pause(300);
  const lesson = await evaluate(`(() => { const l = document.querySelector(".m-lesson"); const r = l.getBoundingClientRect();
    const st = document.getElementById("stage").getBoundingClientRect(); return { hidden: l.hidden, top: r.top, stageBottom: st.bottom, text: l.textContent }; })()`);
  assert.equal(lesson.hidden, false, "the lesson is showing");
  assert.ok(lesson.top >= lesson.stageBottom - 1, "the lesson toast does not cover the scene");
  assert.match(lesson.text, /Tap a thing to name it, tap again to act/, "the touch lesson teaches taps, not keys");
  assert.doesNotMatch(lesson.text, /\bQ\b|Esc|\bJ\b/, "no keyboard shortcuts on touch");
  await evaluate("(() => { const g = window.__game; g.watch.clearQueue(); g.explore = true; return true; })()");
  await pause(300); // the Scenes icon comes back and the bar re-centres; let it settle before tapping

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
  // Opening and closing the drawer plays the satchel flap, as the desktop satchel does.
  await evaluate(`(() => { const g = window.__game; window.__flap = []; const was = g.audio.inventory.bind(g.audio);
    g.audio.inventory = (open) => { window.__flap.push(open); return was(open); }; return true; })()`);
  await tap(bag.x, bag.y);
  await until(() => evaluate("!document.querySelector('.m-drawer').hidden"), "satchel drawer");
  assert.deepEqual(await evaluate("window.__flap"), [true], "opening the drawer plays the satchel flap");
  const drawer = await evaluate(`(() => { const d = document.querySelector(".m-drawer");
    return [...d.querySelectorAll("button")].filter((b) => b.offsetParent !== null).map((b) => ({ label: b.textContent.trim(), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })); })()`);
  for (const button of drawer) {
    assert.ok(button.h >= 43.5, `drawer "${button.label}" is ${button.h}px tall`);
    assert.ok(button.w >= 43.5, `drawer "${button.label}" is ${button.w}px wide`);
  }
  const drawerDone = await buttonRect(".m-drawer-close");
  await tap(drawerDone.x, drawerDone.y);
  await until(() => evaluate("document.querySelector('.m-drawer').hidden"), "closed satchel drawer");
  assert.deepEqual(await evaluate("window.__flap"), [true, false], "closing the drawer plays the flap back");

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
  // The portrait scene is a crop around Fenn: a finger drag looks around without arming or walking.
  const before = await evaluate("({ x: window.__game.view.visible.x, fenn: window.__game.x, armed: window.__game.touchArmed })");
  await drag(300, 330, 120, 330);
  const after = await evaluate("({ x: window.__game.view.visible.x, fenn: window.__game.x, armed: window.__game.touchArmed, path: window.__game.path.length })");
  assert.ok(Math.abs(after.x - before.x) > 40 || after.x === 1920 - await evaluate("window.__game.view.visible.w"), `dragging the scene pans the crop (${before.x} -> ${after.x})`);
  assert.equal(after.fenn, before.fenn, "a look-around drag does not walk Fenn");
  assert.equal(after.armed, null, "a look-around drag arms nothing");
  await bringSomethingIntoView();
  await resetTouchTest();
  // The bounce - a second tap inside the gesture's window must not spend the arm - is a
  // question about the game's own clock, so it is asked inside the page: two taps a few
  // milliseconds apart, which no loaded machine can fail to deliver. The touch EVENT layer is
  // covered below (a real tap arms the thing, and a later real tap confirms it).
  const pick = await pickHotspot();
  assert.ok(pick, "a scene has a touchable thing");
  const bounce = await evaluate(`(() => {
    const g = window.__game;
    const at = { x: ${Math.round(pick.logicalX)}, y: ${Math.round(pick.logicalY)} };
    // This is a phone: the grammar under test is the touch one.
    g.touch = true;
    g.onClick(at.x, at.y, 0, 1);
    const armed = g.touchArmed;
    // The action plate is part of the touch chrome, so the chrome has to draw it. The clock
    // helper steps the game, not the chrome, so the chrome is asked directly.
    g.mobileUI.sync(g.mobileState());
    const plateUp = !document.querySelector(".m-action").hidden;
    const age = performance.now() - g.touchArmedAt;
    // The second tap, well inside the window.
    g.onClick(at.x, at.y, 0, 1);
    const bounced = {
      armed: g.touchArmed, committed: g.committed, verb: g.sentence.verb,
      path: g.path.length, age,
    };
    // And now a tap AFTER the window: that one must confirm.
    g.touchArmedAt = performance.now() - 5000;
    g.onClick(at.x, at.y, 0, 1);
    const confirmed = { armed: g.touchArmed, committed: g.committed, verb: g.sentence.verb, path: g.path.length };
    return { armed, plateUp, bounced, confirmed, id: ${JSON.stringify(pick.id)} };
  })()`);
  assert.equal(bounce.armed, bounce.id, "the first tap arms the thing it hit");
  assert.ok(bounce.plateUp, "arming shows an action plate");
  assert.equal(bounce.bounced.armed, bounce.id, "a second tap inside the window does not spend the arm");
  assert.equal(bounce.bounced.committed, null, "a quick double tap does not confirm the armed action");
  assert.equal(bounce.bounced.verb, null, "a quick double tap runs nothing");
  assert.equal(bounce.bounced.path, 0, "a quick double tap does not walk Fenn");
  assert.ok(bounce.bounced.age < 400, `the arm was inside its window (${bounce.bounced.age.toFixed(0)} ms)`);
  assert.equal(bounce.confirmed.armed, null, "a later tap spends the arm");
  assert.ok(bounce.confirmed.committed || bounce.confirmed.verb || bounce.confirmed.path > 0,
    "a later tap confirms the action");

  // The same grammar through the real touch events: a tap arms and shows the plate, and a
  // later tap confirms it.
  await resetTouchTest();
  await tap(pick.clientX, pick.clientY);
  await until(() => evaluate("window.__game.touchArmed !== null"), "a real tap arms the thing");
  const armed = await evaluate(`(() => { const g = window.__game; const a = document.querySelector(".m-action");
    return { touchArmed: g.touchArmed, hidden: a.hidden, text: a.innerText,
      height: a.getBoundingClientRect().height }; })()`);
  assert.equal(armed.touchArmed, pick.id, "a real tap arms the thing it hit");
  assert.equal(armed.hidden, false, "arming shows an action plate");
  assert.ok(armed.text.toLowerCase().includes(pick.name.toLowerCase()), `action plate names the thing: ${armed.text}`);
  assert.ok(armed.height >= 43.5, "the action plate is a touch target");
  await screenshot("armed-390x844.png");
  await pause(500);
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
  const landPick = await pickHotspot();
  await tap(landPick.clientX, landPick.clientY);
  assert.equal(await evaluate("window.__game.touchArmed"), landPick.id, "landscape first tap arms");
  await screenshot("armed-844x390.png");
  const plate = await buttonRect(".m-action");
  await tap(plate.x, plate.y);
  await until(() => evaluate("window.__game.touchArmed === null"), "action plate confirmation");
  const plateResult = await evaluate(`(() => { const g = window.__game; return { committed: g.committed, verb: g.sentence.verb, path: g.path.length, narration: g.narration?.text ?? null }; })()`);
  assert.ok(plateResult.committed || plateResult.verb || plateResult.path > 0 || plateResult.narration,
    "the action plate confirms the armed action");

  // The 12 verbs must all be on screen and reachable in landscape (no hidden horizontal strip),
  // the stage must be big enough to play, and narration / Continue must stay inside their panel.
  await resetTouchTest();
  await evaluate(`(() => { const g = window.__game; g.narration = { text: "The harbour is thick with fog tonight, and every rope on the quay is wet to the touch.", shown: 999 };
    window.__ff(1);
    // The clock helper steps the game, not the touch chrome: the panel's own state (and so its
    // visibility) is drawn by the chrome, which has to be asked.
    g.mobileUI.sync(g.mobileState());
    return null; })()`);
  const landscapeLayout = await evaluate(`(() => {
    const visible = ${visible};
    const verbs = [...document.querySelectorAll(".m-verbs button")].map((b) => { const r = b.getBoundingClientRect(); return { label: b.textContent, l: r.left, r: r.right, t: r.top, b: r.bottom, vis: visible(b) }; });
    const c = document.querySelector("canvas").getBoundingClientRect();
    return { verbs, vw: innerWidth, vh: innerHeight, stageH: c.height, stageW: c.width };
  })()`);
  assert.equal(landscapeLayout.verbs.length, 12, "all twelve verbs exist");
  for (const v of landscapeLayout.verbs) {
    assert.ok(v.vis && v.l >= 0 && v.r <= landscapeLayout.vw + 0.5 && v.t >= 0 && v.b <= landscapeLayout.vh + 0.5,
      `landscape verb "${v.label}" is fully on screen: ${JSON.stringify(v)}`);
  }
  assert.ok(landscapeLayout.stageH >= 250, `landscape scene is big enough to play (${landscapeLayout.stageH}px tall)`);
  const overlap = await evaluate(`(() => {
    const c = document.querySelector("canvas").getBoundingClientRect();
    const ctx = document.querySelector(".m-context").getBoundingClientRect();
    return { canvasBottom: c.bottom, contextTop: ctx.top };
  })()`);
  assert.ok(overlap.contextTop >= overlap.canvasBottom - 0.5,
    `narration panel sits under the scene, not over it: ${JSON.stringify(overlap)}`);
  await resetTouchTest();

  // ---- rotating a phone updates the layout: boot portrait, turn it, turn it back.
  await viewport(390, 844, true, true);
  await enterScene();
  const portraitLeft = await evaluate("document.querySelector('canvas').getBoundingClientRect().height");
  assert.equal(await evaluate("document.body.classList.contains('m-landscape')"), false, "boots portrait");
  async function rotate(width, height) {
    await send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 2, mobile: true,
      screenOrientation: { type: width > height ? "landscapePrimary" : "portraitPrimary", angle: width > height ? 90 : 0 },
    });
    await pause(300);
  }
  await rotate(844, 390);
  assert.equal(await evaluate("document.body.classList.contains('m-landscape')"), true, "rotating to landscape flips the class");
  const turned = await evaluate(`(() => { const c = document.querySelector("canvas").getBoundingClientRect(); const v = document.querySelector(".m-verbs").getBoundingClientRect();
    return { canvasW: c.width, canvasH: c.height, vw: innerWidth, verbsLeft: v.left, verbsTop: v.top }; })()`);
  assert.ok(turned.canvasW < turned.vw - 150, `landscape leaves a rail beside the scene (canvas ${turned.canvasW} of ${turned.vw})`);
  assert.ok(turned.verbsLeft >= turned.canvasW - 1, "the verb rail is beside the scene, not under it");
  await screenshot("rotated-844x390.png");
  await rotate(390, 844);
  assert.equal(await evaluate("document.body.classList.contains('m-landscape')"), false, "rotating back flips the class back");
  const back = await evaluate("document.querySelector('canvas').getBoundingClientRect().height");
  assert.ok(Math.abs(back - portraitLeft) < 2, `portrait scene returns to its size (${back} vs ${portraitLeft})`);
  await checkFrame(390, 844, 8);

  // ---- small phones, both ways: the scene, the panel and every verb fit, and type keeps its floor.
  for (const [w, h] of [[360, 640], [320, 568]]) {
    await viewport(w, h, true, true);
    await enterScene();
    await checkFrame(w, h, 8);
    await checkPortraitScene(`${w}x${h}`, h);
    await checkType(`${w}x${h}`);
    await screenshot(`play-${w}x${h}.png`);
  }
  for (const [w, h] of [[667, 375], [568, 320]]) {
    await viewport(w, h, true, true);
    await enterScene();
    await checkFrame(w, h, 8);
    const m = await evaluate(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect();
      const verbs = [...document.querySelectorAll(".m-verbs button")].map((b) => b.getBoundingClientRect());
      return { verbsOk: verbs.length === 12 && verbs.every((v) => v.left >= 0 && v.right <= innerWidth + 0.5 && v.top >= 0 && v.bottom <= innerHeight + 0.5),
        bag: r(".m-bag").bottom <= innerHeight + 0.5, stageH: r("canvas").height }; })()`);
    assert.ok(m.verbsOk && m.bag, `${w}x${h}: every verb and the satchel are on screen`);
    await checkType(`${w}x${h}`);
    await screenshot(`play-${w}x${h}.png`);
  }

  // ---- a conversation keeps the scene in view: landscape puts the choices in the rail, portrait
  // gives them 48px+ targets, and every choice can be reached.
  for (const [w, h] of [[844, 390], [390, 844], [568, 320]]) {
    await viewport(w, h, true, true);
    await enterScene();
    await evaluate(`(() => { const g = window.__game; g.loadRoom("tavern"); window.__ff(30); g.flags.rule_sound = true;
      g.startDialogue("marta", "root3"); g.dialogue.shown = 999; window.__ff(3); return true; })()`);
    await until(() => evaluate("document.querySelectorAll('.m-choice').length >= 6"), `dialogue choices at ${w}x${h}`);
    const d = await evaluate(`(() => {
      const c = document.querySelector("canvas").getBoundingClientRect(), st = document.getElementById("stage").getBoundingClientRect();
      const inner = document.querySelector(".m-dialogue-inner").getBoundingClientRect();
      const list = document.querySelector(".m-choices");
      const lr = list.getBoundingClientRect();
      const choices = [...document.querySelectorAll(".m-choice")].map((b) => b.getBoundingClientRect());
      const last = document.querySelectorAll(".m-choice")[choices.length - 1];
      list.scrollTop = list.scrollHeight; const after = last.getBoundingClientRect();
      const portrait = document.querySelector(".m-portrait").getBoundingClientRect();
      return { stage: { l: st.left, r: st.right, t: st.top, b: st.bottom }, inner: { t: inner.top, l: inner.left, r: inner.right },
        list: { l: lr.left, t: lr.top, b: lr.bottom, scrollable: list.scrollHeight > list.clientHeight + 1 },
        minH: Math.min(...choices.map((r) => r.height)), lastReachable: after.bottom <= innerHeight + 0.5 && after.top >= 0 && after.bottom <= lr.bottom + 1,
        portrait: portrait.width, vw: innerWidth, vh: innerHeight, landscape: document.body.classList.contains("m-landscape") };
    })()`);
    assert.ok(d.minH >= 47.5, `${w}x${h}: dialogue choices are ${d.minH}px tall`);
    assert.ok(d.lastReachable, `${w}x${h}: the last choice is reachable by scrolling`);
    if (d.landscape) {
      assert.ok(d.inner.t >= d.stage.b - 1, `${w}x${h}: the conversation sits under the scene, not over it`);
      assert.ok(d.list.l >= d.stage.r - 1, `${w}x${h}: the choices are in the rail beside the scene`);
      assert.ok(d.portrait >= 80, `${w}x${h}: the portrait is a real portrait (${d.portrait}px)`);
    } else {
      assert.ok(d.inner.t >= d.stage.b - 1, `${w}x${h}: the conversation starts under the scene`);
      assert.ok(d.portrait >= 70, `${w}x${h}: portrait is ${d.portrait}px`);
    }
    await checkType(`${w}x${h} dialogue`);
    await screenshot(`dialogue-${w}x${h}.png`);
  }

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
  console.log("mobile browser test passed: 390x844, 844x390, rotation, and desktop regression");
  console.log(`screenshots: ${output}`);
} finally {
  socket?.close();
  await browser?.stop();
  await server.stop();
}

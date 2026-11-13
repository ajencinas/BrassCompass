/**
 * Every arrow, walked.
 *
 * For every room in the game and every way out in it: stand back from the threshold, click the
 * chevron exactly where it is drawn, and prove that Fenn (a) starts walking and (b) arrives in the
 * room the exit leads to. This is the one contract the arrow has: clicking it is clicking the
 * door. A static audit cannot see it, because the chevron is drawn above the painted area and is
 * not the hotspot itself.
 *
 *   node tools/exit-walk-test.mjs            # human report, exit code 1 on a failure
 *   node tools/exit-walk-test.mjs --json     # machine report
 *   node tools/exit-walk-test.mjs --room dock
 *   node tools/exit-walk-test.mjs --mobile   # the same walk on a portrait phone
 *
 * Dev server and headless Chrome come from tools/browser-env.mjs; the game clock is stepped
 * synchronously (`__ff`), so a whole room change costs milliseconds.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { startVite, startChrome, firstPage, ROOT } from "./browser-env.mjs";

const json = process.argv.includes("--json");
const onlyArg = process.argv.indexOf("--room");
const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : null;
// A portrait phone shows a crop of the scene about a third of the frame's width: the arrow for
// a way out has to land inside that crop, or it cannot be tapped at all.
const mobile = process.argv.includes("--mobile");
const MOBILE = mobile ? "true" : "false";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* not yet */ }
    await pause(100);
  }
  throw new Error("Timed out waiting for " + label);
}

let server, browser, socket;
const failures = [];
const rows = [];
try {
  server = await startVite(5200, 5219);
  browser = await startChrome({
    name: "exitwalk",
    args: [mobile ? "--window-size=390,844" : "--window-size=1920,1080"],
  });
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
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", mobile
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenOrientation: { angle: 0, type: "portraitPrimary" } }
    : { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/${mobile ? "?mobile=1" : "?nomobile=1"}` });
  await until(() => ev("Boolean(window.__game) && !document.getElementById('boot')"), "game");
  await ev("window.__game.title = false; window.__game.newGame(); window.__ff(10);");
  await until(() => ev("typeof window.__prefetchAll === 'function'"), "prefetch hook");
  await ev("window.__prefetchAll()");
  await until(() => ev("window.__game.assets.queue.length === 0 && window.__game.assets.running === 0"), "art", 120000);
  await ev("window.requestAnimationFrame = () => 0;");
  await pause(300);

  // Every room the game has: one .adv script each, named by its id.
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
      window.__ff(20);
      g.narration = null; g.queue = null; g.dialogue = null;
      return g.visibleHotspots().filter((h) => (g.hotspotState(h).do?.walk ?? []).some((e) => e.k === "go"))
        .map((h) => {
          const st = g.hotspotState(h);
          const go = st.do.walk.find((e) => e.k === "go");
          return { id: h.id, to: go.room, name: st.name, stand: st.stand ?? g.areaStand(st.area) };
        });
    })()`);

    // The contract is per ARROW: every arrow the player can see walks Fenn to the door it
    // stands for and takes him through it. An exit that is off the visible window has no arrow
    // of its own - the edge carries one arrow for that direction - so the test also checks
    // that every exit is covered: it either has its own arrow, or there is an arrow pointing
    // the way it is.
    for (const exit of exits) {
      await ev(`(() => {
        const g = window.__game;
        g.loadRoom(${JSON.stringify(roomId)});
        g.narration = null; g.queue = null; g.dialogue = null; g.sentence = { verb: null, a: null, b: null };
        g.title = false; g.fade = 0; g.fadeTarget = 0;
        window.__ff(30);
        g.narration = null; g.queue = null; g.dialogue = null;
        const pts = g.room.walk.flat();
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const dx = cx - ${exit.stand.x}, dy = cy - ${exit.stand.y}, len = Math.hypot(dx, dy) || 1;
        const reach = Math.min(260, len * 0.7);
        g.x = ${exit.stand.x} + (dx / len) * reach;
        g.y = ${exit.stand.y} + (dy / len) * reach;
        g.path = []; g.walkGoal = null; g.onArrive = null; g.running = false;
        const max = Math.max(0, (g.room.width ?? 1920) - 1920);
        g.cameraX = Math.max(0, Math.min(max, g.x - 960)); g.focusCameraX = null;
        window.__ff(3);
        g.narration = null; g.queue = null; g.dialogue = null;
        g.render();
      })()`);

      // On a phone the crop is a third of the frame: the exit may be off the visible slice,
      // and its arrow is then pinned to the edge of that slice. Stand at the far end of the
      // room so the arrow has to travel to the edge to be found.
      if (MOBILE) {
        await ev(`(() => {
          const g = window.__game;
          const hs = g.room.hotspots.find((h) => h.id === ${JSON.stringify(exit.id)});
          const th = g.exitThreshold(g.hotspotState(hs));
          // Stand at the walk point FURTHEST from this way out: on a phone its arrow is then
          // pinned to the edge of the visible slice, which is the case worth testing.
          const pts = g.room.walk.flat();
          const far = pts.reduce((a, b) =>
            (Math.hypot(b.x - th.x, b.y - th.y) > Math.hypot(a.x - th.x, a.y - th.y) ? b : a));
          g.x = far.x; g.y = far.y; g.path = []; g.walkGoal = null; g.onArrive = null;
          g.cameraX = Math.max(0, Math.min(Math.max(0, (g.room.width ?? 1920) - 1920), g.x - 960));
          window.__ff(4);
          g.narration = null; g.queue = null; g.dialogue = null;
          return null;
        })()`);
        // The crop slides on real time, not game time: let it settle.
        await pause(400);
      }

      // The arrows this room is showing, and which way each one points.
      const shown = await ev(`(() => {
        const g = window.__game;
        window.__dbg = [];
        const vis = g.view.visible;
        const left = g.cameraX + vis.x, right = left + vis.w;
        const cues = g.exitChevrons().map((c) => ({
          id: c.hs.id, x: Math.round(c.x - g.cameraX), y: Math.round(c.y), edge: c.edge,
          onScreen: (c.x - g.cameraX) >= vis.x - 1 && (c.x - g.cameraX) <= vis.x + vis.w + 1,
          // Which edge a pinned arrow stands on. It is drawn inside the window, so the side
          // has to come from where it is in the world, not from where it ended up.
          side: !c.edge ? "in"
            : (c.x - g.cameraX) < vis.x + vis.w / 2 ? "left" : "right",
        }));
        const th = g.exitThreshold(g.hotspotState(g.room.hotspots.find((h) => h.id === ${JSON.stringify(exit.id)})));
        return { cues, exitAt: th.x, left, right };
      })()`);

      const own = shown.cues.find((c) => c.id === exit.id);
      if (!own) {
        // Off the visible window: the edge must carry an arrow for that direction.
        const dir = shown.exitAt < shown.left ? "left" : shown.exitAt > shown.right ? "right" : "in";
        const edgeCue = dir === "in" ? null : shown.cues.find((c) => c.side === dir);
        if (!edgeCue) {
          failures.push(`${roomId}.${exit.id}: no arrow for the way out and none for its direction`);
          rows.push({ room: roomId, exit: exit.id, ok: false, why: "no arrow for this direction" });
        } else {
          rows.push({ room: roomId, exit: exit.id, ok: true, coveredBy: edgeCue.id });
        }
        continue;
      }
      // The arrow has to be somewhere the player can see: inside the visible slice.
      if (!own.onScreen) {
        failures.push(`${roomId}.${exit.id}: the arrow is outside the visible slice`);
        rows.push({ room: roomId, exit: exit.id, ok: false, why: "outside the visible slice" });
        continue;
      }

      const shot = await ev(`(() => {
        const g = window.__game;
        const hs = g.room.hotspots.find((h) => h.id === ${JSON.stringify(exit.id)});
        const cue = g.exitChevrons().find((c) => c.hs.id === hs.id);
        if (!cue) return { fail: "no chevron drawn for the way out" };
        const hit = g.exitChevronAt(cue.x - g.cameraX, cue.y);
        if (!hit || hit.id !== hs.id) {
          return { fail: "chevron hit-test does not resolve to the way out",
            cue: { x: Math.round(cue.x), y: Math.round(cue.y), contested: cue.contested },
            cameraX: Math.round(g.cameraX), hit: hit?.id ?? null };
        }
        // Hovering the arrow must name the way out.
        g.onMove(cue.x - g.cameraX, cue.y);
        if (g.hoverHotspot !== hs.id) return { fail: "hovering the arrow does not name the way out" };
        const before = g.room.id;
        g.onClick(cue.x - g.cameraX, cue.y, 0, 1);
        // On touch the first tap only arms: the arrow follows the same grammar as everything
        // else on a phone, so the walk needs the confirming tap as well.
        if (${MOBILE} && g.touchArmed === hs.id) {
          g.touchArmedAt = performance.now() - 5000;
          g.onClick(cue.x - g.cameraX, cue.y, 0, 1);
        }
        const walked = g.path.length > 0 || g.onArrive !== null;
        let frames = 0;
        // A walk across the whole room takes a while: the clock steps 50 ms at a time.
        while (g.room.id === before && frames < 900) { window.__ff(1); frames++; }
        return { walked, room: g.room.id, frames, fade: g.fade, goal: g.walkGoal,
          start: { x: Math.round(g.x), y: Math.round(g.y) } };
      })()`);

      if (shot.fail) {
        failures.push(`${roomId}.${exit.id}: ${shot.fail}`);
        rows.push({ room: roomId, exit: exit.id, ok: false, why: shot.fail });
      } else if (shot.room !== exit.to) {
        failures.push(`${roomId}.${exit.id}: ended in ${shot.room}, expected ${exit.to}`);
        rows.push({ room: roomId, exit: exit.id, ok: false,
          why: `went to ${shot.room}, expected ${exit.to} (goal ${JSON.stringify(shot.goal)})` });
      } else if (!shot.walked) {
        failures.push(`${roomId}.${exit.id}: travelled without walking to the door`);
        rows.push({ room: roomId, exit: exit.id, ok: false, why: "no walk" });
      } else {
        rows.push({ room: roomId, exit: exit.id, ok: true, frames: shot.frames });
      }
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
    else console.log(`ok   ${row.room}.${row.exit} (${row.frames} frames)`);
  }
  console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} ways out walked and taken.`);
}
process.exit(failures.length ? 1 : 0);

/**
 * The state-machine fuzzer's regression suite: a couple of minutes, one tab (npm run test:fuzz).
 *
 *   1. invariants sweep: every (act, room) pair the story can reach, each hotspot with every verb
 *      and every act item, conversations explored, asserting no exceptions, locks, NaN, off-floor,
 *      invalid rooms, unknown items, empty or garbled text, dialogue overflow or stuck dialogue;
 *   2. softlock search for Act II (its whole state space): every state can still finish the act;
 *   3. a short monkey run (random real inputs);
 *   4. one named check per bug the full fuzz found, rewritten for the reboot (The Father and the
 *      Fog): save shape 3 under brasscompass.save.v4, old-story saves restarting the new voyage,
 *      new hotspots/dialogues, and the reboot's act transitions, which have no cinematics.
 *      A check marked `todo` names the fix it waits for: it runs and reports, but can't fail the
 *      suite. Make it a plain check once that fix is merged.
 *
 * NOTE FOR ANY AUTOMATED DRIVER: Continue (and Enter on the title) puts up the "Previously" recap
 * card, which holds the room until the player presses "Set sail" (Enter). A driver that clicks
 * Continue and then waits for the room without pressing Set sail will wait forever; see
 * tools/playthrough.mjs ("Set sail") and the monkey in lib/inpage.js for the press.
 *
 *   npm run test:fuzz                                    # starts this checkout's dev server
 *   FUZZ_URL=http://127.0.0.1:5173/ node tools/fuzz/regression.mjs   # or fuzz one already running
 *
 * lib/inpage.js is injected into the page and drives the game clock itself (update(0.05)). It
 * needs the dev server's hooks: window.__game, and Game.devSnapshot()/devRestore().
 */
import assert from "node:assert/strict";
import { Browser, waitForGame, pause, until } from "./lib/cdp.mjs";
import { gameServer, openGamePage } from "./lib/pool.mjs";

const HARD = new Set(["input-locked>10s", "walk-never-arrives", "queue-never-drains", "settle-timeout", "nan-state", "off-floor",
  "camera-out-of-range", "room-not-in-act", "unknown-item", "duplicate-item", "idle-but-locked", "empty-text", "bad-token-in-text",
  "article-doubling", "unbalanced-quotes", "more-than-9-choices", "dialogue-overflow", "unknown-speaker", "advance-does-not-move",
  "leave-does-not-close", "dialogue-node-missing", "persist-gap", "runToEnd-guard", "ending-without-lines", "all-choices-hidden", "no-tip"]);

const failures = [], todoFailing = [], todoPassing = [];
/** Run one named check. With `todo`, a failure is reported against that fix and doesn't count. */
async function check(name, fn, { todo } = {}) {
  const t0 = Date.now();
  const took = () => `(${((Date.now() - t0) / 1000).toFixed(1)} s)`;
  try {
    await fn();
    if (todo) todoPassing.push(name);
    console.log(`  ok   ${name} ${took()}${todo ? `   [todo: ${todo} — passes now, make it a plain check]` : ""}`);
  } catch (e) {
    const why = e.message.split("\n").slice(0, 6).join("\n       ");
    if (todo) { todoFailing.push(name); console.log(`  todo ${name} ${took()}   [waits for ${todo}]\n       ${why}`); }
    else { failures.push(name); console.log(`  FAIL ${name} ${took()}\n       ${why}`); }
  }
}

const server = await gameServer();
const browser = await Browser.launch();
try {
  const page = await openGamePage(browser, { url: server.url });
  const ev = (x) => page.evaluate(x, { timeout: 600000 });
  // The harness drives a synthetic clock; use the old automatic pace so queued effects drain
  // without a player click. The shipped default stays wait-for-click.
  await page.evaluate("window.__game.prefs.waitForClick = false");

  console.log(`invariants sweep (${server.url})`);
  // Every room the reboot's reach map puts in an act: Act I's island, Act II's Marrow, Act III's
  // Shroud and Act IV's Grey Lantern. The old sample's Act IV island rooms are no longer reachable.
  const sample = [
    [1, "dock"], [1, "tavern"], [1, "office"], [1, "alley"], [1, "village"], [1, "pier_end"],
    [1, "warehouse"], [1, "counting_house"], [1, "chandlery"], [1, "weather_works"],
    [2, "marrow_deck"], [2, "below_decks"], [2, "bow_fog"], [2, "marrow_quarterdeck"],
    [2, "marrow_cabin"], [2, "crows_nest"], [2, "marrow_gallery"],
    [3, "lagoon_shore"], [3, "reef_wreck"], [3, "key_gate"], [3, "salt_camp"], [3, "far_pans"],
    [4, "lantern_deck"], [4, "arcadia_cabin"],
  ];
  for (const [act, room] of sample) {
    await check(`act ${act} ${room}: every hotspot x verb, every act item`, async () => {
      const r = await ev(`window.__fz.phaseA(${act}, ${JSON.stringify(room)})`);
      const bad = [];
      for (const f of [r.setup, ...r.findings].filter(Boolean)) {
        for (const a of f.anomalies) if (HARD.has(a.kind)) bad.push(`${f.id}: ${a.kind} ${JSON.stringify(a.detail).slice(0, 200)}`);
        for (const e of f.errors) bad.push(`${f.id}: ${e.where}: ${e.message}`);
      }
      assert.deepEqual(bad.slice(0, 5), [], `${bad.length} problems`);
    });
  }

  console.log("reachability");
  await check("every act's start room is in that act's reachable set", async () => {
    const r = await ev(`Object.fromEntries(Object.entries(__fz.M.ACTS).map(([n, a]) => [n, { start: a.start.room, ok: __fz.validRooms[n]?.has(a.start.room) === true, rooms: [...(__fz.validRooms[n] ?? [])] }]))`);
    for (const [n, v] of Object.entries(r)) {
      assert.equal(v.ok, true, `act ${n} starts in ${v.start}, which its reach map does not list`);
      assert.ok(v.rooms.length > 0, `act ${n} reaches no rooms`);
    }
  });

  console.log("softlocks");
  // Act I's crew chain is wide: depth-first reaches its end in the budget, and the fuzzer
  // separates states left unexpanded (unresolved) from states whose explored exits really
  // dead-end (stuck), so a partial search still means something. Acts II and III finish
  // breadth-first; Act IV is small. Every act's checked states must reach its end.
  const softlocks = [
    { act: 1, opts: "{ maxStates: 5000, maxMs: 120000, order: \"dfs\" }" },
    { act: 2, opts: "{ maxStates: 2000, maxMs: 120000 }" },
    { act: 3, opts: "{ maxStates: 3000, maxMs: 120000 }" },
    { act: 4, opts: "{ maxStates: 3000, maxMs: 30000 }" },
  ];
  for (const { act, opts } of softlocks) {
    await check(`act ${act}: every explored state can still finish the act`, async () => {
      const r = await ev(`(() => {
        const fz = window.__fz, old = { ...fz.opts };
        fz.opts.dlgCap = 60; fz.opts.settleSteps = 2500;
        try { return fz.phaseB(${act}, ${opts}); } finally { Object.assign(fz.opts, old); }
      })()`);
      const bad = r.findings.flatMap((f) => [
        ...f.anomalies.filter((a) => HARD.has(a.kind)).map((a) => a.kind + " " + JSON.stringify(a.detail).slice(0, 160)),
        ...f.errors.map((e) => "error " + e.where + ": " + e.message),
      ]);
      assert.deepEqual(bad.slice(0, 5), [], `${bad.length} problems`);
      assert.ok(r.goalStates > 0, "act end never reached within the budget");
      assert.equal(r.stuck, 0, JSON.stringify(r.stuckExamples.slice(0, 3)));
      if (!r.complete) console.log(`       (bounded: ${r.expanded} expanded, ${r.unresolved} unresolved, ${r.frontierLeft} left)`);
    });
  }

  console.log("monkey");
  await check("60 random-input runs: no exceptions or invariant breaks", async () => {
    const runs = await ev(`Array.from({ length: 60 }, (_, i) => window.__fz.monkey(9000 + i, { steps: 250 }))`);
    const bad = runs.flatMap((r) => [...r.anomalies.map((a) => `seed ${r.seed}: ${a.kind} ${JSON.stringify(a.detail).slice(0, 1200)}`), ...r.errors.map((e) => `seed ${r.seed}: ${e.where}: ${e.message}`)]);
    assert.deepEqual(bad.slice(0, 5), [], `${bad.length} problems`);
  });

  console.log("bugs the full fuzz found");
  await check("BUG-1 Use/item/target clicked while walking to something else does what was clicked", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(1); fz.runToEnd(P, { explore: false });
      g.devGoRoom("chandlery"); fz.runToEnd(P, { explore: false });
      // The crowbar is on the shipwright's counter; using it on the mast joins Hobb. Start at the
      // far end of the shop so the first Look is a real walk, then swap to Use/crowbar/mast while
      // that walk is still under way. The old crate's rum became this check's observable result.
      g.inventory = ["compass", "crowbar"]; g.inventoryPage = 0; g.persist();
      g.x = 1500; g.y = 856; g.cameraX = 540;
      const steps = (n) => { for (let i = 0; i < n; i++) g.update(0.05); };
      const mastHs = g.room.hotspots.find((h) => h.id === "mast");
      const rc = mastHs.area.rect;
      const point = () => ({ x: rc.x + rc.w / 2 - g.cameraX, y: rc.y + rc.h / 2 });
      g.setVerb("look"); g.onClick(point().x, point().y, 0, 1); steps(3);
      const walking = g.path.length > 0;
      g.onClick(390, 960, 0, 1); steps(3);                       // Use
      g.onClick(1010 + 215 + 102, 918 + 37, 0, 1); steps(3);    // crowbar (slot 2)
      g.onClick(point().x, point().y, 0, 1);                     // mast
      fz.runToEnd(P, { explore: false });
      return { walking, hobb: g.flags.hobb_joined === true, narration: g.narration?.text, room: g.room.id };
    })()`);
    assert.equal(r.walking, true, "the first Look did not walk");
    assert.equal(r.hobb, true, r.narration);
    assert.equal(r.room, "chandlery");
  });

  await check("BUG-2 Continue on a save holding a room scene's queue says its line once", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(3); fz.runToEnd(P, { explore: false });
      // The castaway camp's arrival runs three lines and then opens Elias. Walk in with a line
      // already on screen so the scene parks behind it, exactly as a quit there would.
      g.speak("I keep walking, because stopping would mean deciding.");
      g.goRoom("salt_camp");
      fz.stepUntil(() => g.room.id === "salt_camp" && g.fade < 0.5, 2000);
      const queued = g.queue?.length ?? 0;
      const says = []; const prev = g.trace; g.trace = (e) => { if (e.kind === "say") says.push(e.text); prev(e); };
      g.title = true; g.titleActivate("continue"); if (g.recap?.open) g.recap.sail(); fz.stepUntil(() => g.dialogue !== null, 4000);
      g.trace = prev;
      return { queued, says, talking: g.dialogue?.tree.id ?? null };
    })()`);
    assert.ok(r.queued > 0, "the scene left nothing queued to continue");
    assert.equal(new Set(r.says).size, r.says.length, "spoken twice: " + JSON.stringify(r.says));
    assert.equal(r.talking, "elias", "the scene's conversation still opens");
  });

  await check("BUG-2b effects started while others are still waiting line up behind them (none are lost)", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(1); fz.runToEnd(P, { explore: false });
      g.clearSentence();
      const says = []; const prev = g.trace; g.trace = (e) => { if (e.kind === "say") says.push(e.text); prev(e); };
      g.speak("One.");
      g.runEffects([{ k: "say", text: "Two." }, { k: "flag", id: "fz_two", v: true }]);
      g.runEffects([{ k: "say", text: "Three." }, { k: "flag", id: "fz_three", v: true }]);
      const atOnce = [g.flags.fz_two, g.flags.fz_three];
      fz.stepUntil(() => !g.queue, 2000);
      g.trace = prev;
      return { says, atOnce };
    })()`);
    assert.deepEqual(r.says, ["One.", "Two.", "Three."]);
    assert.deepEqual(r.atOnce, [true, true], "state changes still apply at once");
  });

  await check("BUG-3 a saved queue can't add an unknown item (legacy 'give mushroom')", async () => {
    const r = await ev(`(() => {
      const g = __game;
      localStorage.setItem("brasscompass.save.v4", JSON.stringify({ version: 3, room: "tavern", x: 1500, y: 800, facing: 1, flags: { met_vex: true }, inventory: ["compass", "crowbar"], act: 1, notes: [], actStarted: true,
        queue: [{ k: "say", text: "x" }, { k: "give", item: "mushroom" }] }));
      g.hasSave = true; g.title = true; g.titleActivate("continue"); if (g.recap?.open) g.recap.sail(); __fz.settle(__fz.newProbe("r"));
      return [...g.inventory];
    })()`);
    assert.deepEqual(r.filter((id) => id === "mushroom"), [], JSON.stringify(r));
  });

  await check("BUG-4 a saved queue can't end the game ('act 9' from a damaged save)", async () => {
    const r = await ev(`(() => {
      const g = __game;
      localStorage.setItem("brasscompass.save.v4", JSON.stringify({ version: 3, room: "tavern", x: 1500, y: 800, facing: 1, flags: {}, inventory: ["compass"], act: 1, notes: [], actStarted: true,
        queue: [{ k: "say", text: "x" }, { k: "act", n: 9 }] }));
      g.hasSave = true; g.title = true; g.titleActivate("continue"); if (g.recap?.open) g.recap.sail(); for (let i = 0; i < 400; i++) g.update(0.05);
      const won = g.won; g.won = false; return { won, act: g.act };
    })()`);
    assert.equal(r.won, false, "the ending card showed in Act I");
    assert.equal(r.act, 1);
  });

  await check("BUG-5 fallback lines never end a name with '..' (new Act IV hotspots)", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(4); fz.runToEnd(P, { explore: false });
      const out = [];
      for (const room of ["lantern_deck", "arcadia_cabin"]) {
        if (g.room.id !== room) { g.devGoRoom(room); fz.runToEnd(P, { explore: false }); }
        const base = fz.snap();
        // One can't-reach hotspot per room is enough to rotate the fallback variants; the old
        // counting_door and its "Cray & Co.." are gone.
        const hss = g.visibleHotspots().filter((h) => !g.isExit(g.hotspotState(h))).slice(0, 3);
        for (let n = 0; n < 3; n++) {
          for (const h of hss) {
            for (const it of ["compass", "crowbar", "nameplate"]) for (const verb of ["give", "use"])
              out.push(fz.probe(base, { kind: "itemOn", verb, item: it, hs: h.id, explore: false }).narration);
            for (const verb of ["talk", "push", "pull", "turnon"])
              out.push(fz.probe(base, { kind: "verb", verb, hs: h.id, explore: false }).narration);
          }
        }
      }
      fz.cur = null;
      return out.filter(Boolean);
    })()`);
    assert.deepEqual([...new Set(r.filter((t) => (t ?? "").replace(/\.\.\.+/g, "").includes("..")))].slice(0, 3), []);
  });

  await check("Act IV item-on-target attempts do the job, not just refuse", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(4); fz.runToEnd(P, { explore: false });
      const base = fz.snap();
      const out = {};
      let p = fz.probe(base, { kind: "itemOn", verb: "use", item: "crowbar", hs: "bell", explore: false });
      out.bell = { cut: g.flags.bell_cut === true, tam: g.flags.tam_freed === true, narration: p.narration };
      fz.restore(base, { persist: false });
      p = fz.probe({ ...base, inventory: [...base.inventory, "lantern"] },
        { kind: "itemOn", verb: "use", item: "lantern", hs: "great_lantern", explore: false });
      out.lantern = { doused: g.flags.lantern_doused === true, kept: g.inventory.includes("lantern"), narration: p.narration };
      fz.restore(base, { persist: false });
      g.devGoRoom("arcadia_cabin"); fz.runToEnd(P, { explore: false });
      p = fz.probe(fz.snap(), { kind: "itemOn", verb: "use", item: "nameplate", hs: "nameplate", explore: false });
      out.name = { spoken: g.flags.name_spoken === true, talks: p.outcome.dialogues ?? [], narration: p.narration };
      fz.cur = null;
      return out;
    })()`);
    assert.equal(r.bell.cut && r.bell.tam, true, JSON.stringify(r.bell));
    assert.equal(r.lantern.doused, true, JSON.stringify(r.lantern));
    assert.equal(r.lantern.kept, false, "the canvas was not handed over");
    assert.equal(r.name.spoken, true, JSON.stringify(r.name));
    assert.ok(r.name.talks.some((id) => id.startsWith("mordant")), JSON.stringify(r.name));
  });

  // A save notice counts as read while its banner is on screen (g.saveNoticeShown()).
  const noticeWatch = (pattern) => `let T = 0, firstSeen = null, visible = 0, text = "";
      const step = (n) => { for (let i = 0; i < n; i++) { g.update(0.05); T += 0.05;
        const s = g.saveNotice; if (s && ${pattern}.test(s.text) && g.saveNoticeShown()) { text = s.text; firstSeen ??= T; visible += 0.05; } } };`;
  await check("BUG-6 the corrupt-save warning stays up long enough to read, whatever the player does", async () => {
    const r = await ev(`(() => {
      const g = __game;
      for (const k of Object.keys(localStorage)) if (k.startsWith("brasscompass.save")) localStorage.removeItem(k);
      localStorage.setItem("brasscompass.save.v4", '{"room":"dock","flags":{');
      g.hasSave = true; g.title = true; g.titleActivate("continue"); if (g.recap?.open) g.recap.sail();
      ${noticeWatch("/notebook/")}
      step(20);
      // The player gets on at once: a click on the first thing in reach (its line replaces the caption).
      const h = g.room?.hotspots?.[0];
      if (h) g.onHotspotClick(g.hotspotState(h), 1);
      step(600);
      return { firstSeen, visible, len: text.length, inLog: g.history.lines.some((l) => /notebook/.test(l.text)),
        backup: localStorage.getItem("brasscompass.save.v4.corrupt"),
        archive: (() => { try { return JSON.parse(localStorage.getItem("brasscompass.save.archive") || "[]"); } catch { return []; } })() };
    })()`);
    assert.ok(r.firstSeen !== null && r.firstSeen < 1, "not shown at once: " + JSON.stringify(r));
    assert.ok(r.visible >= r.len / 18, `on screen for ${r.visible.toFixed(2)} s`);
    assert.equal(r.inLog, true, "kept in the log (L)");
    // The save/persistence pass keeps an unreadable save as a "corrupt" page in the archive (the
    // single `.corrupt` key is only read, for saves an older build wrote).
    const kept = r.backup === '{"room":"dock","flags":{' || r.archive.some((page) => page.reason === "corrupt" && page.raw === '{"room":"dock","flags":{');
    assert.equal(kept, true, "the unreadable save is kept aside");
  });

  await check("BUG-6b 'my progress is not being saved' stays up long enough to read while play goes on", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(1); fz.runToEnd(P, { explore: false });
      g.devGoRoom("tavern"); fz.runToEnd(P, { explore: false });
      ${noticeWatch("/won't take ink/")}
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException("quota", "QuotaExceededError"); };
      try {
        const click = (id, verb) => { if (verb) g.setVerb(verb); g.onHotspotClick(g.hotspotState(g.room.hotspots.find((h) => h.id === id)), 1); };
        click("marta", "look"); step(60);    // the save after it fails
        click("door_out"); step(400);        // and play goes on, out of the door
      } finally { Storage.prototype.setItem = orig; }
      return { firstSeen, visible, len: text.length };
    })()`);
    assert.ok(r.firstSeen !== null, "never shown: " + JSON.stringify(r));
    assert.ok(r.visible >= r.len / 18, `on screen for ${r.visible.toFixed(2)} s`);
  });

  await check("BUG-9 an old-story save restarts the new voyage at Act I (v3 and v2 keys)", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz;
      const clear = () => { for (const k of Object.keys(localStorage)) if (k.startsWith("brasscompass.save")) localStorage.removeItem(k); };
      const old = (key) => {
        clear();
        // A Port Vela voyage: the old hold, the old one-shot flags, the old inventory.
        localStorage.setItem(key, JSON.stringify({ room: "below_decks", act: 2,
          flags: { quill_helped: true, dinner: true, chest_open: true }, inventory: ["compass", "sextant", "pell_log"] }));
        fz.stopOverlays(); g.hasSave = true; g.title = true; g.titleActivate("continue"); if (g.recap?.open) g.recap.sail();
        for (let i = 0; i < 400 && (g.curtain || g.title || g.act !== 1 || !g.room); i++) g.update(0.05);
        const flags = Object.keys(g.flags);
        const water = g.room.hotspots.find((h) => h.id === "water");
        let played = null;
        if (water) { g.setVerb("look"); g.onHotspotClick(g.hotspotState(water)); fz.runToEnd(fz.newProbe("r"), { explore: false }); played = g.narration?.text ?? null; }
        return { act: g.act, room: g.room.id, inv: [...g.inventory], flags, played,
          oldKey: localStorage.getItem(key), newSave: !!localStorage.getItem("brasscompass.save.v4"),
          notice: g.history.lines.some((l) => /old voyage is over/.test(l.text)) };
      };
      return { v3: old("brasscompass.save.v3"), v2: old("brasscompass.save.v2") };
    })()`);
    for (const [key, v] of Object.entries(r)) {
      assert.equal(v.act, 1, key + " did not restart at Act I");
      assert.equal(v.room, "dock", key + " did not land at Dreadwater");
      assert.deepEqual(v.inv, ["compass"], key + " kept the old inventory");
      for (const f of ["quill_helped", "dinner", "chest_open"]) assert.equal(v.flags.includes(f), false, key + " kept " + f);
      assert.equal(v.oldKey, null, key + " was not taken out of storage");
      assert.equal(v.newSave, true, key + " did not write a new voyage save");
      assert.equal(v.notice, true, key + " did not say the old voyage was over");
      assert.ok(v.played, key + " restarted into an unplayable room");
    }
  });

  await check("BUG-10 a Look or a line of conversation reaches the save by itself (and at once when the tab hides)", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(1); fz.runToEnd(P, { explore: false });
      const saved = (f) => fz.readSave()?.flags?.[f] === true;
      const steps = (n) => { for (let i = 0; i < n; i++) g.update(0.05); };
      // Looks with nothing else to them: no other save is on its way for their looked: flags.
      // (In the reboot most looks are say.look text rather than a hotspot's do.look list.)
      const quiet = g.visibleHotspots().filter((h) => { const s = g.hotspotState(h); return (s.do?.look?.length || s.say?.look) && !g.isExit(s) && (s.do?.look ?? []).every((e) => e.k === "say"); });
      const look = (h) => { g.clearSentence(); g.setVerb("look"); g.onHotspotClick(g.hotspotState(h)); fz.stepUntil(() => !g.path.length && !g.onArrive, 600); return "looked:" + g.room.id + "." + h.id; };
      const a = look(quiet[0]); steps(12);
      const lookSoon = saved(a);
      const b = look(quiet[1]); dispatchEvent(new Event("pagehide"));
      const lookOnHide = saved(b);
      // A line of conversation with nothing to do: from a node that carries straight on.
      fz.stepUntil(() => !g.narration && !g.queue, 2000);
      let pick = null;
      for (const id of fz.actTrees[1]) for (const n of Object.values(fz.M.DIALOGUES[id].nodes)) {
        const next = fz.M.DIALOGUES[id].nodes[n.next];
        if (!pick && !n.choices?.length && next && !next.do?.length) pick = { tree: id, node: n.id, next: next.id };
      }
      g.clearSentence(); g.runEffects([{ k: "talk", tree: pick.tree, node: pick.node }]);
      g.advanceDialogue(); steps(12);
      const seen = "seen:" + pick.tree + "." + pick.next, seenSoon = saved(seen);
      g.leaveDialogue();
      return { a, lookSoon, b, lookOnHide, seen, seenSoon };
    })()`);
    assert.equal(r.lookSoon, true, r.a + " not saved");
    assert.equal(r.lookOnHide, true, r.b + " not saved when the page hid");
    assert.equal(r.seenSoon, true, r.seen + " not saved");
  });

  await check("BUG-11 screen-reader announcements never double their punctuation ('Cray & Co..', '?. 1.')", async () => {
    const said = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      const out = []; const announce = g.announce; g.announce = (t) => { out.push(t); announce.call(g, t); };
      try {
        fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(4); fz.runToEnd(P, { explore: false });
        out.push(g.revealSummary());                      // what Q and the Reveal button read out
        // A first tap names the cabin door; the old counting_door is no longer in Act IV.
        const h = g.room.hotspots.find((x) => x.id === "cabin_door"), r = h.area.rect ?? null;
        const c = r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: h.area.reduce((s, p) => s + p.x, 0) / h.area.length, y: h.area.reduce((s, p) => s + p.y, 0) / h.area.length };
        g.cameraX = Math.max(0, Math.min((g.room.width ?? 1920) - 1920, c.x - 960));
        g.touch = true; g.onClick(c.x - g.cameraX, c.y, 0, 1); g.touch = false;   // a first tap names it
        // Every node with options, as it is read out when it appears.
        for (const t of Object.values(fz.M.DIALOGUES)) for (const n of Object.values(t.nodes)) {
          if (n.choices?.length) { g.dialogue = { tree: t, nodeId: n.id, shown: 0 }; g.announceNode(); }
        }
        g.dialogue = null;
      } finally { delete g.announce; }
      return out;
    })()`);
    const doubled = /(?:^|[^.])\.\.(?!\.)|[?!…]\.(?:\s|$)/;
    assert.deepEqual([...new Set(said.filter((t) => doubled.test(t)))].slice(0, 4), []);
  });

  // Real key events: these need the page's own rAF loop, so a fresh page.
  const live = await browser.newPage(server.url);
  await waitForGame(live);
  const key = (autoRepeat, k = "Enter", code = 13) => live.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, text: k === "Enter" ? "\r" : undefined, autoRepeat });
  const keyUp = (k = "Enter", code = 13) => live.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
  await check("BUG-7 one held Enter on 'Restart voyage' does not erase the voyage", async () => {
    await live.evaluate(`(() => { const g = __game; g.title = false; g.resetState(); g.startAct(2); g.narration = null; g.flags.fog_tried = true; g.persist(); })()`);
    await live.key("Escape");
    await until(() => live.evaluate("__game.paused"), "paused");
    for (let i = 0; i < 30 && !(await live.evaluate(`document.activeElement?.dataset?.action === "restart"`)); i++) { await key(false, "Tab", 9); await keyUp("Tab", 9); }
    await key(false); await pause(50);
    for (let i = 0; i < 3; i++) { await key(true); await pause(35); }
    await keyUp(); await pause(250);
    const save = await live.evaluate(`JSON.parse(localStorage.getItem("brasscompass.save.v4"))`);
    await live.evaluate("__game.setPaused(false)");
    assert.equal(save.act, 2, "save overwritten with act " + save.act);
  });
  await check("BUG-7b a mouse double-click on 'Restart voyage' does not erase the voyage", async () => {
    await live.evaluate(`(() => { const g = __game; g.title = false; g.resetState(); g.startAct(3); g.narration = null; g.flags.stranded = true; g.persist(); })()`);
    await live.key("Escape");
    await until(() => live.evaluate("__game.paused"), "paused");
    const b = await live.evaluate(`(() => { const el = document.querySelector('[data-action="restart"]'); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    for (const clickCount of [1, 2]) {
      await live.send("Input.dispatchMouseEvent", { type: "mousePressed", x: b.x, y: b.y, button: "left", clickCount, buttons: 1 });
      await live.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount });
    }
    await pause(250);
    const save = await live.evaluate(`JSON.parse(localStorage.getItem("brasscompass.save.v4"))`);
    await live.evaluate("__game.setPaused(false)");
    assert.equal(save.act, 3, "save overwritten with act " + save.act);
  });
  // The reboot's acts have no intro/outro cinematics (the old title cards are gone), so the old
  // double-skip cannot happen. The equivalent guard is that the no-cinematic transition starts
  // the next act exactly once and does not skip its opening scene.
  await check("BUG-8 an act's close starts the next act exactly once, with its opening scene intact", async () => {
    const r = await ev(`(() => {
      const g = __game, fz = __fz, P = fz.newProbe("r"); fz.cur = P;
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(1); fz.runToEnd(P, { explore: false });
      const says = []; const prev = g.trace; g.trace = (e) => { if (e.kind === "say") says.push(e.text); prev(e); };
      g.narration = null; g.queue = null; g.clearSentence();
      g.runEffects([{ k: "act", n: 1 }]);   // exactly what pier_end's last conversation does
      const after = g.act, room = g.room.id;
      fz.runToEnd(P, { explore: false });
      g.trace = prev;
      return { after, room, act: g.act, roomAfter: g.room.id, opening: says.filter((t) => /deck built for thirty/.test(t)).length, flags: Object.keys(g.flags) };
    })()`);
    assert.equal(r.after, 2);
    assert.equal(r.room, "marrow_deck");
    assert.equal(r.act, 2);
    assert.equal(r.opening, 1, "Act II's opening scene ran once");
    assert.equal(r.flags.includes("fog_tried"), false, "the transition skipped into the act's later scenes");
  });
  await live.close();

  const errors = page.events.filter((e) => !/favicon/.test(e.text + (e.url ?? "")));
  await check("no console errors or exceptions during the run", async () => { assert.deepEqual(errors.slice(0, 3), []); });
} finally {
  await browser.close();
  await server.stop();
}
console.log(failures.length ? `\n${failures.length} failing: ${failures.join("; ")}` : "\nall passed");
if (todoFailing.length) console.log(`${todoFailing.length} todo, waiting for other branches: ${todoFailing.join("; ")}`);
if (todoPassing.length) console.log(`${todoPassing.length} todo now passing (make them plain checks): ${todoPassing.join("; ")}`);
process.exitCode = failures.length ? 1 : 0;

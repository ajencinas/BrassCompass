/*
 * In-page fuzz library for The Brass Compass. Injected into the dev build (window.__game must
 * exist). Defines window.__fz. Everything after init() is synchronous: a probe restores a
 * snapshot, performs one player action through the game's own input-level methods, then drives
 * the game clock (update(0.05)) until the game is idle, exploring any conversation that opens.
 *
 * Nothing here edits game code. Snapshots go through the game's dev-only devSnapshot() and
 * devRestore(); the rest reads the Game instance and calls its input-level methods the way the
 * dev tools (window.__ff, devGoRoom...) and tools/playthrough.mjs already do. What each act can
 * reach comes from the game's own src/game/reach.ts.
 *
 * Automated drivers: Continue (or Enter on the title) shows the "Previously" recap, which holds the
 * room until "Set sail" is pressed; a driver must press it (Enter) before it expects the room.
 */
(() => {
  if (window.__fz) return;
  const g = window.__game;
  const fz = (window.__fz = {});
  const DT = 0.05;
  let M = null;
  const AUTO = (f) => f.startsWith("seen:") || f.startsWith("looked:");
  /** The live save shape (save.ts: SAVE_KEY). */
  fz.SAVE_KEY = "brasscompass.save.v4";

  // ------------------------------------------------------------------ setup

  fz.opts = { dlgCap: 250, settleSteps: 4000, lockLimit: 10, walkLimit: 60 };
  /**
   * How far (px) a standing Fenn may be from the floor before it counts: a walk's straight
   * segments can shave a floor polygon's corner slightly, and a few pixels can't be seen.
   */
  fz.OFF_FLOOR = 3;

  fz.init = async (opts = {}) => {
    Object.assign(fz.opts, opts);
    const imp = (p) => import(p);
    const [rooms, dlg, items, acts, combos, walk, verbs, view, assets, chars, hints, ui, reach] = await Promise.all([
      imp("/src/content/rooms.ts"), imp("/src/content/dialogue.ts"), imp("/src/content/items.ts"),
      imp("/src/content/acts.ts"), imp("/src/content/combos.ts"), imp("/src/engine/walkbox.ts"),
      imp("/src/game/verbs.ts"), imp("/src/engine/view.ts"), imp("/src/content/assets.ts"),
      imp("/src/content/characters.ts"), imp("/src/content/hints.ts"), imp("/src/game/ui.ts"), imp("/src/game/reach.ts"),
    ]);
    M = {
      ROOMS: rooms.ROOMS, DIALOGUES: dlg.DIALOGUES, ITEMS: items.ITEMS, ACTS: acts.ACTS, ENDING: acts.ENDING,
      GLOBAL_COMBOS: combos.GLOBAL_COMBOS, pointInPoly: walk.pointInPoly, clampToFloor: walk.clampToFloor,
      WalkMesh: walk.WalkMesh, VERBS: verbs.VERBS, LOGICAL_W: view.LOGICAL_W, SCENE_H: view.SCENE_H,
      MANIFEST: assets.MANIFEST, CHARACTERS: chars.CHARACTERS, TIPS: hints.TIPS, dialogueLayout: ui.dialogueLayout, UI: ui,
      actReach: reach.actReach,
    };
    fz.M = M;
    if (opts.stopLoop !== false) {
      // The fuzzer drives the clock; the rAF loop would otherwise advance the game between calls.
      g.frame = function () { /* stopped by the fuzzer */ };
    }
    g.trace = (e) => fz.onTrace(e);
    fz.computeStatic();
    fz.cov = fz.newCoverage();
    fz.dlgCache = new Set();
    return {
      rooms: Object.keys(M.ROOMS).length, dialogues: Object.keys(M.DIALOGUES).length,
      nodes: Object.values(M.DIALOGUES).reduce((n, t) => n + Object.keys(t.nodes).length, 0),
      items: Object.keys(M.ITEMS).length, acts: Object.keys(M.ACTS).map(Number),
      validRooms: Object.fromEntries(Object.entries(fz.validRooms).map(([a, s]) => [a, [...s]])),
      actItems: Object.fromEntries(Object.entries(fz.actItems).map(([a, s]) => [a, [...s]])),
      assets: fz.assetReport(),
    };
  };

  /** Images that failed or never arrived, and room art that isn't in the manifest at all. */
  fz.assetReport = () => {
    const a = g.assets;
    const failed = [...(a.failed ?? [])];
    const missing = [];
    for (const room of Object.values(M.ROOMS)) {
      const keys = [room.bg, ...(room.sprites ?? []).map((s) => s.key)];
      for (const s of room.sprites ?? []) {
        const p = s.speaker ? M.CHARACTERS[s.speaker]?.portrait : undefined;
        if (p) keys.push(p);
      }
      for (const k of keys) {
        if (!M.MANIFEST.images[k]) missing.push(room.id + ":" + k + " (not in manifest)");
        else if (!a.images.has(k)) missing.push(room.id + ":" + k + (a.failed?.has(k) ? " (failed)" : " (not loaded)"));
      }
    }
    for (const c of Object.values(M.CHARACTERS)) {
      if (c.portrait && !a.images.has(c.portrait)) missing.push("portrait:" + c.id + ":" + c.portrait);
    }
    return { failed, missing: [...new Set(missing)], loaded: a.images.size, manifest: Object.keys(M.MANIFEST.images).length };
  };

  // ------------------------------------------------------------------ static analysis

  /** Rooms each act can reach (doors, scenes, combos, conversations), and the items it can hand out. */
  fz.computeStatic = () => {
    fz.validRooms = {};
    fz.actItems = {};
    fz.actTrees = {};
    const reach = M.actReach({ rooms: M.ROOMS, dialogues: M.DIALOGUES, acts: M.ACTS, combos: M.GLOBAL_COMBOS });
    for (const [n, r] of reach) {
      fz.validRooms[n] = r.rooms;
      fz.actItems[n] = r.items;
      fz.actTrees[n] = r.trees;
    }
  };

  // ------------------------------------------------------------------ coverage and tracing

  fz.newCoverage = () => ({
    nodes: new Set(), choices: new Set(), hotspotVerbs: new Set(), itemProbes: new Set(), probes: 0,
    texts: new Map(), rejections: new Map(), acts: new Set(), rooms: new Set(),
  });
  fz.cur = null;
  fz.onTrace = (e) => {
    const P = fz.cur;
    if (e.kind === "node") fz.cov.nodes.add(e.tree + "." + e.node.id);
    if (e.kind === "choice") {
      const node = g.dialogue?.tree.nodes[g.dialogue.nodeId];
      const i = node?.choices?.indexOf(e.choice) ?? -1;
      fz.cov.choices.add(e.tree + "." + (g.dialogue?.nodeId ?? "?") + "#" + i);
    }
    if (e.kind === "room") fz.cov.rooms.add(e.room);
    if (!P) return;
    if (e.kind === "room") P.events.push("room:" + e.room);
    else if (e.kind === "act") P.events.push("act:" + e.n);
    else if (e.kind === "effect" && (e.effect.k === "talk" || e.effect.k === "go" || e.effect.k === "act" || e.effect.k === "win")) {
      P.events.push(e.effect.k + ":" + (e.effect.tree ?? e.effect.room ?? e.effect.n ?? "") + (e.effect.node ? "@" + e.effect.node : ""));
    } else if (e.kind === "say") {
      P.says = (P.says ?? 0) + 1;
      fz.checkText(P, e.text, "say");
      const t = fz.cov.texts;
      if (t.size < 40000 && !t.has(e.text)) t.set(e.text, P.id);
    }
  };

  // ------------------------------------------------------------------ probes

  fz.newProbe = (id) => ({ id, anomalies: [], errors: [], events: [], outcome: {}, _f: {}, gameTime: 0 });
  const anom = (P, kind, detail) => {
    if (P.anomalies.length > 40) return;
    P.anomalies.push({ kind, detail });
  };
  const err = (P, where, e) => {
    if (P.errors.length > 20) return;
    P.errors.push({ where, message: String(e?.message ?? e), stack: String(e?.stack ?? "").split("\n").slice(0, 8).join("\n") });
  };
  fz.anom = anom;
  fz.err = err;

  /** A short picture of the state, for anomaly reports. */
  fz.brief = () => ({
    act: g.act, room: g.room?.id, x: Math.round(g.x * 10) / 10, y: Math.round(g.y * 10) / 10,
    path: g.path.length, onArrive: Boolean(g.onArrive), pendingRoom: g.pendingRoom, fade: Math.round(g.fade * 1000) / 1000,
    fadeTarget: g.fadeTarget, queue: g.queue, queueDue: g.queueDue, narration: g.narration ? g.narration.text.slice(0, 90) : null,
    narrationClock: Math.round(g.narrationClock * 100) / 100,
    dialogue: g.dialogue ? g.dialogue.tree.id + "." + g.dialogue.nodeId : null, cinematic: g.cinematic.active,
    paused: g.paused, title: g.title, won: g.won, sentence: g.sentence, inventory: [...g.inventory],
    atlas: g.atlas?.open ?? null, card: g.areaCardBusy, curtain: Boolean(g.curtain), roomMenu: Boolean(g.roomMenu),
  });

  /** The moment as plain data: room, position, act, flags, inventory, conversation, line, queue... */
  fz.snap = () => g.devSnapshot();

  /** Close every overlay without running its callbacks (a cinematic's would start an act). */
  fz.stopOverlays = () => {
    const c = g.cinematic;
    if (c.active) {
      c.onComplete = null;
      c.overlay.hidden = true;
      try { c.video.pause(); c.video.removeAttribute("src"); } catch { /* fine */ }
    }
    g.paused = false;
    try { g.settings.panel.hidden = true; } catch { /* fine */ }
    try { g.casebook.overlay.hidden = true; } catch { /* fine */ }
    try { g.history.overlay.hidden = true; } catch { /* fine */ }
    try { if (g.atlas?.open) g.atlas.hide(); } catch { /* fine */ }
    try { g.clearAreaCard?.(); } catch { /* fine */ }
    document.querySelectorAll(".area-card").forEach((e) => e.remove());
  };

  /** Put the game exactly into a snapshot (idle or mid-conversation), then save it as the game would. */
  fz.restore = (s, { persist = true } = {}) => {
    fz.stopOverlays();
    g.devRestore(s, { persist });
  };

  fz.isIdle = () => !g.path.length && !g.onArrive && !g.queue && !g.pendingRoom && g.fade < 0.001 && g.fadeTarget === 0 &&
    !g.dialogue && !(g.narration && g.narration.shown < g.narration.text.length) && !g.cinematic.active &&
    !g.title && !g.won && !g.paused;

  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const checkNumbers = (P) => {
    if (P._f.nan) return;
    if (!finite(g.x) || !finite(g.y) || !finite(g.cameraX) || !finite(g.fade)) {
      P._f.nan = 1;
      anom(P, "nan-state", fz.brief());
    }
  };

  /** Drive the clock until idle, a conversation, a cinematic, the ending or the title. */
  fz.settle = (P, maxSteps = fz.opts.settleSteps) => {
    let locked = 0, walking = 0, queued = 0, queueSig = "";
    for (let steps = 0; steps < maxSteps; steps++) {
      if (g.cinematic.active) return "cinematic";
      if (g.won) return "won";
      if (g.title) return "title";
      if (g.dialogue) return "dialogue";
      if (fz.isIdle()) return "idle";
      // A waiting line is the player's (the default now), and a "clicker" player clicks once
      // it is fully shown either way.
      if ((fz.opts.clicker || g.prefs.waitForClick) && g.queue && g.narration &&
          g.narration.shown >= g.narration.text.length && !g.inputLocked()) {
        try { g.onClick(960, 300, 0, 1); } catch (e) { err(P, "onClick(flush)", e); return "exception"; }
        continue;
      }
      try { g.update(DT); } catch (e) { err(P, "update", e); return "exception"; }
      P.gameTime += DT;
      checkNumbers(P);
      if (g.inputLocked()) {
        locked += DT;
        if (locked > fz.opts.lockLimit && !P._f.lock) { P._f.lock = 1; anom(P, "input-locked>10s", fz.brief()); }
      } else locked = 0;
      if (g.path.length) {
        walking += DT;
        if (walking > fz.opts.walkLimit && !P._f.walk) { P._f.walk = 1; anom(P, "walk-never-arrives", fz.brief()); }
      } else walking = 0;
      if (g.queue && !g.prefs.waitForClick && !fz.opts.clicker) {
        // A long scene is not a stuck one: the stall clock only runs while the queue and the
        // line on screen are unchanged. (New Act II/III arrival scenes are a dozen lines long,
        // which takes longer than the stall limit at a normal reading speed.)
        const sig = g.queue.length + "|" + (g.narration?.text ?? "");
        if (sig !== queueSig) { queueSig = sig; queued = 0; } else queued += DT;
        if (queued > 30 && !P._f.queue) { P._f.queue = 1; anom(P, "queue-never-drains", fz.brief()); }
      } else { queued = 0; queueSig = ""; }
    }
    if (!P._f.timeout) { P._f.timeout = 1; anom(P, "settle-timeout", fz.brief()); }
    return "timeout";
  };

  // ------------------------------------------------------------------ checks

  fz.checkText = (P, text, where) => {
    if (typeof text !== "string" || !text.trim()) { anom(P, "empty-text", { where, text, at: fz.brief() }); return; }
    if (/\bundefined\b|\bnull\b|\bNaN\b|\[object /.test(text)) anom(P, "bad-token-in-text", { where, text });
    if (/\b(the|a|an) (the|a|an)\b/i.test(text)) anom(P, "article-doubling", { where, text });
    const open = (text.match(/“/g) ?? []).length, close = (text.match(/”/g) ?? []).length;
    if (open !== close) anom(P, "unbalanced-quotes", { where, text });
  };

  /** What the save in storage says, against the live voyage: anything that a closed tab would lose. */
  fz.persistGap = () => {
    let save = null;
    try { save = JSON.parse(localStorage.getItem(fz.SAVE_KEY)); } catch { /* none */ }
    if (!save) return { noSave: true };
    const d = {};
    if (save.act !== g.act) d.act = [save.act, g.act];
    if (save.room !== g.room.id) d.room = [save.room, g.room.id];
    const inv = (l) => JSON.stringify([...l].sort());
    if (inv(save.inventory) !== inv(g.inventory)) d.inventory = [save.inventory, [...g.inventory]];
    const keys = new Set([...Object.keys(save.flags ?? {}), ...Object.keys(g.flags)]);
    for (const k of keys) {
      if (JSON.stringify(save.flags?.[k]) !== JSON.stringify(g.flags[k])) (d.flags ??= {})[k] = [save.flags?.[k], g.flags[k]];
    }
    const ids = (l) => (l ?? []).map((n) => n.id).sort().join(",");
    if (ids(save.notes) !== ids(g.notes)) d.notes = [ids(save.notes), ids(g.notes)];
    return d;
  };
  fz.checkPersist = (P, where) => {
    const d = fz.persistGap();
    if (d.noSave) { anom(P, "no-save", where); return; }
    // The save deliberately omits the closing-choice and ending flags: Continue must replay
    // the final choice with clean flags. Those are not persistence gaps.
    const ENDING_RESET = new Set(["ending_fog_lifts", "ending_long_way", "ending_pirate", "ending_desk", "curse_broken", "escaped_fog"]);
    if (d.flags) {
      d.flags = Object.fromEntries(Object.entries(d.flags).filter(([k]) => !ENDING_RESET.has(k)));
      if (!Object.keys(d.flags).length) delete d.flags;
    }
    if (!Object.keys(d).length) return;
    const onlyAuto = !d.act && !d.room && !d.inventory && !d.notes && Object.keys(d.flags ?? {}).every(AUTO);
    anom(P, onlyAuto ? "persist-gap-auto" : "persist-gap", { where, diff: d, at: fz.brief() });
  };

  /** Invariants of a settled (idle) game. */
  fz.checkIdle = (P, where = "idle") => {
    checkNumbers(P);
    const room = g.room;
    const c = M.clampToFloor({ x: g.x, y: g.y }, room.walk);
    if (Math.hypot(c.x - g.x, c.y - g.y) > fz.OFF_FLOOR) anom(P, "off-floor", { where, room: room.id, x: g.x, y: g.y, nearest: c });
    const maxCam = Math.max(0, (room.width ?? M.LOGICAL_W) - M.LOGICAL_W);
    if (!(g.cameraX >= -0.5 && g.cameraX <= maxCam + 0.5)) anom(P, "camera-out-of-range", { where, cameraX: g.cameraX, maxCam });
    if (!fz.validRooms[g.act]?.has(room.id)) anom(P, "room-not-in-act", { where, act: g.act, room: room.id });
    for (const id of g.inventory) if (!M.ITEMS[id]) anom(P, "unknown-item", { where, id });
    if (new Set(g.inventory).size !== g.inventory.length) anom(P, "duplicate-item", { where, inventory: [...g.inventory] });
    if (g.inputLocked()) anom(P, "idle-but-locked", { where, at: fz.brief() });
    fz.checkPersist(P, where);
    try { g.render(); } catch (e) { err(P, "render(" + where + ")", e); }
    try { g.panelModel(); } catch (e) { err(P, "panelModel", e); }
    try { const t = g.currentTip(); if (!t) anom(P, "no-tip", where); } catch (e) { err(P, "currentTip", e); }
  };

  /** A conversation node on screen: it draws, its choices fit and can be reached, its text is sane. */
  fz.checkNode = (P) => {
    const node = g.currentNode();
    const where = g.dialogue.tree.id + "." + g.dialogue.nodeId;
    fz.checkText(P, node.text, "node " + where);
    const vis = g.visibleChoices();
    if (node.choices?.length && !vis.length) anom(P, "all-choices-hidden", { where, next: node.next ?? null, conds: node.choices.map((c) => c.if ?? null) });
    for (const c of vis) fz.checkText(P, c.text, "choice " + where);
    if (vis.length > 9) anom(P, "more-than-9-choices", { where, n: vis.length });
    const texts = vis.map((c) => c.text);
    for (const scale of [1, 1.25, 1.5]) {
      try {
        const l = M.dialogueLayout(g.view.ctx, node.text, texts, scale);
        const bottom = l.rects.length ? Math.max(...l.rects.map((r) => r.y + r.h)) : l.bodyY;
        if (l.top < 0 || bottom > 1080 || l.top + l.height > 1080) {
          anom(P, "dialogue-overflow", { where, scale, top: l.top, height: l.height, bottom, size: l.size, choices: vis.length });
        }
      } catch (e) { err(P, "dialogueLayout " + where, e); }
    }
    if (!M.CHARACTERS[node.speaker] && node.speaker !== "narrator") anom(P, "unknown-speaker", { where, speaker: node.speaker });
    try { g.render(); } catch (e) { err(P, "render(node " + where + ")", e); }
    fz.checkPersist(P, "node " + where);
  };

  // ------------------------------------------------------------------ conversations

  const boolFlags = (flags) => Object.keys(flags).filter((k) => !AUTO(k) && typeof flags[k] !== "number")
    .map((k) => k + "=" + JSON.stringify(flags[k])).sort().join(",");
  const dkey = () => [g.act, g.room.id, g.dialogue.tree.id, g.dialogue.nodeId,
    g.visibleChoices().map((c) => c.index).join("."), [...g.inventory].sort().join(","), boolFlags(g.flags)].join("|");

  /** Skip cinematics the way a player does (each skip runs its callback: the next act starts). */
  fz.skipCinematics = (P) => {
    for (let i = 0; i < 4 && g.cinematic.active; i++) {
      try { g.cinematic.skip(); } catch (e) { err(P, "cinematic.skip", e); return; }
    }
  };

  /**
   * Every reachable node of the conversation on screen: breadth-first over choices (and plain
   * "continue"), each from its own snapshot; also right-click from every node.
   */
  fz.bfsDialogue = (P, s0) => {
    const frontier = [s0];
    const seen = new Set();
    let expanded = 0;
    while (frontier.length && expanded < fz.opts.dlgCap) {
      const s = frontier.shift();
      fz.restore(s);
      if (!g.currentNode()) { anom(P, "dialogue-node-missing", s.dialogue); continue; }
      const k = dkey();
      if (seen.has(k)) continue;
      seen.add(k);
      expanded++;
      const where = s.dialogue.tree + "." + s.dialogue.node;
      fz.checkNode(P);
      const vis = g.visibleChoices();
      const actions = vis.length ? vis.map((c, i) => ["choice", i, c.text]) : [["advance"]];
      actions.push(["leave"]);
      for (const [kind, i, text] of actions) {
        fz.restore(s);
        try {
          if (kind === "choice") g.pickChoice(i);
          else if (kind === "advance") g.advanceDialogue();
          else g.leaveDialogue();
        } catch (e) { err(P, `${kind}${i ?? ""} at ${where}`, e); continue; }
        if (kind === "advance" && g.dialogue && g.dialogue.tree.id === s.dialogue.tree && g.dialogue.nodeId === s.dialogue.node) {
          anom(P, "advance-does-not-move", { where });
          continue;
        }
        if (kind === "leave" && g.dialogue && !g.cinematic.active) {
          // leaveDialogue may legitimately end in another conversation (a node's talk effect).
          const same = g.dialogue.tree.id === s.dialogue.tree && g.dialogue.nodeId === s.dialogue.node;
          if (same) { anom(P, "leave-does-not-close", { where }); continue; }
        }
        const r = fz.settle(P);
        if (r === "dialogue") {
          if (kind !== "leave") frontier.push(fz.snap());
          else P.outcome.leaveOpens = (P.outcome.leaveOpens ?? 0) + 1;
        } else if (r === "cinematic") {
          const from = g.act;
          P.outcome.actComplete = [...new Set([...(P.outcome.actComplete ?? []), from + "@" + where + ":" + kind + (i ?? "")])];
          fz.skipCinematics(P);
          const r2 = fz.settle(P);
          if (r2 === "idle") fz.checkIdle(P, "after act " + from + " completed at " + where);
          else if (r2 === "won") fz.checkWon(P, where);
        } else if (r === "won") {
          fz.checkWon(P, where);
        } else if (r === "idle") {
          fz.checkIdle(P, `after ${kind}${i ?? ""} at ${where}`);
        }
      }
    }
    if (frontier.length) P.outcome.dlgCapHit = (P.outcome.dlgCapHit ?? 0) + 1;
    return expanded;
  };

  fz.checkWon = (P, where) => {
    P.outcome.won = true;
    try { g.render(); } catch (e) { err(P, "render(won " + where + ")", e); }
    const holds = (list) => !list || list.every((c) => g.check(c));
    const lines = M.ENDING.lines.filter((l) => holds(l.if));
    if (!lines.length) anom(P, "ending-without-lines", where);
  };

  /** A conversation opened during a probe: explore it once per state, then walk away from it. */
  fz.handleDialogue = (P) => {
    const s0 = fz.snap();
    const k = dkey();
    P.outcome.dialogues = [...new Set([...(P.outcome.dialogues ?? []), s0.dialogue.tree + "." + s0.dialogue.node])];
    if (!fz.dlgCache.has(k)) {
      fz.dlgCache.add(k);
      const saved = fz.cur;
      fz.bfsDialogue(P, s0);
      fz.cur = saved;
    }
    fz.restore(s0);
    try { g.leaveDialogue(); } catch (e) { err(P, "leaveDialogue", e); g.dialogue = null; }
    if (g.dialogue && g.dialogue.tree.id === s0.dialogue.tree && g.dialogue.nodeId === s0.dialogue.node) {
      anom(P, "leave-does-not-close", { where: s0.dialogue.tree + "." + s0.dialogue.node });
      g.dialogue = null;
    }
  };

  /** After an action: settle, exploring conversations and skipping cinematics, until idle. */
  fz.runToEnd = (P, { explore = true } = {}) => {
    for (let guard = 0; guard < 25; guard++) {
      const r = fz.settle(P);
      if (r === "dialogue") {
        if (explore) fz.handleDialogue(P);
        else { P.outcome.dialogues = [...(P.outcome.dialogues ?? []), g.dialogue.tree.id + "." + g.dialogue.nodeId]; g.leaveDialogue(); }
        continue;
      }
      if (r === "cinematic") {
        P.outcome.actComplete = [...new Set([...(P.outcome.actComplete ?? []), String(g.act)])];
        fz.skipCinematics(P);
        continue;
      }
      if (r === "won") { fz.checkWon(P, "probe"); return r; }
      if (r === "idle") { fz.checkIdle(P); return r; }
      return r;
    }
    anom(P, "runToEnd-guard", fz.brief());
    return "guard";
  };

  // ------------------------------------------------------------------ actions

  const hotspot = (id) => g.room.hotspots.find((h) => h.id === id);
  /** What a click on the hotspot hands onHotspotClick: hotspotAt() returns the state-merged copy. */
  const clickHs = (id, clicks = 1) => g.onHotspotClick(g.hotspotState(hotspot(id)), clicks);

  /** Perform one action from a snapshot. Returns the probe record. */
  fz.probe = (base, action) => {
    const P = fz.newProbe(action.id);
    fz.cur = P;
    fz.cov.probes++;
    fz.restore(base);
    const before = { room: g.room.id, act: g.act, inv: [...g.inventory].sort().join(","), flags: boolFlags(g.flags) };
    try {
      switch (action.kind) {
        case "verb": g.setVerb(action.verb); clickHs(action.hs); break;
        case "smart": clickHs(action.hs, 1); break;
        case "double": clickHs(action.hs, 2); break;
        case "right": g.setVerb("look"); clickHs(action.hs); break;
        case "itemOn": g.setVerb(action.verb); g.pickItem(action.item); clickHs(action.hs); break;
        case "onItem": g.setVerb(action.verb); clickHs(action.hs); g.pickItem(action.item); break;
        case "itemItem": g.setVerb(action.verb); g.pickItem(action.item); g.pickItem(action.item2); break;
        case "itemAlone": g.setVerb(action.verb); g.pickItem(action.item); break;
        case "tip": g.showTip(); break;
        default: throw new Error("unknown action " + action.kind);
      }
    } catch (e) { err(P, "action " + action.kind, e); }
    P.result = fz.runToEnd(P, { explore: action.explore !== false });
    const after = { room: g.room?.id, act: g.act, inv: [...g.inventory].sort().join(","), flags: boolFlags(g.flags) };
    P.changed = before.room !== after.room || before.act !== after.act || before.inv !== after.inv || before.flags !== after.flags;
    P.narration = g.narration?.text?.slice(0, 160) ?? null;
    P.rejected = g.rejection > 0 || undefined;
    fz.cur = null;
    return P;
  };

  /** All the actions a player can take on a state (optionally only those with written content). */
  fz.actionsFor = (base, { items = true, alone = true, meaningfulOnly = false } = {}) => {
    fz.restore(base, { persist: false });
    const out = [];
    const hss = g.visibleHotspots().map((h) => h.id);
    const inv = [...g.inventory];
    const states = (raw) => [raw, ...(raw.states ?? [])];
    for (const id of hss) {
      const raw = hotspot(id);
      const st = g.hotspotState(raw);
      for (const v of M.VERBS) {
        const has = Boolean(st.do?.[v.id]?.length) || (v.id === "pickup" && st.item) || Boolean(st.say?.[v.id]);
        if (meaningfulOnly && !(Boolean(st.do?.[v.id]?.length) || (v.id === "pickup" && st.item))) continue;
        out.push({ kind: "verb", verb: v.id, hs: id, written: has });
        fz.cov.hotspotVerbs.add(g.act + "|" + g.room.id + "|" + id + "|" + v.id);
      }
      if (!meaningfulOnly) {
        out.push({ kind: "smart", hs: id }, { kind: "right", hs: id });
        if (g.isExit(st)) out.push({ kind: "double", hs: id });
      }
      void states;
    }
    if (items) {
      const combos = [...(g.room.combos ?? []), ...M.GLOBAL_COMBOS];
      const comboFor = (a, b) => combos.some((c) => (c.item === a && c.with === b) || (c.item === b && c.with === a));
      for (const it of inv) {
        for (const id of hss) {
          for (const verb of ["use", "give"]) {
            if (meaningfulOnly && !comboFor(it, id)) continue;
            out.push({ kind: "itemOn", verb, item: it, hs: id });
            fz.cov.itemProbes.add(g.act + "|" + g.room.id + "|" + it + "|" + verb + "|" + id);
          }
          if (!meaningfulOnly) out.push({ kind: "onItem", verb: "use", item: it, hs: id });
        }
        for (const it2 of inv) {
          if (it2 === it) continue;
          if (meaningfulOnly && !comboFor(it, it2)) continue;
          out.push({ kind: "itemItem", verb: "use", item: it, item2: it2 });
          if (!meaningfulOnly) out.push({ kind: "itemItem", verb: "give", item: it, item2: it2 });
        }
        if (alone && !meaningfulOnly) {
          for (const v of M.VERBS) if (!v.twoObject) out.push({ kind: "itemAlone", verb: v.id, item: it });
        }
      }
    }
    for (const a of out) a.id = [a.kind, a.verb ?? "", a.item ?? "", a.item2 ?? "", a.hs ?? ""].filter(Boolean).join(":");
    return out;
  };

  // ------------------------------------------------------------------ act starts and phase A

  /** A clean start of act n (as Chapter select / __act would, but in normal mode): settled and idle. */
  fz.startAct = (P, n) => {
    fz.stopOverlays();
    g.resetState();
    g.title = false;
    g.startAct(n);
    return fz.runToEnd(P);
  };

  fz.teleport = (P, roomId) => {
    g.devGoRoom(roomId);
    return fz.runToEnd(P);
  };

  const summarize = (P) => {
    const keep = P.anomalies.length || P.errors.length;
    return keep ? { id: P.id, anomalies: P.anomalies, errors: P.errors, events: P.events.slice(0, 20), outcome: P.outcome, narration: P.narration } : null;
  };

  /**
   * One act and room: settle the act's start and the room's arrival, then every hotspot with every
   * verb (natural inventory), and every act item used/given on every hotspot and item.
   */
  fz.phaseA = (act, roomId, { itemsAll = true, limit = Infinity } = {}) => {
    const t0 = performance.now();
    const out = { act, room: roomId, probes: 0, findings: [], setup: null, outcomes: {} };
    const P0 = fz.newProbe(`A${act}:${roomId}:setup`);
    fz.cur = P0;
    fz.startAct(P0, act);
    fz.teleport(P0, roomId);
    fz.cur = null;
    out.setup = summarize(P0);
    if (g.room.id !== roomId || g.act !== act) {
      out.findings.push({ id: P0.id, anomalies: [{ kind: "setup-moved", detail: fz.brief() }], errors: [] });
    }
    const base = fz.snap();
    out.visible = (fz.restore(base, { persist: false }), g.visibleHotspots().map((h) => h.id));
    const runAll = (b, actions, tag) => {
      for (const a of actions) {
        if (out.probes >= limit) break;
        const P = fz.probe(b, a);
        out.probes++;
        const s = summarize(P);
        if (s) { s.tag = tag; s.act = act; s.room = roomId; out.findings.push(s); }
        if (P.changed || P.outcome.dialogues || P.outcome.actComplete) {
          out.outcomes[a.id] = { events: P.events.slice(0, 12), dialogues: P.outcome.dialogues, act: P.outcome.actComplete, narration: P.narration };
        }
      }
    };
    runAll(base, fz.actionsFor(base, { items: true, alone: true }), "natural");
    if (itemsAll) {
      fz.restore(base, { persist: false });
      const extra = [...fz.actItems[act]].filter((i) => !g.inventory.includes(i));
      if (extra.length) {
        const withItems = { ...base, inventory: [...base.inventory, ...extra] };
        // Only the item actions: the verbs were covered on the natural inventory.
        const acts = fz.actionsFor(withItems, { items: true, alone: true }).filter((a) => a.kind !== "verb" && a.kind !== "smart" && a.kind !== "right" && a.kind !== "double");
        runAll(withItems, acts, "all-items");
        // Visible hotspots can change with what you carry: verbs on any that only show now.
        fz.restore(withItems, { persist: false });
        const newly = g.visibleHotspots().map((h) => h.id).filter((id) => !out.visible.includes(id));
        if (newly.length) runAll(withItems, fz.actionsFor(withItems, { items: false }).filter((a) => newly.includes(a.hs)), "all-items-verbs");
      }
    }
    out.ms = Math.round(performance.now() - t0);
    return out;
  };

  fz.coverageReport = () => ({
    nodes: [...fz.cov.nodes], choices: [...fz.cov.choices], hotspotVerbs: fz.cov.hotspotVerbs.size,
    itemProbes: fz.cov.itemProbes.size, probes: fz.cov.probes, rooms: [...fz.cov.rooms],
    texts: fz.cov.texts.size,
  });
  fz.textDump = () => [...fz.cov.texts.entries()];
})();

/* ===================================================================== phase B: state space */
(() => {
  const fz = window.__fz;
  const g = window.__game;
  const M = () => fz.M;
  const AUTO = (f) => f.startsWith("seen:") || f.startsWith("looked:");

  /** Flags that change what the player can do: read by rooms, combos, scenes or (non-auto) by choices. */
  fz.gameplayFlags = () => {
    if (fz._gf) return fz._gf;
    const out = new Set();
    const conds = (list, allowAuto) => (list ?? []).forEach((c) => {
      if ("flag" in c && (allowAuto || !AUTO(c.flag))) out.add(c.flag);
      if ("any" in c) conds(c.any, allowAuto);
      if ("not" in c) conds([c.not], allowAuto);
    });
    for (const room of Object.values(M().ROOMS)) {
      for (const sc of room.scenes ?? []) conds(sc.if, true);
      for (const h of room.hotspots) { conds(h.showIf, true); for (const st of h.states ?? []) conds(st.if, true); }
      for (const c of room.combos ?? []) conds(c.if, true);
      for (const s of room.sprites ?? []) conds(s.showIf, true);
    }
    for (const c of M().GLOBAL_COMBOS) conds(c.if, true);
    for (const t of Object.values(M().DIALOGUES)) for (const n of Object.values(t.nodes)) for (const ch of n.choices ?? []) conds(ch.if, false);
    fz._gf = out;
    return out;
  };
  fz.skey = (s) => {
    const gf = fz.gameplayFlags();
    const flags = Object.keys(s.flags).filter((k) => gf.has(k) && typeof s.flags[k] !== "number" && s.flags[k] !== undefined && s.flags[k] !== false)
      .map((k) => k + (s.flags[k] === true ? "" : "=" + JSON.stringify(s.flags[k]))).sort().join(",");
    return [s.act, s.room, [...s.inventory].sort().join(","), flags].join("|");
  };

  const leafCache = new Map();
  fz.nextActRoots = {};
  /** Just after an act's end began: skip its cinematics and keep the next act's opening state. */
  fz.captureNextAct = (P) => {
    const next = g.act;
    if (fz.nextActRoots[next] || !fz.M.ACTS[next]) return;
    fz.skipCinematics(P);
    const r = fz.settle(P);
    if (r === "idle" || r === "dialogue") fz.nextActRoots[next] = fz.snap();
  };
  fz.leafCacheClear = () => leafCache.clear();
  const dkey = () => [g.act, g.room.id, g.dialogue.tree.id, g.dialogue.nodeId, g.visibleChoices().map((c) => c.index).join("."),
    [...g.inventory].sort().join(","), Object.keys(g.flags).filter((k) => !AUTO(k) && typeof g.flags[k] !== "number").map((k) => k + "=" + JSON.stringify(g.flags[k])).sort().join(",")].join("|");

  /**
   * An act's end is not always a cinematic: the reboot's acts have no intro/outro films, so
   * `act n` runs `completeAct` and `startAct(n+1)` in one go. Record that as a goal whenever the
   * act changes, however the transition was dressed.
   */
  const actGoal = (out, act0, where) => out.goals.push({ kind: "act", act: act0, where });

  /** Drive the game on from "just acted" to every idle state it can end in (all conversation paths). */
  fz.expandFrom = (P, out, where = "action", fromAct = null) => {
    const act0 = fromAct ?? g.act;
    if (g.act !== act0) { actGoal(out, act0, where); fz.captureNextAct(P); return; }
    const r = fz.settle(P);
    if (g.act !== act0) { actGoal(out, act0, where); fz.captureNextAct(P); return; }
    if (r === "idle") { fz.checkIdle(P, where); out.leaves.push(fz.snap()); return; }
    if (r === "cinematic") { actGoal(out, act0, where); fz.captureNextAct(P); return; }
    if (r === "won") { out.goals.push({ kind: "won", where }); fz.checkWon(P, where); return; }
    if (r === "dialogue") { fz.dialogueLeaves(P, fz.snap(), out, act0); return; }
    out.other.push({ r, where, at: fz.brief() });
  };

  fz.dialogueLeaves = (P, s0, out, fromAct = null) => {
    const act0 = fromAct ?? g.act;
    fz.restore(s0);
    const k0 = dkey();
    let local = leafCache.get(k0);
    if (!local) {
      local = { leaves: [], goals: [], other: [], keys: new Set() };
      const frontier = [s0];
      const seen = new Set();
      let expanded = 0;
      while (frontier.length && expanded < fz.opts.dlgCap) {
        const s = frontier.shift();
        fz.restore(s);
        if (!g.currentNode()) { fz.anom(P, "dialogue-node-missing", s.dialogue); continue; }
        const k = dkey();
        if (seen.has(k)) continue;
        seen.add(k);
        expanded++;
        const where = s.dialogue.tree + "." + s.dialogue.node;
        fz.checkNode(P);
        const vis = g.visibleChoices();
        const actions = vis.length ? vis.map((c, i) => ["choice", i]) : [["advance"]];
        actions.push(["leave"]);
        for (const [kind, i] of actions) {
          fz.restore(s);
          try {
            if (kind === "choice") g.pickChoice(i);
            else if (kind === "advance") g.advanceDialogue();
            else g.leaveDialogue();
          } catch (e) { fz.err(P, `${kind}${i ?? ""} at ${where}`, e); continue; }
          if (kind === "advance" && g.dialogue && g.dialogue.tree.id === s.dialogue.tree && g.dialogue.nodeId === s.dialogue.node) {
            fz.anom(P, "advance-does-not-move", { where }); continue;
          }
          const at = `${kind}${i ?? ""}@${where}`;
          if (g.act !== act0) { actGoal(local, act0, at); fz.captureNextAct(P); continue; }
          if (g.dialogue && !g.cinematic.active) {
            // What a closed tab would lose right now (the save has no conversation in it).
            fz.checkPersist(P, `${kind}${i ?? ""} at ${where} -> ${g.dialogue.tree.id}.${g.dialogue.nodeId}`);
          }
          const r = fz.settle(P);
          if (g.act !== act0) { actGoal(local, act0, at); fz.captureNextAct(P); continue; }
          if (r === "dialogue") frontier.push(fz.snap());
          else if (r === "idle") {
            fz.checkIdle(P, "after " + at);
            const leaf = fz.snap(), lk = fz.skey(leaf);
            if (!local.keys.has(lk)) { local.keys.add(lk); local.leaves.push(leaf); }
          }
          else if (r === "cinematic") { actGoal(local, act0, at); fz.captureNextAct(P); }
          else if (r === "won") { local.goals.push({ kind: "won", where: at }); fz.checkWon(P, at); }
          else local.other.push({ r, where: at, at: fz.brief() });
        }
      }
      if (frontier.length) local.capHit = true;
      leafCache.set(k0, local);
    }
    out.leaves.push(...local.leaves);
    out.goals.push(...local.goals);
    out.other.push(...local.other);
    if (local.capHit) out.capHit = true;
  };

  const perform = (a) => {
    const hs = (id) => g.room.hotspots.find((h) => h.id === id);
    const click = (id, n = 1) => g.onHotspotClick(g.hotspotState(hs(id)), n);
    switch (a.kind) {
      case "verb": g.setVerb(a.verb); click(a.hs); break;
      case "itemOn": g.setVerb(a.verb); g.pickItem(a.item); click(a.hs); break;
      case "itemItem": g.setVerb(a.verb); g.pickItem(a.item); g.pickItem(a.item2); break;
      default: throw new Error("perform " + a.kind);
    }
  };

  /**
   * Effects that can change the state the softlock graph is made of: flags, items, room and
   * act. Narration-only verbs (a Look with just a `say`, a sound, a music cue) leave every key
   * in `skey` unchanged, so exploring them only wastes the budget and buries the story edges.
   */
  const STATE_EFFECTS = new Set(["flag", "add", "give", "take", "go", "talk", "act", "win"]);
  const changesState = (list, consume) => Boolean(consume) ||
    (list ?? []).some((e) => STATE_EFFECTS.has(e.k));
  const comboFor = (item, withId) => [...(g.room.combos ?? []), ...M().GLOBAL_COMBOS].find((c) =>
    (((c.item === item && c.with === withId) || (c.item === withId && c.with === item))) &&
    (!c.if || c.if.every((cond) => g.check(cond))));

  /**
   * State-changing actions only: a verb whose effects alter a flag, item, room or act (or a
   * pickup), and an item pair the room or global combos answer with a real change. One per
   * identical effect.
   */
  fz.bActions = (snap) => {
    const acts = fz.actionsFor(snap, { meaningfulOnly: true });
    fz.restore(snap, { persist: false });
    const seenDo = new Set();
    return acts.filter((a) => {
      if (a.kind === "itemOn" || a.kind === "itemItem") {
        const c = comboFor(a.item, a.kind === "itemOn" ? a.hs : a.item2);
        return Boolean(c) && changesState(c.do, c.consume);
      }
      if (a.kind !== "verb") return true;
      const st = g.hotspotState(g.room.hotspots.find((h) => h.id === a.hs));
      const pickup = a.verb === "pickup" && Boolean(st.item);
      if (!pickup && !changesState(st.do?.[a.verb])) return false;
      const sig = a.hs + JSON.stringify(st.do?.[a.verb] ?? null) + (pickup ? st.item : "");
      if (seenDo.has(sig)) return false;
      seenDo.add(sig);
      return true;
    });
  };

  /**
   * Breadth-first over the act's states. A state is (room, inventory, gameplay flags); edges are
   * meaningful actions (and every way through a conversation they open). When the search
   * finishes, every state that cannot reach the act's end is a softlock candidate.
   */
  fz.phaseB = (act, { maxStates = 600, maxMs = 240000, rootSnap = null, order = "bfs" } = {}) => {
    const t0 = performance.now();
    const states = new Map();
    const edges = new Map();
    const expanded = new Set();
    const goalVia = new Map();
    const frontier = [];
    const findings = [];
    const gapCounts = {}, kindCounts = {};
    let probes = 0;
    const add = (snap, from, via, depth) => {
      const k = fz.skey(snap);
      if (!states.has(k)) { states.set(k, { snap, from, via, depth }); edges.set(k, new Set()); frontier.push(k); }
      return k;
    };
    const P0 = fz.newProbe(`B${act}:start`);
    fz.cur = P0;
    const out0 = { leaves: [], goals: [], other: [] };
    fz.nextActRoots = {};
    if (rootSnap) { fz.restore(rootSnap); fz.expandFrom(P0, out0, "carried root", act); }
    else {
      fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(act);
      fz.expandFrom(P0, out0, "act start", act);
    }
    for (const leaf of out0.leaves) add(leaf, null, "start", 0);
    if (P0.anomalies.length || P0.errors.length) findings.push({ id: P0.id, anomalies: P0.anomalies, errors: P0.errors });
    while (frontier.length && performance.now() - t0 < maxMs) {
      if (states.size >= maxStates) break;
      // Breadth-first proves reachability level by level; depth-first reaches an act's end
      // much sooner in a wide act (Act I's crew chain), so the caller can choose.
      const k = order === "dfs" ? frontier.pop() : frontier.shift();
      const S = states.get(k);
      expanded.add(k);
      for (const a of fz.bActions(S.snap)) {
        const P = fz.newProbe(`B${act}:${k}:${a.id}`);
        fz.cur = P;
        fz.cov.probes++;
        probes++;
        fz.restore(S.snap);
        try { perform(a); } catch (e) { fz.err(P, "perform " + a.id, e); }
        const out = { leaves: [], goals: [], other: [] };
        fz.expandFrom(P, out, a.id, act);
        for (const leaf of out.leaves) {
          if (leaf.act !== act) continue;
          const lk = add(leaf, k, a.id, S.depth + 1);
          if (lk !== k) edges.get(k).add(lk);
        }
        for (const goal of out.goals) if (!goalVia.has(k)) goalVia.set(k, a.id + " -> " + goal.where);
        if (out.other.length) P.anomalies.push({ kind: "expand-other", detail: out.other.slice(0, 3) });
        if (out.capHit) P.anomalies.push({ kind: "dialogue-cap-hit", detail: a.id });
        for (const x of P.anomalies) {
          if (x.kind === "persist-gap-auto") {
            const k = (x.detail.where ?? "").replace(/ .*/, "") + " " + Object.keys(x.detail.diff.flags ?? {}).map((f) => f.split(":")[0]).sort().join("+");
            gapCounts[k] = (gapCounts[k] ?? 0) + 1;
          } else kindCounts[x.kind] = (kindCounts[x.kind] ?? 0) + 1;
        }
        const real = P.anomalies.filter((x) => x.kind !== "persist-gap-auto");
        if ((real.length || P.errors.length) && findings.length < 300) findings.push({ id: P.id, anomalies: real, errors: P.errors });
      }
    }
    fz.cur = null;
    const complete = frontier.length === 0;
    // Which states can still reach the end of the act?
    const can = new Set(goalVia.keys());
    const rev = new Map();
    for (const [a, set] of edges) for (const b of set) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
    const q = [...can];
    while (q.length) { const b = q.shift(); for (const a of rev.get(b) ?? []) if (!can.has(a)) { can.add(a); q.push(a); } }
    const pathTo = (k) => { const p = []; let cur = k; for (let i = 0; cur && i < 60; i++) { const s = states.get(cur); if (!s || s.via === "start") break; p.unshift(s.via); cur = s.from; } return p; };
    // A budget-limited search cannot call every state left on the frontier a softlock: it was
    // never expanded, so its own way out is unknown. Walk backwards from those unexpanded
    // states; everything that can reach one is unresolved too. What remains is a state whose
    // explored exits all dead-end: a genuine stuck state, even in a partial search.
    const unresolved = new Set();
    for (const k of states.keys()) if (!expanded.has(k)) unresolved.add(k);
    const uq = [...unresolved];
    while (uq.length) {
      const b = uq.shift();
      for (const a of rev.get(b) ?? []) if (!can.has(a) && !unresolved.has(a)) { unresolved.add(a); uq.push(a); }
    }
    const stuck = [...expanded].filter((k) => !can.has(k) && !unresolved.has(k));
    // The shallowest stuck states, each with the path that got there.
    stuck.sort((a, b) => states.get(a).depth - states.get(b).depth);
    return {
      act, states: states.size, complete, probes, ms: Math.round(performance.now() - t0),
      goals: [...goalVia.entries()].slice(0, 10), goalStates: goalVia.size, reachEnd: can.size,
      stuck: stuck.length, stuckExamples: stuck.slice(0, 25).map((k) => ({ key: k, depth: states.get(k).depth, path: pathTo(k), exits: [...edges.get(k)].length })),
      unresolved: unresolved.size, expanded: expanded.size,
      findings, gapCounts, kindCounts, frontierLeft: frontier.length,
      // A goal state of this act, to seed the next act's search with real carried flags.
      firstGoal: goalVia.size ? [...goalVia.keys()][0] : null,
      nextActRoot: fz.nextActRoots[act + 1] ?? null,
    };
  };

  /** Snapshot of the state after completing the act from the given state key's goal action (for chaining acts). */
  fz.stateSnap = () => fz.snap();
})();

/* ===================================================================== phase C: save / reload */
(() => {
  const fz = window.__fz;
  const g = window.__game;
  const SAVE = fz.SAVE_KEY;

  fz.readSave = () => { try { return JSON.parse(localStorage.getItem(SAVE)); } catch { return null; } };
  fz.live = () => ({
    act: g.act, room: g.room?.id, x: g.x, y: g.y, inventory: [...g.inventory], flags: structuredClone(g.flags),
    notes: (g.notes ?? []).map((n) => n.id), queue: structuredClone(g.queue), dialogue: g.dialogue ? g.dialogue.tree.id + "." + g.dialogue.nodeId : null,
    narration: g.narration?.text ?? null, pendingRoom: g.pendingRoom, fade: g.fade, paused: g.paused, title: g.title, won: g.won,
    cinematic: g.cinematic.active, path: g.path.length, sentence: g.sentence, history: g.history.lines.map((l) => l.text),
  });

  const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(0.05); };
  const stepUntil = (pred, max = 2000) => {
    for (let i = 0; i < max; i++) {
      if (pred()) return true;
      // A waiting line is the player's now: a scripted "wait until" means read on, so click
      // it on instead of relying on the old automatic pace.
      if (g.prefs.waitForClick && g.queue && g.narration &&
          g.narration.shown >= g.narration.text.length && !g.inputLocked()) {
        g.onClick(960, 300, 0, 1);
        continue;
      }
      g.update(0.05);
    }
    return pred();
  };
  fz.stepUntil = stepUntil;
  const hs = (id) => g.room.hotspots.find((h) => h.id === id);
  const click = (id, n = 1) => g.onHotspotClick(g.hotspotState(hs(id)), n);

  /** Do one scripted action the way the input layer would. */
  fz.doAction = (a) => {
    switch (a.kind) {
      case "verb": g.setVerb(a.verb); click(a.hs); break;
      case "smart": click(a.hs, 1); break;
      case "double": click(a.hs, 2); break;
      case "itemOn": g.setVerb(a.verb); g.pickItem(a.item); click(a.hs); break;
      case "itemItem": g.setVerb(a.verb); g.pickItem(a.item); g.pickItem(a.item2); break;
      case "choice": g.pickChoice(a.i); break;
      case "advance": g.advanceDialogue(); break;
      case "leave": g.leaveDialogue(); break;
      case "speak": g.speak(a.text); break;
      case "go": g.goRoom(a.room); break;
      case "effects": g.runEffects(a.list); break;
      case "pause": g.setPaused(true); break;
      case "casebook": g.casebook.show(g.notes); break;
      case "history": g.history.show(); break;
      case "settle": fz.settle(fz.newProbe("setup"), a.steps ?? 4000); break;
      case "steps": step(a.n); break;
      case "until": stepUntil(new Function("g", "return " + a.cond).bind(null, g), a.max ?? 3000); break;
      case "skip": fz.skipCinematics(fz.newProbe("skip")); break;
      default: throw new Error("doAction " + a.kind);
    }
  };

  /**
   * Build a scenario and freeze it: the rAF loop is stopped so nothing moves between this and the
   * reload; what's in storage is exactly what a closed tab would leave.
   */
  fz.scenario = (spec) => {
    const P = fz.newProbe("setup:" + spec.name);
    fz.cur = P;
    fz.stopOverlays();
    g.resetState();
    g.title = false;
    g.startAct(spec.act);
    if (!spec.freshStart) fz.runToEnd(P, { explore: false });
    if (spec.room && g.room.id !== spec.room) { g.devGoRoom(spec.room); fz.runToEnd(P, { explore: false }); }
    if (spec.flags) Object.assign(g.flags, spec.flags);
    if (spec.inventory) g.inventory = [...spec.inventory];
    if (spec.flags || spec.inventory) g.persist();
    for (const a of spec.actions ?? []) fz.doAction(a);
    g.frame = function () { /* frozen for the reload */ };
    fz.cur = null;
    return { live: fz.live(), save: fz.readSave(), errors: P.errors, anomalies: P.anomalies };
  };

  /** After Continue: settle (walking away from any conversation), then report the game's state and invariants. */
  fz.afterContinue = ({ settle = true } = {}) => {
    const P = fz.newProbe("after-continue");
    fz.cur = P;
    const atLoad = fz.live();
    const opened = [];
    if (settle) {
      for (let i = 0; i < 12; i++) {
        const r = fz.settle(P);
        if (r === "dialogue") { opened.push(g.dialogue.tree.id + "." + g.dialogue.nodeId); g.leaveDialogue(); continue; }
        if (r === "cinematic") { opened.push("cinematic"); fz.skipCinematics(P); continue; }
        break;
      }
    }
    if (fz.isIdle()) fz.checkIdle(P, "after continue");
    fz.cur = null;
    return { atLoad, settled: fz.live(), opened, idle: fz.isIdle(), locked: g.inputLocked(), anomalies: P.anomalies, errors: P.errors };
  };

  /** A hotspot to click for the "still playable" check: the first visible one whose centre hits it. */
  fz.clickTarget = () => {
    for (const h of g.visibleHotspots()) {
      const c = "rect" in h.area ? { x: h.area.rect.x + h.area.rect.w / 2, y: h.area.rect.y + h.area.rect.h / 2 }
        : { x: h.area.reduce((s, p) => s + p.x, 0) / h.area.length, y: h.area.reduce((s, p) => s + p.y, 0) / h.area.length };
      const max = Math.max(0, (g.room.width ?? 1920) - 1920);
      const cam = Math.max(0, Math.min(max, c.x - 960));
      if (c.y > 700) continue;
      g.cameraX = cam; g.focusCameraX = c.x;
      if (g.hotspotAt(c.x, c.y)?.id === h.id) return { id: h.id, x: c.x - cam, y: c.y };
    }
    return null;
  };
  fz.reactionKey = () => JSON.stringify([g.narration?.text ?? null, g.path.length > 0, g.dialogue?.nodeId ?? null, g.sentence.verb, g.pendingRoom, g.queue?.length ?? 0]);
})();

/* random interrupted scenarios for phase C */
(() => {
  const fz = window.__fz;
  const g = window.__game;
  /** mulberry32 */
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  /** A random act, room and action, cut off at a random moment. Returns a spec fz.scenario can replay. */
  fz.randomSpec = (seed) => {
    const r = rng(seed);
    const act = pick(r, Object.keys(fz.M.ACTS).map(Number));
    const room = pick(r, [...fz.validRooms[act]]);
    const P = fz.newProbe("rand");
    fz.cur = P;
    fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(act);
    fz.runToEnd(P, { explore: false });
    if (g.room.id !== room) { g.devGoRoom(room); fz.runToEnd(P, { explore: false }); }
    const base = fz.snap();
    // Prefer actions with consequences: written effects, exits, combos.
    const all = fz.actionsFor(base, { items: true, alone: false });
    const juicy = fz.actionsFor(base, { items: true, alone: false, meaningfulOnly: true });
    const action = r() < 0.75 && juicy.length ? pick(r, juicy) : pick(r, all);
    const cut = pick(r, ["mid-walk", "mid-queue", "mid-dialogue", "fade", "steps", "paused"]);
    const actions = [];
    if (action.kind === "smart" || action.kind === "right") actions.push({ kind: "smart", hs: action.hs });
    else if (action.kind === "onItem") actions.push({ kind: "itemOn", verb: action.verb, item: action.item, hs: action.hs });
    else actions.push(action);
    switch (cut) {
      case "mid-walk": actions.push({ kind: "until", cond: "g.path.length > 0", max: 5 }, { kind: "steps", n: 1 + Math.floor(r() * 30) }); break;
      case "mid-queue": actions.push({ kind: "until", cond: "g.queue !== null || g.dialogue !== null || g.pendingRoom !== null", max: 1500 }); break;
      case "mid-dialogue": {
        actions.push({ kind: "until", cond: "g.dialogue !== null", max: 2500 });
        const depth = Math.floor(r() * 5);
        for (let i = 0; i < depth; i++) actions.push({ kind: "choiceRandom", seed: Math.floor(r() * 1e9) });
        break;
      }
      case "fade": actions.push({ kind: "until", cond: "g.pendingRoom !== null && g.fade > 0.15", max: 2500 }); break;
      case "steps": actions.push({ kind: "steps", n: Math.floor(r() * 400) }); break;
      case "paused": actions.push({ kind: "steps", n: Math.floor(r() * 120) }, { kind: "pause" }); break;
    }
    fz.cur = null;
    return { name: `rand${seed}:${act}:${room}:${action.id}:${cut}`, act, room, actions, cut };
  };
  const base = fz.doAction;
  fz.doAction = (a) => {
    if (a.kind !== "choiceRandom") return base(a);
    if (!g.dialogue) return;
    const r = rng(a.seed);
    const vis = g.visibleChoices();
    if (vis.length) g.pickChoice(Math.floor(r() * vis.length)); else g.advanceDialogue();
  };
})();


/* ===================================================================== phase R: monkey */
(() => {
  const fz = window.__fz;
  const g = window.__game;
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ev = (repeat = false, shiftKey = false) => ({ repeat, shiftKey, preventDefault() {} });
  // The icon bar's plates (game.ts BAR/barLayout): 52 px squares, right edge 1896, 8 px apart. The map
  // plate (x 1784) is left out: it opens the atlas, a modal the monkey would then sit behind.
  const BAR = { reveal: [1544, 52], log: [1604, 52], tip: [1664, 52], casebook: [1724, 52], pause: [1844, 52] };

  /** Screen point inside a hotspot (camera brought round to it, as a player would by walking). */
  const hotspotPoint = (h, r) => {
    let c;
    if ("rect" in h.area) {
      const a = h.area.rect;
      c = { x: a.x + a.w * (0.2 + 0.6 * r()), y: a.y + a.h * (0.2 + 0.6 * r()) };
    } else {
      c = { x: h.area.reduce((s, p) => s + p.x, 0) / h.area.length, y: h.area.reduce((s, p) => s + p.y, 0) / h.area.length };
    }
    const max = Math.max(0, (g.room.width ?? 1920) - 1920);
    if (c.x - g.cameraX < 40 || c.x - g.cameraX > 1880) { g.cameraX = Math.max(0, Math.min(max, c.x - 960)); }
    return { x: c.x - g.cameraX, y: Math.min(c.y, 879) };
  };

  /** One random player input on whatever is on screen. Returns a description. */
  fz.monkeyStep = (r) => {
    const roll = r();
    if (g.cinematic.active) { g.cinematic.skip(); return "skip cinematic"; }
    if (g.paused) {
      if (roll < 0.75) { g.settings.actions.resume(); return "settings: resume"; }
      if (roll < 0.95) { g.settings.actions.title(); return "settings: title"; }
      g.settings.actions.restart(); return "settings: restart";
    }
    if (g.casebook.open || g.history.open) { g.onKey("Escape", ev()); return "Escape (close overlay)"; }
    if (g.atlas?.open) { g.onKey("Escape", ev()); return "Escape (close atlas)"; }
    if (g.title) {
      if (g.hasSave && roll < 0.85) { g.onKey("c", ev()); return "title: C"; }
      g.onKey("Enter", ev()); return "title: Enter";
    }
    if (g.won) { g.onClick(960, 540, 0, 1); return "click ending card"; }
    if (g.explore && roll < 0.08) { g.onKey("r", ev()); return "explore: R"; }
    if (g.roomMenu) {
      const rooms = g.exploreRooms(); const i = Math.floor(r() * rooms.length); const b = g.roomMenuRect(i);
      g.onClick(b.x + 20, b.y + 20, 0, 1); return "explore: go " + rooms[i]?.id;
    }
    const UI = fz.M.UI;
    if (g.dialogue) {
      const vis = g.visibleChoices();
      if (roll < 0.45 && vis.length) {
        const m = g.dialogueModel(); const i = Math.floor(r() * vis.length); const rect = m.layout.rects[i];
        g.onClick(rect.x + 40, rect.y + rect.h / 2, 0, 1); return "click choice " + (i + 1);
      }
      if (roll < 0.6 && vis.length) { const k = String(1 + Math.floor(r() * Math.min(9, vis.length + 1))); g.onKey(k, ev()); return "key " + k; }
      if (roll < 0.8) { g.onKey("Enter", ev()); return "Enter"; }
      if (roll < 0.9) { g.onClick(960, 300, 2, 1); return "right-click (leave)"; }
      g.onClick(200 + r() * 1500, 100 + r() * 900, 0, 1); return "click anywhere";
    }
    const hss = g.visibleHotspots();
    if (roll < 0.34 && hss.length) {
      const h = hss[Math.floor(r() * hss.length)]; const p = hotspotPoint(h, r); g.onClick(p.x, p.y, 0, 1); return "click " + h.id;
    }
    if (roll < 0.40 && hss.length) {
      const h = hss[Math.floor(r() * hss.length)]; const p = hotspotPoint(h, r); g.onClick(p.x, p.y, 2, 1); return "right-click " + h.id;
    }
    if (roll < 0.44 && hss.length) {
      const h = hss[Math.floor(r() * hss.length)]; const p = hotspotPoint(h, r); g.onClick(p.x, p.y, 0, 1); g.onClick(p.x, p.y, 0, 2); return "double-click " + h.id;
    }
    if (roll < 0.58) {
      const i = Math.floor(r() * fz.M.VERBS.length); const v = UI.verbRect(i, g.textScale); g.onClick(v.x + v.w / 2, v.y + v.h / 2, 0, 1); return "verb " + fz.M.VERBS[i].id;
    }
    if (roll < 0.70 && g.inventory.length) {
      const items = g.pageInventory(); const id = items[Math.floor(r() * items.length)];
      if (id) { g.onPanelHit({ kind: "item", id }); return "item " + id; }
    }
    if (roll < 0.78) { const x = r() * 1920, y = 300 + r() * 560; g.onClick(x, y, 0, r() < 0.2 ? 2 : 1); return "floor " + Math.round(x) + "," + Math.round(y); }
    if (roll < 0.90) {
      const keys = ["Enter", " ", "Tab", "ArrowRight", "ArrowDown", "ArrowLeft", "1", "2", "q", "h", "j", "l", "Escape"];
      const k = keys[Math.floor(r() * keys.length)]; g.onKey(k, ev(r() < 0.1, r() < 0.2)); if (k === "q") g.revealHeld = false; return "key " + k;
    }
    if (roll < 0.96) {
      const ids = Object.keys(BAR); const id = ids[Math.floor(r() * ids.length)]; const b = BAR[id];
      g.onClick(b[0] + b[1] / 2, 40, 0, 1); return "bar " + id;
    }
    if (roll < 0.99) { g.onClick(960, 300, 2, 1); return "right-click empty"; }
    // Simulate a reload: what's in storage is what Continue gets.
    g.title = true; g.resetTransient(); g.titleActivate("continue"); if (g.recap?.open) g.recap.sail(); return "reload+continue";
  };

  fz.monkey = (seed, { steps = 400, act = null, items = false, touch = false, explore = false } = {}) => {
    const r = rng(seed);
    const P = fz.newProbe("monkey" + seed);
    fz.cur = P;
    const startAct = act ?? 1 + Math.floor(r() * 4);
    fz.stopOverlays(); g.resetState(); g.title = false;
    let sentinel = null;
    if (explore) {
      // A real save that Chapter select must never touch.
      g.startAct(startAct); g.persist();
      sentinel = localStorage.getItem(fz.SAVE_KEY);
      g.title = true; g.titleActivate("explore");
      g.exploreGo(Math.floor(r() * g.exploreRooms().length));
    } else g.startAct(startAct);
    const rooms = [...fz.validRooms[startAct]];
    if (!explore && r() < 0.7) g.devGoRoom(rooms[Math.floor(r() * rooms.length)]);
    if (touch) { const oc = g.onClick.bind(g); g.onClick = (x, y, b, c) => { g.touch = true; return oc(x, y, b, c); }; }
    if (items || r() < 0.5) { for (const it of fz.actItems[startAct]) if (r() < 0.6 && !g.inventory.includes(it)) g.inventory.push(it); g.persist(); }
    const log = [];
    let locked = 0, sameFor = 0, lastKey = "";
    const visits = { rooms: new Set(), acts: new Set([startAct]) };
    for (let i = 0; i < steps; i++) {
      let desc;
      // Continue (or Enter on the title) puts up the "Previously" card, which holds the room until
      // Set sail; the monkey is a player, and a player presses it.
      try { desc = fz.monkeyStep(r); if (g.recap?.open) g.recap.sail(); } catch (e) { fz.err(P, "input #" + i + " " + (desc ?? "?"), e); log.push("THREW"); break; }
      log.push(desc);
      const n = Math.floor(r() ** 2 * 120);
      for (let k = 0; k < n; k++) {
        if (g.paused || g.title || g.cinematic.active) break;
        try { g.update(0.05); } catch (e) { fz.err(P, "update after " + desc, e); break; }
        if (g.inputLocked()) { locked += 0.05; if (locked > 10 && !P._f.lock) { P._f.lock = 1; fz.anom(P, "input-locked>10s", { after: log.slice(-6), at: fz.brief() }); } } else locked = 0;
      }
      try { g.render(); } catch (e) { fz.err(P, "render after " + desc, e); }
      if (!Number.isFinite(g.x) || !Number.isFinite(g.y)) { fz.anom(P, "nan-state", { after: log.slice(-6) }); break; }
      if (g.dialogue && !g.currentNode()) fz.anom(P, "dialogue-node-missing", { after: log.slice(-6) });
      if (!g.title && g.room) {
        visits.rooms.add(g.act + ":" + g.room.id); visits.acts.add(g.act);
        if (!fz.validRooms[g.act]?.has(g.room.id)) fz.anom(P, "room-not-in-act", { act: g.act, room: g.room.id, after: log.slice(-6) });
        for (const id of g.inventory) if (!fz.M.ITEMS[id]) fz.anom(P, "unknown-item", { id, after: log.slice(-6) });
        if (!g.path.length && !g.pendingRoom) {
          const c = fz.M.clampToFloor({ x: g.x, y: g.y }, g.room.walk);
          if (Math.hypot(c.x - g.x, c.y - g.y) > fz.OFF_FLOOR) fz.anom(P, "off-floor", { room: g.room.id, x: g.x, y: g.y, after: log.slice(-6) });
        }
        if (g.queue && !g.dialogue && g.narration && g.narrationClock > g.queueDue + 30 && !g.prefs.waitForClick) fz.anom(P, "queue-stale", { at: fz.brief(), after: log.slice(-6) });
      }
      const key = fz.reactionKey ? fz.reactionKey() + g.room?.id : "";
      sameFor = key === lastKey ? sameFor + 1 : 0; lastKey = key;
    }
    fz.cur = null;
    if (touch) delete g.onClick;
    if (explore && g.explore && localStorage.getItem(fz.SAVE_KEY) !== sentinel) fz.anom(P, "explore-wrote-save", { tail: log.slice(-8) });
    if (explore) { g.explore = false; g.roomMenu = false; }
    return { seed, startAct, steps: log.length, anomalies: P.anomalies, errors: P.errors, tail: log.slice(-12), visited: [...visits.rooms], acts: [...visits.acts], won: g.won };
  };
})();

/* ===================================================================== interrupt fuzz */
(() => {
  const fz = window.__fz;
  const g = window.__game;
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const AUTO = (f) => f.startsWith("seen:") || f.startsWith("looked:");

  const centre = (h) => "rect" in h.area ? { x: h.area.rect.x + h.area.rect.w / 2, y: h.area.rect.y + h.area.rect.h / 2 }
    : { x: h.area.reduce((s, p) => s + p.x, 0) / h.area.length, y: h.area.reduce((s, p) => s + p.y, 0) / h.area.length };
  /** A screen point that hits this hotspot (camera moved if needed, as the player's view would be). */
  const pointFor = (id) => {
    const h = g.room.hotspots.find((x) => x.id === id);
    const c = centre(h);
    const max = Math.max(0, (g.room.width ?? 1920) - 1920);
    if (c.x - g.cameraX < 30 || c.x - g.cameraX > 1890) g.cameraX = Math.max(0, Math.min(max, c.x - 960));
    const p = { x: c.x - g.cameraX, y: c.y };
    return g.hotspotAt(c.x, c.y)?.id === id && p.y < 880 ? p : null;
  };
  const verbPoint = (verb) => { const i = fz.M.VERBS.findIndex((v) => v.id === verb); const r = fz.M.UI.verbRect(i, g.textScale); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
  const itemPoint = (id) => { const all = g.inventory; const i = all.indexOf(id); g.inventoryPage = Math.floor(i / 8); const s = i % 8; return { x: 1010 + (s % 4) * 215 + 102, y: 918 + Math.floor(s / 4) * 84 + 37 }; };

  /** Clicks for an action, as screen points. */
  const clicksFor = (a) => {
    const out = [];
    if (a.kind === "verb") out.push(["verb", verbPoint(a.verb)], ["hs", a.hs]);
    else if (a.kind === "itemOn") out.push(["verb", verbPoint(a.verb)], ["item", a.item], ["hs", a.hs]);
    else if (a.kind === "itemItem") out.push(["verb", verbPoint(a.verb)], ["item", a.item], ["item", a.item2]);
    else if (a.kind === "smart") out.push(["hs", a.hs]);
    return out;
  };
  const doClicks = (clicks, between = 3) => {
    for (const [kind, v] of clicks) {
      let p = v;
      if (kind === "hs") p = pointFor(v);
      if (kind === "item") p = itemPoint(v);
      if (!p) return false;
      g.onClick(p.x, p.y, 0, 1);
      for (let i = 0; i < between; i++) g.update(0.05);
    }
    return true;
  };
  const outcome = (P) => {
    const r = fz.runToEnd(P, { explore: false });
    return JSON.stringify({
      r, room: g.room.id, act: g.act, inv: [...g.inventory].sort(),
      flags: Object.keys(g.flags).filter((k) => !AUTO(k)).sort().map((k) => k + "=" + JSON.stringify(g.flags[k])),
      dialogues: P.outcome.dialogues ?? [], narration: P.outcome.dialogues ? null : g.narration?.text ?? null,
    });
  };

  fz.interruptFuzz = (act, room, { n = 60, seed = 1 } = {}) => {
    const r = rng(seed * 7919 + act * 101 + room.length);
    const P0 = fz.newProbe("ifz"); fz.cur = P0;
    fz.stopOverlays(); g.resetState(); g.title = false; g.startAct(act); fz.runToEnd(P0, { explore: false });
    if (g.room.id !== room) { g.devGoRoom(room); fz.runToEnd(P0, { explore: false }); }
    const extra = [...fz.actItems[act]].filter((i) => !g.inventory.includes(i));
    g.inventory.push(...extra.filter(() => r() < 0.7));
    g.persist();
    const base = fz.snap();
    // First actions: harmless walks (a smart click whose verb has no effects), from far away.
    const firsts = fz.actionsFor(base, { items: false }).filter((a) => a.kind === "smart");
    const seconds = fz.actionsFor(base, { items: true, alone: false, meaningfulOnly: true }).filter((a) => a.kind !== "itemItem" || true);
    const mism = [];
    let tried = 0;
    for (let i = 0; i < n && seconds.length && firsts.length; i++) {
      const A2 = seconds[Math.floor(r() * seconds.length)];
      const A1 = firsts[Math.floor(r() * firsts.length)];
      // Clean outcome of A2.
      const Pc = fz.newProbe("clean"); fz.cur = Pc;
      fz.restore(base);
      if (!doClicks(clicksFor(A2))) continue;
      const clean = outcome(Pc);
      // A1, then A2 while A1's walk is under way.
      const Pi = fz.newProbe("interrupt"); fz.cur = Pi;
      fz.restore(base);
      // Start far from A1's target so its walk takes a while.
      const far = fz.M.clampToFloor({ x: g.x < (g.room.width ?? 1920) / 2 ? (g.room.width ?? 1920) - 50 : 50, y: g.y }, g.room.walk);
      g.x = far.x; g.y = far.y;
      if (!doClicks(clicksFor(A1), 1)) continue;
      const st1 = g.hotspotState(g.room.hotspots.find((h) => h.id === A1.hs));
      if (g.isExit(st1) || st1.do?.[g.sentence.verb ?? "look"]) continue;   // A1 must be harmless
      if (!g.path.length) continue;
      const k = 1 + Math.floor(r() * 8);
      for (let j = 0; j < k && g.path.length; j++) g.update(0.05);
      if (!g.path.length) continue;
      const sentence = JSON.stringify([g.sentence.verb, g.sentence.a?.id, g.sentence.b?.id]);
      doClicks(clicksFor(A2));
      const interrupted = outcome(Pi);
      tried++;
      if (interrupted !== clean) {
        mism.push({ A1: A1.id, A2: A2.id, sentenceDuringWalk: sentence, clean: JSON.parse(clean), interrupted: JSON.parse(interrupted) });
      }
    }
    fz.cur = null;
    return { act, room, tried, mismatches: mism };
  };
})();

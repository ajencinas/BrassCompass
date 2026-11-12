/**
 * Fast checks for the .adv scripts (a second or two, no browser):
 *
 *  1. every script compiles, with every name resolving (items, rooms, conversations, nodes,
 *     speakers, images); warnings are printed;
 *  2. the language round-trips: writing the compiled data back out as scripts and compiling
 *     that gives exactly the same data, so the compiler and serialize.ts agree;
 *  3. every room's atmosphere (lights, water, haze, motes, beacon, emitters) sits on its painting;
 *  4. with --against REV, the compiled data equals the hand-written TypeScript content of that
 *     git revision (the conversion proof; 1014f5e is the last TypeScript revision).
 *
 *   npm run test:scripts
 *   npm run test:scripts -- --against 1014f5e
 */

import assert from "node:assert/strict";
import { choiceTerminalNodes, contentAt, contentOf, deadTips, differences, flagReachability, loader, readScripts } from "./adv-lib.mjs";
import { resolve } from "node:path";

const vite = await loader();
try {
  const { compile, formatError } = await vite.load("/src/adv/compile.ts");
  const ser = await vite.load("/src/adv/serialize.ts");
  const { CHARACTERS } = await vite.load("/src/content/characters.ts");
  const { MANIFEST } = await vite.load("/src/content/assets.ts");
  const options = { characters: CHARACTERS, images: MANIFEST.images, music: MANIFEST.audio };

  const files = readScripts(process.env.ADV_DIR ? resolve(process.env.ADV_DIR) : undefined);
  const t0 = performance.now();
  const result = compile(files, options);
  const ms = performance.now() - t0;
  const errors = result.errors.filter((e) => !e.warning);
  const warnings = result.errors.filter((e) => e.warning);
  if (warnings.length) console.log("script warnings:\n  " + warnings.map(formatError).join("\n  "));
  if (errors.length) console.log("script errors:\n  " + errors.map(formatError).join("\n  "));
  assert.equal(errors.length, 0, "the scripts must compile cleanly");
  console.log(`compiled ${files.length} scripts in ${ms.toFixed(0)} ms: ${Object.keys(result.rooms).length} rooms, ` +
    `${Object.keys(result.dialogues).length} conversations, ${Object.keys(result.items).length} items`);

  // 2. compile(serialize(compile(scripts))) == compile(scripts)
  const groupStart = new Map(Object.entries(result.groups).map(([name, list]) => [list[0], { name, size: list.length }]));
  const again = [
    ...Object.values(result.rooms).map((r) => ({ path: `rooms/${r.id}.adv`, text: ser.room(r, (c) => groupStart.get(c)) })),
    ...Object.values(result.dialogues).map((t) => ({ path: `dialogue/${t.id}.adv`, text: ser.dialogue(t) })),
    { path: "items.adv", text: ser.items(Object.values(result.items)) },
    { path: "tips.adv", text: ser.tips(result.tips) },
    { path: "combos.adv", text: ser.combos(result.combos, result.groups) },
    { path: "acts.adv", text: ser.acts(Object.values(result.acts), result.ending) },
  ];
  const second = compile(again, options);
  assert.deepEqual(second.errors.filter((e) => !e.warning).map(formatError), []);
  assert.deepEqual(differences(contentOf(result), contentOf(second)), [], "serialize and compile must agree");
  console.log("round trip: serialize -> compile gives identical data");

  // A few deliberate mistakes, to keep the error messages honest.
  const bad = compile([{ path: "bad.adv", text: [
    'room r "R"',
    "  bg bg_dock_wide",
    "  perspective horizon 1 ref 2 height 3",
    "  walk (0,0) (10,0) (10,10)",
    "  entry 5,5",
    '  hotspot h "H"',
    "    area 0,0 10x10",
    '    look "x"',
    "      give lemmon",
    '    lok "typo"',
    "  light 10,10 radius 5 torch",
  ].join("\n") }]);
  const msgs = bad.errors.map(formatError);
  assert.ok(msgs.includes("bad.adv:9:7: no item 'lemmon'"), msgs.join("\n"));
  assert.ok(msgs.some((m) => m.startsWith("bad.adv:10:5: 'lok' doesn't belong in a hotspot")), msgs.join("\n"));
  assert.ok(msgs.some((m) => m.startsWith("bad.adv:11:24: no light kind 'torch'")), msgs.join("\n"));
  console.log("error locations: ok");

  // 3. the atmosphere sits on the painting: a point off the plate is a typo, not an effect.
  const SCENE_H = 880;
  const off = [];
  for (const r of Object.values(result.rooms)) {
    const width = r.width ?? 1920;
    const at = (what, p) => { if (p.x < 0 || p.x > width || p.y < 0 || p.y > SCENE_H) off.push(`${r.id}: ${what} at ${p.x},${p.y} is off the ${width}x${SCENE_H} painting`); };
    (r.lights ?? []).forEach((l, i) => at(`light ${i + 1}`, l.at));
    (r.water ?? []).forEach((w, i) => w.area.forEach((p) => at(`water ${i + 1}`, p)));
    (r.motes ?? []).forEach((m, i) => m.area.forEach((p) => at(`${m.kind} ${i + 1}`, p)));
    (r.emitters ?? []).forEach((e) => e.at && at(`emit ${e.kind}`, e.at));
    if (r.beacon) at("beacon", r.beacon.at);
    for (const h of r.haze ?? []) if (h.top < 0 || h.bottom > SCENE_H + 200) off.push(`${r.id}: haze ${h.top}-${h.bottom} is off the painting`);
  }
  assert.deepEqual(off, [], "atmosphere placement");
  // A room with no atmosphere at all is the other half of the same typo: it is how two rooms
  // added late were missed while this check printed "every point on its painting".
  const bare = Object.values(result.rooms).filter((r) =>
    !r.footsteps && !r.lights?.length && !r.water?.length && !r.haze?.length &&
    !r.motes?.length && !r.beacon && !r.emitters?.length).map((r) => r.id);
  assert.deepEqual(bare, [], "every room needs atmosphere (footsteps, a light, water or a sound)");
  const counts = Object.values(result.rooms).reduce((n, r) => n + (r.lights?.length ?? 0), 0);
  console.log(`atmosphere: ${counts} lights; every point on its painting; no bare rooms`);

  // 3b. dialogue reachability. A tree is entered at its start by a plain `talk tree`, and at a node
  // by `talk tree at node`; every other node has to be reachable from one of those through
  // `next` and the choices. A root choice gated on an act that no plain entry can be in, and a
  // choice hidden by a flag its own node has just set, are dead for the same reason.
  {
    const entries = new Map(); // tree -> { plain: Set<room|"*">, at: Set<node> }
    const entry = (tree) => entries.get(tree) ?? entries.set(tree, { plain: new Set(), at: new Set() }).get(tree);
    const scan = (v, room) => {
      if (!v || typeof v !== "object") return;
      if (v.k === "talk" && typeof v.tree === "string") { const e = entry(v.tree); if (v.node) e.at.add(v.node); else e.plain.add(room); }
      for (const x of Array.isArray(v) ? v : Object.values(v)) scan(x, room);
    };
    const roomActs = {};
    const actsIn = (v, out) => {
      if (!v || typeof v !== "object") return out;
      if (v.act !== undefined && typeof v.act !== "function" && (typeof v.act === "number" || Array.isArray(v.act))) [].concat(v.act).forEach((n) => out.add(n));
      for (const x of Array.isArray(v) ? v : Object.values(v)) actsIn(x, out);
      return out;
    };
    for (const r of Object.values(result.rooms)) { scan(r, r.id); roomActs[r.id] = actsIn(r, new Set()); }
    for (const t of Object.values(result.dialogues)) for (const n of Object.values(t.nodes)) scan(n, "*");
    scan({ items: result.items, combos: result.combos, groups: result.groups, acts: result.acts, ending: result.ending }, "*");
    const dead = [];
    for (const t of Object.values(result.dialogues)) {
      const e = entries.get(t.id) ?? { plain: new Set(), at: new Set() };
      const stack = [...e.at];
      if (e.plain.size) stack.push(t.start);
      else if (!e.at.size) dead.push(`${t.id}: nothing ever opens this conversation`);
      const seen = new Set();
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id) || !t.nodes[id]) continue;
        seen.add(id);
        const n = t.nodes[id];
        if (n.next) stack.push(n.next);
        for (const c of n.choices ?? []) stack.push(c.to);
      }
      for (const id of Object.keys(t.nodes)) if (!seen.has(id)) dead.push(`${t.id}.${id}: unreachable node`);
      // choices that can never show
      const starts = [...e.plain].filter((x) => x !== "*");
      const actsOfEntry = new Set();
      let anyAct = e.plain.has("*") || e.plain.size === 0;
      for (const room of starts) { const a = roomActs[room]; if (!a?.size) anyAct = true; else a.forEach((x) => actsOfEntry.add(x)); }
      for (const n of Object.values(t.nodes)) {
        const setsTrue = new Set((n.do ?? []).filter((x) => x.k === "flag" && x.v !== false).map((x) => x.id));
        for (const c of n.choices ?? []) {
          for (const cond of c.if ?? []) {
            if ("flag" in cond && cond.is === false && setsTrue.has(cond.flag)) dead.push(`${t.id}.${n.id}: choice "${c.text}" is hidden by '${cond.flag}', which the node sets first`);
            if (n.id === t.start && "act" in cond && !anyAct && ![].concat(cond.act).some((a) => actsOfEntry.has(a)))
              dead.push(`${t.id}.${n.id}: choice "${c.text}" needs act ${[].concat(cond.act)} but the conversation is only opened from rooms of act ${[...actsOfEntry]}`);
          }
        }
      }
    }
    assert.deepEqual(dead, [], "dialogue nodes and choices must be reachable");
    console.log(`dialogue: every node and root choice reachable (${Object.keys(result.dialogues).length} conversations)`);
  }

  // 3c. tip ladder lint: the first tip whose conditions hold is the current one, so a rung that
  // an earlier rung always shadows can never be shown. Per act, every combination of the flags,
  // items and rooms its rungs read is tried, but only over states the act can reach: a flag it
  // can never have (one set only by the effect that ends the act, or an ending flag the save
  // strips) is false, and one its opening scene always sets is true. Each rung must be the first
  // match for at least one such state. (3d, just below, forbids a node with choices and a terminal.)
  {
    const { actReach } = await vite.load("/src/game/reach.ts");
    const { ENDING_RESET_FLAGS } = await vite.load("/src/game/save.ts");
    const reach = actReach({ rooms: result.rooms, dialogues: result.dialogues, acts: result.acts, combos: result.combos });
    const flags = flagReachability({ ...result, reach, endingFlags: ENDING_RESET_FLAGS });
    const dead = deadTips(result.tips, Object.keys(result.acts).map(Number), flags, (n) => reach.get(n)?.rooms ?? new Set());
    assert.deepEqual(dead, [], "every tip rung must be reachable");
    console.log(`tips: ${result.tips.length} rungs, none shadowed or unreachable`);
  }

  // 3d. a conversation node offers choices or ends, not both: a terminal (go, talk, act, win)
  // beside choices would run when the talk ends from the node, and again from a mid-node save.
  {
    const both = choiceTerminalNodes(result.dialogues);
    assert.deepEqual(both, [], "a node with choices must not also have go/talk/act/win");
    console.log("dialogue: no node has both choices and a terminal effect");
  }

  // 4. the conversion proof
  const i = process.argv.indexOf("--against");
  if (i > 0) {
    const rev = process.argv[i + 1];
    const old = await contentAt(rev);
    const diff = differences(contentOf(old), contentOf(result));
    if (diff.length) console.log(diff.join("\n"));
    assert.deepEqual(diff, [], `the scripts must match ${rev}`);
    console.log(`identical to the TypeScript content of ${rev}`);
  }
} finally {
  await vite.close();
}

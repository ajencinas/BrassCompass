// Tips: the `nudge` grammar in tips.adv, its round trip, and the ladder (nudge first, then the answer).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { compile, formatError } = await vite.load("/src/adv/compile.ts");
const ser = await vite.load("/src/adv/serialize.ts");
const { TipLadder, TIP_FALLBACK, TIP_AGAIN } = await vite.load("/src/game/tips.ts");

const BASE = [
  { path: "acts.adv", text: 'act 1 "One"\n  start dock\n' },
  { path: "items.adv", text: 'item lemon "lemon"\n  look "A lemon."\n' },
  { path: "rooms/dock.adv", text: 'room dock "Dock"\n  bg bg_dock\n  perspective horizon 1 ref 2 height 3\n  walk (0,0) (10,0) (10,10)\n  entry 5,5\n' },
];
const tips = (text) => compile([...BASE, { path: "tips.adv", text }], {});
const errors = (text) => tips(text).errors.map(formatError);

// ------------------------------------------------------------------ grammar

test("a tip with a nudge compiles, nudge before or after its line", () => {
  for (const text of [
    'tip if has lemon\n  nudge "Somebody wants a lemon."\n  "Give the lemon to Marta."\n',
    'tip if has lemon\n  "Give the lemon to Marta."\n  nudge "Somebody wants a lemon."\n',
  ]) {
    const c = tips(text);
    assert.deepEqual(c.errors.map(formatError), []);
    assert.deepEqual(c.tips, [{ if: [{ has: "lemon" }], text: "Give the lemon to Marta.", nudge: "Somebody wants a lemon." }]);
  }
});

test("a tip without a nudge has no nudge key at all", () => {
  const c = tips('tip\n  "Look around."\n');
  assert.deepEqual(c.errors.map(formatError), []);
  assert.deepEqual(c.tips, [{ if: [], text: "Look around." }]);
  assert.equal("nudge" in c.tips[0], false);
});

test("tip mistakes are reported on their own line", () => {
  const cases = [
    ['tip\n  nudge "One."\n  nudge "Two."\n  "Line."\n', "tips.adv:3:3: a tip has one nudge"],
    ['tip\n  "Line."\n  "Another line."\n', "tips.adv:3:3: a tip has one line"],
    ['tip\n  nudge "Only a nudge."\n', "tips.adv:1:1: put the tip in quotes on the next line"],
    ['tip\n', "tips.adv:1:1: put the tip in quotes on the next line"],
    ['tip\n  hint "No."\n  "Line."\n', "tips.adv:2:3: a tip holds its line in quotes, and optionally nudge"],
    ['tip\n  nudge\n  "Line."\n', "tips.adv:2:"],
    ['tip\n  "Line." "Extra."\n', "tips.adv:2:"],
    ['tip\n  nudge "N."\n    "nested"\n  "Line."\n', "tips.adv:3:5: nothing can be nested here"],
  ];
  for (const [text, expected] of cases) {
    const msgs = errors(text);
    assert.ok(msgs.some((m) => m.includes(expected)), `expected "${expected}" in:\n  ${msgs.join("\n  ")}`);
  }
});

test("tips round-trip: serialize writes the nudge, compile reads it back", () => {
  const source = 'tip if has lemon\n  nudge "Somebody wants a lemon."\n  "Give the lemon to Marta."\ntip\n  "Look around."\n';
  const first = tips(source);
  const text = ser.tips(first.tips);
  assert.match(text, /^  nudge "Somebody wants a lemon\."$/m);
  const second = tips(text);
  assert.deepEqual(second.errors.map(formatError), []);
  assert.deepEqual(second.tips, first.tips);
});

// ------------------------------------------------------------------ the ladder

/** Two tips: the first holds while `stage` is "late", the second always. */
function ladder(rules) {
  const state = { stage: "early" };
  const holds = (c) => (c.flag === "late" ? state.stage === "late" : true);
  return { state, l: new TipLadder(() => rules, holds) };
}
const RULES = [
  { if: [{ flag: "late" }], text: "Do the late thing.", nudge: "Think about late things." },
  { if: [], text: "Do the early thing.", nudge: "Think about early things." },
];

test("the first ask gives the nudge, the second the answer, and the answer stays", () => {
  const { l } = ladder(RULES);
  assert.equal(l.ask(), "Think about early things." + TIP_AGAIN);
  assert.equal(l.ask(), "Do the early thing.");
  assert.equal(l.ask(), "Do the early thing.");
  assert.equal(l.answer(), "Do the early thing.");
});

test("a new tip starts again from its nudge", () => {
  const { l, state } = ladder(RULES);
  l.ask(); l.ask();
  state.stage = "late";
  assert.equal(l.ask(), "Think about late things." + TIP_AGAIN);
  assert.equal(l.ask(), "Do the late thing.");
  // Back to a tip already answered: it stays answered.
  state.stage = "early";
  assert.equal(l.ask(), "Do the early thing.");
});

test("tip mode shows the nudge, and asking in tip mode gives the answer", () => {
  const { l } = ladder(RULES);
  assert.equal(l.shown(), "Think about early things." + TIP_AGAIN);
  assert.equal(l.shown(), "Think about early things." + TIP_AGAIN); // looking changes nothing
  assert.equal(l.ask(true), "Do the early thing.");
  assert.equal(l.shown(), "Do the early thing.");
});

test("a nudge asked for outside tip mode, then tip mode: still the nudge until asked again", () => {
  const { l } = ladder(RULES);
  l.ask();
  assert.equal(l.shown(), "Think about early things." + TIP_AGAIN);
  assert.equal(l.ask(true), "Do the early thing.");
});

test("a tip without a nudge is the answer straight away", () => {
  const { l } = ladder([{ if: [], text: "Just do it." }]);
  assert.equal(l.shown(), "Just do it.");
  assert.equal(l.ask(), "Just do it.");
});

test("no tip holds: the fallback", () => {
  const { l } = ladder([{ if: [{ flag: "late" }], text: "Late.", nudge: "Hmm." }]);
  assert.equal(l.current(), -1);
  assert.equal(l.ask(), TIP_FALLBACK);
  assert.equal(l.shown(), TIP_FALLBACK);
  assert.equal(l.answer(), TIP_FALLBACK);
});

test("reset: a new voyage starts every tip from its nudge again", () => {
  const { l } = ladder(RULES);
  l.ask(); l.ask();
  l.reset();
  assert.equal(l.ask(), "Think about early things." + TIP_AGAIN);
});

test("every Act's tips carry a nudge, and the nudge is never the answer", async () => {
  const { readScripts } = await import("../../tools/adv-lib.mjs");
  const { CHARACTERS } = await vite.load("/src/content/characters.ts");
  const { MANIFEST } = await vite.load("/src/content/assets.ts");
  const c = compile(readScripts(), { characters: CHARACTERS, images: MANIFEST.images, music: MANIFEST.audio });
  assert.deepEqual(c.errors.filter((e) => !e.warning).map(formatError), []);
  for (const t of c.tips) {
    assert.ok(t.nudge, `tip without a nudge: ${t.text}`);
    assert.notEqual(t.nudge, t.text);
    assert.ok(t.nudge.length <= 180 && t.text.length <= 180, `too long: ${t.nudge} / ${t.text}`);
  }
});

// ------------------------------------------------------------------ reachable-state lint

const lib = await import("../../tools/adv-lib.mjs");
const { actReach } = await vite.load("/src/game/reach.ts");
const { ENDING_RESET_FLAGS } = await vite.load("/src/game/save.ts");

function lintOf(files, tipList) {
  const r = compile(files, {});
  assert.deepEqual(r.errors.filter((e) => !e.warning).map(formatError), []);
  const reach = actReach({ rooms: r.rooms, dialogues: r.dialogues, acts: r.acts, combos: r.combos });
  const flags = lib.flagReachability({ ...r, reach, endingFlags: new Set() });
  return lib.deadTips(tipList ?? r.tips, Object.keys(r.acts).map(Number), flags, (n) => reach.get(n)?.rooms ?? new Set());
}

test("the shipped tip ladder has no rung that no reachable state can show", async () => {
  const { MANIFEST } = await vite.load("/src/content/assets.ts");
  const { CHARACTERS } = await vite.load("/src/content/characters.ts");
  const r = compile(lib.readScripts(), { characters: CHARACTERS, images: MANIFEST.images, music: MANIFEST.audio });
  const reach = actReach({ rooms: r.rooms, dialogues: r.dialogues, acts: r.acts, combos: r.combos });
  const flags = lib.flagReachability({ ...r, reach, endingFlags: ENDING_RESET_FLAGS });
  assert.deepEqual(lib.deadTips(r.tips, Object.keys(r.acts).map(Number), flags, (n) => reach.get(n)?.rooms ?? new Set()), []);
  assert.deepEqual(lib.choiceTerminalNodes(r.dialogues), []);
});

test("a flag set only by the effect that ends the act is dead in that act; a flag the opening scene sets is always on", () => {
  const files = [
    { path: "acts.adv", text: 'act 1 "One"\n  start dock\nact 2 "Two"\n  start dock\n' },
    { path: "items.adv", text: 'item lemon "lemon"\n  look "A lemon."\n' },
    { path: "rooms/dock.adv", text: 'room dock "Dock"\n  bg bg_dock\n  perspective horizon 1 ref 2 height 3\n  walk (0,0) (10,0) (10,10)\n  entry 5,5\n  scene if act 2 and not opened\n    set opened\n    say "x"\n  hotspot h "H"\n    area 0,0 10x10\n    look "x"\n  use lemon on h\n    "x"\n    set early\n    talk d\n' },
    { path: "dialogue/d.adv", text: 'dialogue d\n  node a narrator "A"\n    set lost\n    act 1\n    -> END\n' },
  ];
  const tipsOf = (...rungs) => rungs.map(([cond, text]) => ({ if: cond, text }));
  // `lost` is only set by the effect ending act 1, so "act 1 and lost" can never be shown.
  const dead = lintOf(files, tipsOf([[{ act: 1 }, { flag: "lost" }], "after the end"], [[{ act: 1 }], "act one"]));
  assert.equal(dead.length, 1);
  assert.match(dead[0], /after the end/);
  // `opened` is set by the opening scene of act 2, so the plain act-2 rung behind "not opened" is dead.
  const dead2 = lintOf(files, tipsOf([[{ act: 2 }, { flag: "opened" }], "opened"], [[{ act: 2 }, { flag: "opened", is: false }], "not opened"]));
  assert.equal(dead2.length, 1);
  assert.match(dead2[0], /not opened/);
  // A flag nothing ever sets is dead; one a hotspot sets is live.
  assert.equal(lintOf(files, tipsOf([[{ act: 1 }, { flag: "ghost" }], "ghost"], [[{ act: 1 }], "one"]))[0].includes("ghost"), true);
  assert.deepEqual(lintOf(files, tipsOf([[{ act: 1 }, { flag: "early" }], "early"], [[{ act: 1 }], "one"])), []);
});

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

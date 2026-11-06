// The .adv compiler: each deliberate mistake gets its own message, on the right line.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { compile, formatError } = await vite.load("/src/adv/compile.ts");

const ROOM = (extra = "") => `room dock "Dock"
  bg bg_dock
  perspective horizon 1 ref 2 height 3
  walk (0,0) (10,0) (10,10)
  entry 5,5
${extra}`;
const BASE = [
  { path: "acts.adv", text: 'act 1 "One"\n  start dock\nact 2 "Two"\n  start dock\n' },
  { path: "items.adv", text: 'item lemon "lemon"\n  look "A lemon."\nitem rope "rope"\n  look "Rope."\n' },
  { path: "rooms/tavern.adv", text: ROOM().replace("dock \"Dock\"", "tavern \"Tavern\"") },
];
const options = { music: { music_dock: 1 } };
/** Compile one extra file beside the base content; returns formatted messages. */
const files = (path, text) => [...BASE, ...(path === "rooms/dock.adv" ? [] : [{ path: "rooms/dock.adv", text: ROOM() }]), { path, text }];
function messages(path, text) {
  return compile(files(path, text), options).errors.map(formatError);
}
const errorsOnly = (path, text) => compile(files(path, text), options).errors.filter((e) => !e.warning).map(formatError);

test("the base content compiles cleanly", () => {
  assert.deepEqual(messages("rooms/dock.adv", ROOM()), []);
});

const dlg = (body) => `dialogue d\n${body}`;
const CASES = [
  // [name, file, text, expected message fragment (with location), warning?]
  ["odd indentation", "rooms/dock.adv", ROOM('   hotspot h "H"\n'), "rooms/dock.adv:6:4: indent by two spaces"],
  ["jumping two levels", "rooms/dock.adv", ROOM('  hotspot h "H"\n      area 0,0 10x10\n'), "rooms/dock.adv:7:7: indented too far"],
  ["tabs", "rooms/dock.adv", ROOM('\thotspot h "H"\n'), "indent with spaces, not tabs"],
  ["unknown arrive room", "rooms/dock.adv", ROOM("  arrive atlantis 5,5\n"), "rooms/dock.adv:6:19: no room 'atlantis' to arrive from"],
  ["unknown music", "rooms/dock.adv", ROOM("  music music_disco\n"), "no music track 'music_disco'"],
  ["unknown music effect", "rooms/dock.adv", ROOM("  on enter\n    music music_disco\n"), "rooms/dock.adv:7:5: no music track 'music_disco'"],
  ["unknown act in a condition", "rooms/dock.adv", ROOM('  hotspot h "H"\n    area 0,0 10x10\n    show if act 7\n    look "x"\n'), "rooms/dock.adv:8:5: no act 7"],
  ["show if located on its own line", "rooms/dock.adv", ROOM('  hotspot h "H"\n    area 0,0 10x10\n    look "x"\n    show if has lemmon\n'), "rooms/dock.adv:9:5: no item 'lemmon'"],
  ["effects after go", "rooms/dock.adv", ROOM('  hotspot h "H"\n    area 0,0 10x10\n    open\n      go tavern\n      set lost\n'), "rooms/dock.adv:10:7: nothing runs after 'go tavern'"],
  ["effects after talk", "rooms/dock.adv", ROOM('  on enter\n    talk d\n    say "x"\n') , "rooms/dock.adv:8:5: nothing runs after 'talk d'"],
  ["choice with talk that doesn't end", "dialogue/d.adv", dlg('  node a narrator "A"\n    > "x" -> b\n      talk d\n  node b narrator "B"\n'), "dialogue/d.adv:4:7: 'talk d' ends the conversation, so this choice must lead to END, not 'b'"],
  ["node with go and a next", "dialogue/d.adv", dlg('  node a narrator "A"\n    go tavern\n    -> b\n  node b narrator "B"\n'), "dialogue/d.adv:3:5: 'go tavern' ends the conversation, so this node can't go on to 'b'"],
  ["node with act and choices", "dialogue/d.adv", dlg('  node a narrator "A"\n    act 2\n    > "x" -> END\n'), "dialogue/d.adv:3:5: 'act 2' ends the conversation, so this node can't go on to choices"],
  ["choices and a next", "dialogue/d.adv", dlg('  node a narrator "A"\n    > "x" -> END\n    -> b\n  node b narrator "B"\n'), "dialogue/d.adv:2:3: node 'a' has both choices and '-> b'"],
  ["unknown next", "dialogue/d.adv", dlg('  node a narrator "A"\n    -> nowhere\n'), "no node 'nowhere' in d"],
  ["unknown item", "rooms/dock.adv", ROOM('  hotspot h "H"\n    area 0,0 10x10\n    look "x"\n      give lemmon\n'), "rooms/dock.adv:9:7: no item 'lemmon'"],
  ["unknown sound", "rooms/dock.adv", ROOM("  on enter\n    sound boom\n"), "no sound 'boom'"],
  ["read but never set", "rooms/dock.adv", ROOM('  hotspot h "H"\n    area 0,0 10x10\n    show if knows_key\n    look "x"\n'), "flag 'knows_key' is read but never set"],
  ["all choices conditional", "dialogue/d.adv", dlg('  node a narrator "A"\n    > "x" if has lemon -> END\n    > "y" if has rope -> END\n'), "dialogue/d.adv:2:3: warning: every choice on node 'a' has a condition", true],
  ["shadowed combo", "rooms/dock.adv", ROOM('  hotspot h "H"\n    area 0,0 10x10\n    look "x"\n  use lemon on h\n    "One."\n  use lemon on h\n    "Two."\n'), "rooms/dock.adv:11:3: warning: this combination is never used: the one at rooms/dock.adv:9", true],
  ["set but never read", "rooms/dock.adv", ROOM("  on enter\n    set orphan\n"), "warning: flag 'orphan' is set but never read", true],
];

for (const [name, path, text, expected, warning] of CASES) {
  test(`error: ${name}`, () => {
    const msgs = messages(path, text);
    assert.ok(msgs.some((m) => m.includes(expected)), `expected "${expected}" in:\n  ${msgs.join("\n  ")}`);
    if (warning) assert.deepEqual(errorsOnly(path, text), [], "a warning alone must not be an error");
  });
}

test("not warned: complementary conditions, a conditional combo before a plain one", () => {
  const msgs = messages("dialogue/d.adv", dlg('  node a narrator "A"\n    > "x" if has lemon -> END\n    > "y" if not has lemon -> END\n  node b narrator "B"\n    > "x" if has lemon and has rope -> END\n    > "y" if (not has lemon or not has rope) -> END\n'));
  assert.deepEqual(msgs, []);
  const combos = messages("rooms/dock.adv", ROOM('  hotspot h "H"\n    area 0,0 10x10\n    look "x"\n  use lemon on h if has rope\n    "One."\n  use lemon on h\n    "Two."\n'));
  assert.deepEqual(combos, []);
});

test("allowed: a terminal effect on a choice to END and on a node with no next", () => {
  const msgs = messages("dialogue/d.adv", dlg('  node a narrator "A"\n    > "x" -> END\n      set lost\n      go tavern\n    > "y" -> b\n  node b narrator "B"\n    go tavern\n  node c narrator "C"\n    act 2\n    -> END\n'));
  assert.deepEqual(msgs.filter((m) => !m.includes("never read")), []);
});

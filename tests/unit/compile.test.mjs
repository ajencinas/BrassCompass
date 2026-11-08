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

// ------------------------------------------------------------ atmosphere, door sounds, paintings

const ser = await vite.load("/src/adv/serialize.ts");
const ATMOSPHERE = ROOM(`  footsteps stone
  light 985,405 radius 110 lantern
  light 890,368 radius 60 candle colour "#ffc890" if not lost
  water (0,578) (560,578) (600,492) (0,880) ripple 2.4
  haze 120 760 floor 690 alpha 0.28 speed -9 tint "#c8b4a0"
  motes dust (990,120) (1240,0) (1760,250) count 60
  beacon 2198,158 period 14
  emit lapping at 400,700
  emit creak
  backdrop "grayscale(0.7) sepia(0.6) hue-rotate(185deg) saturate(1.6) brightness(0.36)"
  on enter
    set lost = false
    go tavern sound none
  hotspot h "H"
    area 0,0 10x10
    exit tavern sound hatch
`);

test("atmosphere: every directive compiles to the data the game reads", () => {
  const out = compile(files("rooms/dock.adv", ATMOSPHERE), options);
  assert.deepEqual(out.errors.filter((e) => !e.warning).map(formatError), []);
  const r = out.rooms.dock;
  assert.equal(r.footsteps, "stone");
  assert.deepEqual(r.lights, [
    { at: { x: 985, y: 405 }, radius: 110, kind: "lantern" },
    { at: { x: 890, y: 368 }, radius: 60, kind: "candle", colour: "#ffc890", showIf: [{ flag: "lost", is: false }] },
  ]);
  assert.deepEqual(r.water, [{ area: [{ x: 0, y: 578 }, { x: 560, y: 578 }, { x: 600, y: 492 }, { x: 0, y: 880 }], ripple: 2.4 }]);
  assert.deepEqual(r.haze, [{ top: 120, bottom: 760, floor: 690, alpha: 0.28, speed: -9, tint: "#c8b4a0" }]);
  assert.deepEqual(r.motes, [{ kind: "dust", area: [{ x: 990, y: 120 }, { x: 1240, y: 0 }, { x: 1760, y: 250 }], count: 60 }]);
  assert.deepEqual(r.beacon, { at: { x: 2198, y: 158 }, period: 14 });
  assert.deepEqual(r.emitters, [{ kind: "lapping", at: { x: 400, y: 700 } }, { kind: "creak" }]);
  assert.deepEqual(r.onEnter.at(-1), { k: "go", room: "tavern", sound: "none" });
  for (const verb of ["open", "use", "walk"]) assert.deepEqual(r.hotspots[0].do[verb], [{ k: "go", room: "tavern", sound: "hatch" }]);
  // Points and polygons carry their column spans, so the editor can drag them.
  const loc = out.locs.get(r.lights[0].at);
  assert.deepEqual([loc.line, loc.col, loc.end], [7, 9, 16]);
  assert.ok(out.locs.get(r.water[0].area) && out.locs.get(r.motes[0].area) && out.locs.get(r.beacon.at) && out.locs.get(r.emitters[0].at));
});

test("atmosphere: serialize writes it back exactly (exit and go keep their sounds)", () => {
  const out = compile(files("rooms/dock.adv", ATMOSPHERE), options);
  const text = ser.room(out.rooms.dock);
  assert.match(text, /^ {4}exit tavern sound hatch$/m);
  assert.match(text, /^ {4}go tavern sound none$/m);
  const again = compile(files("rooms/dock.adv", text), options);
  assert.deepEqual(again.errors.filter((e) => !e.warning).map(formatError), []);
  assert.deepEqual(again.rooms.dock, out.rooms.dock);
  // An empty backdrop is still a backdrop: it must survive the trip.
  const blank = compile(files("rooms/dock.adv", ROOM('  backdrop ""\n')), options).rooms.dock;
  assert.equal(blank.backdrop, "");
  assert.equal(compile(files("rooms/dock.adv", ser.room(blank)), options).rooms.dock.backdrop, "");
});

test("a painting for the ending: image, focus, music and condition", () => {
  const acts = 'act 1 "One"\n  start dock\nact 2 "Two"\n  start dock\nending "THE END"\n' +
    '  painting bg_dock focus 1250,300 music music_dock if not lost\n  painting bg_dock\n  line\n    "Fin."\n';
  const out = compile([...BASE.filter((f) => f.path !== "acts.adv"), { path: "acts.adv", text: acts },
    { path: "rooms/dock.adv", text: ROOM("  on enter\n    set lost\n") }], { ...options, images: { bg_dock: 1 } });
  assert.deepEqual(out.errors.filter((e) => !e.warning).map(formatError), []);
  assert.deepEqual(out.ending.paintings, [
    { image: "bg_dock", focus: { x: 1250, y: 300 }, music: "music_dock", if: [{ flag: "lost", is: false }] },
    { image: "bg_dock" },
  ]);
  const again = compile([...BASE.filter((f) => f.path !== "acts.adv"), { path: "acts.adv", text: ser.acts(Object.values(out.acts), out.ending) },
    { path: "rooms/dock.adv", text: ROOM("  on enter\n    set lost\n") }], { ...options, images: { bg_dock: 1 } });
  assert.deepEqual(again.ending, out.ending);
});

const ATMOSPHERE_ERRORS = [
  ["unknown light kind", "  light 10,10 radius 50 torch\n", "rooms/dock.adv:6:25: no light kind 'torch' (lantern, candle, lamp, fire, moon)"],
  ["radius must be positive", "  light 10,10 radius 0 lantern\n", "rooms/dock.adv:6:22: the radius must be more than 0"],
  ["colour spelling", '  light 10,10 radius 5 lamp color "#fff"\n', "rooms/dock.adv:6:29: spell it 'colour'"],
  ["bad colour", '  light 10,10 radius 5 lamp colour "orange"\n', 'rooms/dock.adv:6:36: a colour is written "#rgb" or "#rrggbb", not "orange"'],
  ["light option", "  light 10,10 radius 5 lamp bright\n", "rooms/dock.adv:6:29: 'bright' isn't a light option (colour, if)"],
  ["unknown flag in a light's condition", "  light 10,10 radius 5 lamp if lamps_lit\n", "flag 'lamps_lit' is read but never set"],
  ["ripple out of range", "  water (0,0) (10,0) (10,10) ripple 0\n", "rooms/dock.adv:6:37: the ripple must be more than 0 and at most 8"],
  ["water needs a polygon", "  water ripple 2\n", "rooms/dock.adv:6:9: a polygon needs at least three points"],
  ["haze upside down", "  haze 500 400 floor 600 alpha 0.1 speed 5\n", "rooms/dock.adv:6:12: the haze's bottom must be below its top"],
  ["haze alpha", "  haze 100 400 floor 600 alpha 1.5 speed 5\n", "rooms/dock.adv:6:32: alpha must be more than 0 and at most 1"],
  ["haze needs its words", "  haze 100 400 600 alpha 0.1 speed 5\n", "rooms/dock.adv:6:16: expected 'floor'"],
  ["unknown mote kind", "  motes snow (0,0) (10,0) (10,10) count 5\n", "rooms/dock.adv:6:9: no mote kind 'snow' (dust, embers, steam, glints)"],
  ["mote count", "  motes dust (0,0) (10,0) (10,10) count 2.5\n", "rooms/dock.adv:6:41: the count must be a whole number from 1 to 300"],
  ["one beacon", "  beacon 1,1 period 5\n  beacon 2,2 period 5\n", "rooms/dock.adv:7:3: a room has one beacon"],
  ["beacon period", "  beacon 1,1 period 0\n", "rooms/dock.adv:6:21: the period must be more than 0"],
  ["unknown footsteps", "  footsteps mud\n", "rooms/dock.adv:6:13: no footsteps 'mud' (wood, deck, stone, sand, earth)"],
  ["unknown emitter", "  emit gulls\n", "rooms/dock.adv:6:8: no sound to emit 'gulls' (crackle, lapping, drip, creak)"],
  ["unknown door sound", '  hotspot h "H"\n    area 0,0 10x10\n    exit tavern sound creak\n', "rooms/dock.adv:8:23: no door sound 'creak' (door, hatch, stairs, none)"],
  ["door sound on go", "  on enter\n    go tavern sound slam\n", "rooms/dock.adv:7:21: no door sound 'slam' (door, hatch, stairs, none)"],
  ["filter without a unit", '  backdrop "hue-rotate(195)"\n', "rooms/dock.adv:6:12: hue-rotate needs a unit: hue-rotate(195deg)"],
  ["misspelt filter", '  grade "brigthness(0.9)"\n', "rooms/dock.adv:6:9: 'brigthness' isn't a colour filter"],
  ["negative filter", '  grade "brightness(-1)"\n', "rooms/dock.adv:6:9: brightness can't be negative"],
  ["blur isn't a grade", '  sprite s at 1,1 size 1 grade "blur(2px)"\n', "rooms/dock.adv:6:32: 'blur' isn't a colour filter"],
  ["filter junk", '  backdrop "brightness(0.5), saturate(1)"\n', "rooms/dock.adv:6:12: can't read the filter from ', saturate(1)'"],
];
for (const [name, extra, expected] of ATMOSPHERE_ERRORS) {
  test(`error: ${name}`, () => {
    const msgs = messages("rooms/dock.adv", ROOM(extra));
    assert.ok(msgs.some((m) => m.includes(expected)), `expected "${expected}" in:\n  ${msgs.join("\n  ")}`);
  });
}

test("error: a painting of an image or music that doesn't exist", () => {
  const acts = 'act 1 "One"\n  start dock\nending "THE END"\n  painting bg_nowhere music music_disco\n  painting bg_dock focus 1,2 dim\n';
  const msgs = compile([...BASE.filter((f) => f.path !== "acts.adv"), { path: "acts.adv", text: acts }, { path: "rooms/dock.adv", text: ROOM() }],
    { ...options, images: { bg_dock: 1 } }).errors.map(formatError);
  for (const expected of ["acts.adv:4:3: no image 'bg_nowhere'", "acts.adv:4:3: no music track 'music_disco'", "acts.adv:5:30: 'dim' isn't a painting option (focus, music, if)"]) {
    assert.ok(msgs.some((m) => m.includes(expected)), `expected "${expected}" in:\n  ${msgs.join("\n  ")}`);
  }
});

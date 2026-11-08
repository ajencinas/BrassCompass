// What each act can reach, statically: rooms, conversations, items and the flags it can set. An
// old save restarted at its act drops the flags that act sets itself (save.ts flagsForRestart).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { actReach } = await vite.load("/src/game/reach.ts");
const { migrateOldSave } = await vite.load("/src/game/save.ts");

const hs = (id, extra = {}) => ({ id, name: id, area: { rect: { x: 0, y: 0, w: 1, h: 1 } }, say: {}, ...extra });
const room = (id, extra = {}) => ({ id, name: id, bg: "bg", walk: [], entry: { x: 0, y: 0 }, perspective: { horizon: 0, refY: 1, refH: 1 }, hotspots: [], ...extra });
const node = (id, extra = {}) => ({ id, speaker: "narrator", text: id, ...extra });

const content = {
  acts: {
    1: { n: 1, title: "One", start: { room: "dock" }, inventory: ["compass"] },
    2: { n: 2, title: "Two", start: { room: "deck" }, onStart: [{ k: "talk", tree: "captain" }] },
  },
  rooms: {
    dock: room("dock", {
      hotspots: [
        hs("crate", { item: "crowbar", do: { open: [{ k: "flag", id: "crate_open", v: true }] } }),
        hs("door", { do: { walk: [{ k: "go", room: "tavern" }] } }),
        hs("ship", { showIf: [{ act: 2 }], do: { walk: [{ k: "go", room: "deck" }] } }),
      ],
    }),
    tavern: room("tavern", {
      onEnter: [{ k: "add", id: "visits", n: 1 }],
      scenes: [{ if: [{ act: 2 }], do: [{ k: "flag", id: "act2_scene", v: true }] }],
      hotspots: [hs("marta", {
        do: { talk: [{ k: "talk", tree: "marta" }] },
        states: [{ if: [{ act: 2 }], do: { talk: [{ k: "give", item: "rum" }] } }],
      })],
      combos: [{ item: "compass", with: "marta", say: "x", do: [{ k: "flag", id: "showed_compass", v: true }] }],
    }),
    deck: room("deck", { hotspots: [hs("chest", { do: { open: [{ k: "give", item: "sextant" }, { k: "flag", id: "chest_open", v: true }] } })] }),
  },
  dialogues: {
    marta: { id: "marta", start: "hello", nodes: {
      hello: node("hello", { choices: [{ text: "a", to: "END", do: [{ k: "flag", id: "met_marta", v: true }] },
        { text: "b", to: "END", if: [{ act: 2 }], do: [{ k: "flag", id: "marta_act2", v: true }] }] }),
      bye: node("bye", { do: [{ k: "note", id: "n", text: "t" }] }),
    } },
    captain: { id: "captain", start: "hi", nodes: { hi: node("hi", { do: [{ k: "flag", id: "met_captain", v: true }] }) } },
  },
  combos: [{ item: "compass", with: "rum", say: "x", if: [{ act: 2 }], do: [{ k: "flag", id: "global_act2", v: true }] }],
};

test("rooms, conversations and items follow doors, scenes and talk, honouring act conditions", () => {
  const r = actReach(content);
  assert.deepEqual([...r.get(1).rooms].sort(), ["dock", "tavern"]);
  assert.deepEqual([...r.get(2).rooms].sort(), ["deck"], "act 2 starts on deck; the dock's ship is act 2 but nothing leads back");
  assert.deepEqual([...r.get(1).trees], ["marta"]);
  assert.deepEqual([...r.get(2).trees], ["captain"], "an act's start effects count");
  assert.deepEqual([...r.get(1).items].sort(), ["compass", "crowbar"]);
  assert.deepEqual([...r.get(2).items].sort(), ["sextant"]);
});

test("flags: set and add effects, every node's seen: flag, every shown thing's looked: flag", () => {
  const one = actReach(content).get(1).flags;
  for (const f of ["crate_open", "visits", "showed_compass", "met_marta", "seen:marta.hello", "seen:marta.bye", "looked:dock.crate", "looked:tavern.marta"]) {
    assert.equal(one.has(f), true, f);
  }
  // Act 2 only: the ship hotspot, the tavern's act 2 scene, the act 2 choice and global combo.
  for (const f of ["looked:dock.ship", "act2_scene", "marta_act2", "global_act2", "chest_open"]) assert.equal(one.has(f), false, f);
  // Global combinations work in any room the act reaches.
  assert.deepEqual([...actReach(content).get(2).flags].sort(), ["chest_open", "global_act2", "looked:deck.chest", "met_captain", "seen:captain.hi"]);
});

test("the real content: an old Act II save restarts without what Act II set, and keeps Act I progress", async () => {
  const { ROOMS } = await vite.load("/src/content/rooms.ts");
  const { DIALOGUES } = await vite.load("/src/content/dialogue.ts");
  const { ACTS } = await vite.load("/src/content/acts.ts");
  const { GLOBAL_COMBOS } = await vite.load("/src/content/combos.ts");
  const reach = actReach({ rooms: ROOMS, dialogues: DIALOGUES, acts: ACTS, combos: GLOBAL_COMBOS });
  assert.deepEqual([...reach.keys()].sort(), Object.keys(ACTS).map(Number).sort());
  for (const [n, r] of reach) assert.equal(r.rooms.has(ACTS[n].start.room), true, `act ${n} reaches its start room`);

  // The flags each act's own content can set, so a restarted act does not think its one-shot
  // sources are spent. fog_tried is Act II's; vex_deal is Act I's and must survive.
  assert.equal(reach.get(2).flags.has("fog_tried"), true, "Act II sets fog_tried");
  // A flag only Act I's content can set: it must survive a restart of Act II.
  const actOneOnly = [...reach.get(1).flags].find((f) => !f.includes(":") && !reach.get(2).flags.has(f));
  assert.ok(actOneOnly, "some flag only Act I sets");
  const known = { act: (n) => n in ACTS, firstAct: 1, actFlags: (n) => reach.get(n)?.flags };
  const old = migrateOldSave(JSON.stringify({
    room: "marrow_deck", act: 2,
    flags: { fog_tried: true, [actOneOnly]: true, "seen:vex.root": true }, inventory: ["compass"],
  }), known);
  assert.equal(old.act, 2);
  assert.equal("fog_tried" in old.flags, false, "Act II's own flag is dropped");
  assert.equal(old.flags[actOneOnly], true, "Act I progress is kept");
  assert.equal(old.flags["seen:vex.root"], true, "act-2 node reads are kept when the act keeps its content");
});

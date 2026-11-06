// Save validation: whatever is in storage, the game gets a usable save or a clean "corrupt".
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const save = await vite.load("/src/game/save.ts");
const { normalizeSave, readSave, writeSave, migrateOldSave, hasAnySave, takeOldSave, SAVE_KEY, SAVE_VERSION } = save;

const known = {
  room: (id) => id === "dock" || id === "tavern",
  item: (id) => ["compass", "lemon", "crowbar"].includes(id),
  act: (n) => [1, 2, 3, 4].includes(n),
  firstAct: 1,
};
const good = () => ({
  version: SAVE_VERSION, room: "dock", x: 100, y: 600, facing: -1, flags: { met_marta: true },
  inventory: ["compass", "lemon"], act: 2, notes: [{ id: "n1", text: "A note.", act: 1 }], actStarted: true,
});

/** A Map-backed localStorage, optionally refusing everything. */
function storage({ broken = false } = {}) {
  const m = new Map();
  const guard = () => { if (broken) throw new Error("SecurityError"); };
  return {
    getItem: (k) => (guard(), m.has(k) ? m.get(k) : null),
    setItem: (k, v) => (guard(), void m.set(k, String(v))),
    removeItem: (k) => (guard(), void m.delete(k)),
    map: m,
  };
}
beforeEach(() => { globalThis.localStorage = storage(); });

test("a good save comes back as written", () => {
  assert.deepEqual(normalizeSave(good(), known), good());
});

test("garbage is rejected, not half-loaded", () => {
  for (const g of [null, 42, "save", [], {}, { room: "dock" }, { ...good(), room: "atlantis" },
    { ...good(), flags: [] }, { ...good(), flags: null }, { ...good(), inventory: "compass" }]) {
    assert.equal(normalizeSave(g, known), null, JSON.stringify(g));
  }
});

test("unknown and malformed items are dropped, duplicates collapse", () => {
  const d = normalizeSave({ ...good(), inventory: ["compass", "lemmon", 7, null, "compass", "crowbar"] }, known);
  assert.deepEqual(d.inventory, ["compass", "crowbar"]);
});

test("an unusable position falls back to the room's entry; facing and act are sanitised", () => {
  const d = normalizeSave({ ...good(), x: NaN, y: "600", facing: 3, act: 9 }, known);
  assert.equal(d.x, undefined);
  assert.equal(d.y, undefined);
  assert.equal(d.facing, 1);
  assert.equal(d.act, 1);
  // JSON turns NaN into null.
  assert.equal(normalizeSave(JSON.parse(JSON.stringify({ ...good(), x: NaN })), known).x, undefined);
});

test("notes: malformed ones dropped, a missing act takes the save's", () => {
  const d = normalizeSave({ ...good(), notes: [{ id: "a", text: "t" }, { id: 3, text: "x" }, "n", { id: "a", text: "dup", act: 1 }, { id: "b", text: "u", act: 1 }] }, known);
  assert.deepEqual(d.notes, [{ id: "a", text: "t", act: 2 }, { id: "b", text: "u", act: 1 }]);
  assert.deepEqual(normalizeSave({ ...good(), notes: "nope" }, known).notes, []);
});

test("older v3 saves without version, notes or actStarted still load", () => {
  const { version, notes, actStarted, ...old } = good();
  const d = normalizeSave(old, known);
  assert.equal(d.version, SAVE_VERSION);
  assert.deepEqual(d.notes, []);
  assert.equal(d.actStarted, true);
  assert.equal(normalizeSave({ ...old, actStarted: false }, known).actStarted, false);
});

test("the effect queue survives, minus anything malformed", () => {
  const queue = [{ k: "say", text: "Hello." }, { k: "give" }, { k: "sound", id: "boom" }, { k: "talk", tree: "quill4" }, { k: "nope" }, { k: "act", n: 3 }];
  const d = normalizeSave({ ...good(), queue }, known);
  assert.deepEqual(d.queue, [{ k: "say", text: "Hello." }, { k: "talk", tree: "quill4" }, { k: "act", n: 3 }]);
  assert.equal("queue" in normalizeSave({ ...good(), queue: "x" }, known), false);
});

test("readSave: missing, unparsable, invalid and good", () => {
  assert.deepEqual(readSave(known), { data: null, raw: null, corrupt: false });
  localStorage.setItem(SAVE_KEY, "{not json");
  assert.deepEqual(readSave(known), { data: null, raw: "{not json", corrupt: true });
  localStorage.setItem(SAVE_KEY, JSON.stringify({ room: "atlantis" }));
  assert.equal(readSave(known).corrupt, true);
  assert.equal(writeSave(good()), true);
  assert.deepEqual(readSave(known).data, good());
});

test("throwing storage never throws out of the save functions", () => {
  globalThis.localStorage = storage({ broken: true });
  assert.deepEqual(readSave(known), { data: null, raw: null, corrupt: false });
  assert.equal(writeSave(good()), false);
  assert.equal(hasAnySave(), false);
  assert.equal(takeOldSave(), null);
  delete globalThis.localStorage;
  assert.deepEqual(readSave(known), { data: null, raw: null, corrupt: false });
  assert.equal(writeSave(good()), false);
});

test("v2 migration keeps the act and flags, or nothing", () => {
  assert.deepEqual(migrateOldSave(JSON.stringify({ act: 3, flags: { a: 1 }, room: "gone" }), known), { act: 3, flags: { a: 1 } });
  assert.deepEqual(migrateOldSave(JSON.stringify({ act: 2, flags: "bad" }), known), { act: 2, flags: {} });
  assert.equal(migrateOldSave(JSON.stringify({ act: 1, flags: {} }), known), null, "act I just restarts");
  assert.equal(migrateOldSave(JSON.stringify({ act: 99 }), known), null);
  assert.equal(migrateOldSave("{oops", known), null);
  assert.equal(migrateOldSave("null", known), null);
  localStorage.setItem("brasscompass.save.v2", "{}");
  assert.equal(hasAnySave(), true);
  assert.equal(takeOldSave(), "{}");
  assert.equal(hasAnySave(), false);
});

// Save validation: whatever is in storage, the game gets a usable save or a clean "corrupt".
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const save = await vite.load("/src/game/save.ts");
const {
  normalizeSave, readSave, writeSave, migrateOldSave, flagsForRestart, hasAnySave, takeOldSave,
  archiveSave, archivedSaves, stashCurrentSave, hasStashedSave, restoreStashedSave,
  withoutEndingFlags, ENDING_FLAGS,
  SAVE_KEY, SAVE_VERSION, ARCHIVE_KEY, PREVIOUS_KEY,
} = save;

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

test("the recap's hint and timestamp are kept; a save without them loads without them", () => {
  const at = 1_700_000_000_000;
  const d = normalizeSave({ ...good(), tip: "Ask Marta about the drawer key.", at }, known);
  assert.equal(d.tip, "Ask Marta about the drawer key.");
  assert.equal(d.at, at);
  // The fields are additive: a save from before them is not corrupt, and gains nothing.
  const old = normalizeSave(good(), known);
  assert.equal("tip" in old, false);
  assert.equal("at" in old, false);
  // Damaged ones are dropped rather than shown on the card.
  const broken = normalizeSave({ ...good(), tip: 7, at: "yesterday" }, known);
  assert.equal("tip" in broken, false);
  assert.equal("at" in broken, false);
  assert.equal("at" in normalizeSave({ ...good(), at: NaN }, known), false);
  assert.equal("tip" in normalizeSave({ ...good(), tip: "   " }, known), false);
  // And both survive a trip through storage.
  assert.equal(writeSave({ ...good(), tip: "A hint.", at }), true);
  assert.deepEqual(readSave(known).data, { ...good(), tip: "A hint.", at });
});

test("the effect queue survives, minus anything malformed", () => {
  const queue = [{ k: "say", text: "Hello." }, { k: "give" }, { k: "sound", id: "boom" }, { k: "talk", tree: "quill4" }, { k: "nope" }, { k: "act", n: 2 }];
  const d = normalizeSave({ ...good(), queue }, known);
  assert.deepEqual(d.queue, [{ k: "say", text: "Hello." }, { k: "talk", tree: "quill4" }, { k: "act", n: 2 }]);
  assert.equal("queue" in normalizeSave({ ...good(), queue: "x" }, known), false);
});

test("a saved queue can only end the act the save is in, and only the last act's can win", () => {
  const say = { k: "say", text: "The end?" };
  const queue = (act, ...rest) => normalizeSave({ ...good(), act, queue: [say, ...rest] }, known).queue;
  // A damaged save's `act 9` (no such act), or another act's ending, would roll the credits or skip
  // acts from the middle of this one.
  assert.deepEqual(queue(1, { k: "act", n: 9 }), [say]);
  assert.deepEqual(queue(1, { k: "act", n: 2 }), [say]);
  assert.deepEqual(queue(3, { k: "act", n: 3 }), [say, { k: "act", n: 3 }]);
  // A saved ending is never run on Continue: the final choice must be made again, this time
  // with no ending flag left over from the first attempt.
  assert.deepEqual(queue(1, { k: "win" }), [say]);
  assert.deepEqual(queue(3, { k: "win" }), [say]);
  assert.deepEqual(queue(4, { k: "win" }), [say]);
  // A save whose own act is unknown starts the first act; its queued ending goes with it.
  assert.deepEqual(normalizeSave({ ...good(), act: 9, queue: [say, { k: "act", n: 9 }] }, known).queue, [say]);
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

test("an old save restarting its act drops the flags that act (or a later one) sets, keeps earlier acts'", () => {
  // Act 2 opens the chest and hears the cook; act 1 met Marta and raised `aff`, which act 2 raises
  // too; act 3 alone sets `hatch_open`.
  const sets = { 1: ["met_marta", "aff", "seen:marta.hello"], 2: ["chest_open", "dinner", "aff", "seen:hobb.mess", "looked:deck.chest"], 3: ["hatch_open"] };
  const actFlags = (n) => (sets[n] ? new Set(sets[n]) : undefined);
  const k = { act: (n) => n in sets, firstAct: 1, actFlags };
  const flags = {
    met_marta: true, aff: 5, "seen:marta.hello": true, chest_open: true, dinner: true, "seen:hobb.mess": true,
    "looked:deck.chest": true, hatch_open: true, old_story_flag: "kept",
  };
  assert.deepEqual(flagsForRestart(flags, 2, k), { met_marta: true, aff: 5, "seen:marta.hello": true, old_story_flag: "kept" });
  assert.deepEqual(migrateOldSave(JSON.stringify({ act: 2, flags }), k), {
    act: 2, flags: { met_marta: true, aff: 5, "seen:marta.hello": true, old_story_flag: "kept" },
  });
  // Restarting act 3 keeps act 2's progress; only act 3's own flag goes.
  assert.equal("hatch_open" in flagsForRestart(flags, 3, k), false);
  assert.equal(flagsForRestart(flags, 3, k).chest_open, true);
  // Without the content's flag sets, nothing is dropped (the old behaviour).
  assert.deepEqual(migrateOldSave(JSON.stringify({ act: 2, flags }), { act: k.act, firstAct: 1 }).flags, flags);
});

test("renamed items: lemon and jet-caps saves come back holding rum; a known id is left alone", () => {
  const now = { ...known, item: (id) => ["compass", "crowbar", "rum"].includes(id) };
  for (const old of ["lemon", "mushroom"]) {
    const d = normalizeSave({ ...good(), inventory: ["compass", "crowbar", old] }, now);
    assert.deepEqual(d.inventory, ["compass", "crowbar", "rum"], old);
  }
  // A content where the old id still exists keeps it as it is.
  assert.deepEqual(normalizeSave(good(), known).inventory, ["compass", "lemon"]);
  // Both an old and a new id collapse to one.
  assert.deepEqual(normalizeSave({ ...good(), inventory: ["rum", "mushroom"] }, now).inventory, ["rum"]);
});

test("a saved queue is brought up to date: renamed items and nodes mapped, vanished ones dropped", () => {
  const trees = { tavernkeeper: ["root", "norum", "norum2"], quill: ["root"] };
  const now = {
    ...known,
    item: (id) => ["compass", "rum"].includes(id),
    talk: (tree, node) => tree in trees && (node === undefined || trees[tree].includes(node)),
  };
  const d = normalizeSave({
    ...good(),
    queue: [
      { k: "say", text: "Under the crate…" },
      { k: "give", item: "mushroom" },
      { k: "take", item: "lemon" },
      { k: "give", item: "teapot" },
      { k: "talk", tree: "tavernkeeper", node: "nofungus" },
      { k: "talk", tree: "quill", node: "gone" },
      { k: "talk", tree: "nobody" },
      { k: "go", room: "atlantis" },
      { k: "go", room: "tavern" },
    ],
  }, now);
  assert.deepEqual(d.queue, [
    { k: "say", text: "Under the crate…" },
    { k: "give", item: "rum" },
    { k: "take", item: "rum" },
    { k: "talk", tree: "tavernkeeper", node: "norum" },
    { k: "talk", tree: "quill" },
    { k: "go", room: "tavern" },
  ]);
});

test("a save is before the final choice: ending flags never survive a read or a migration", () => {
  // Both choices had leaked into old saves; whichever the player picks next must not show the
  // other ending's lines too. The branch markers go with them, or the tip ladder still thinks
  // the last choice has been made.
  const leaked = {
    ...good(),
    flags: {
      met_marta: true, ending_fog_lifts: true, ending_long_way: true,
      curse_broken: true, escaped_fog: true, "seen:deck": true,
    },
  };
  assert.deepEqual(normalizeSave(leaked, known).flags, { met_marta: true, "seen:deck": true });
  // The old story's names are stripped too, and the current names after a rename map.
  assert.deepEqual(normalizeSave({ ...good(), flags: { ending_pirate: true, met_marta: true } }, known).flags,
    { met_marta: true });
  // An old-shape save is migrated first, then cleared.
  assert.deepEqual(normalizeSave({ ...leaked, version: 3 }, known).flags, { met_marta: true, "seen:deck": true });
  // The helper is pure and keeps every ordinary flag.
  const flags = { aff: 14, "looked:dock.crate": true, ending_long_way: true, curse_broken: true };
  assert.deepEqual(withoutEndingFlags(flags), { aff: 14, "looked:dock.crate": true });
  assert.deepEqual(withoutEndingFlags(flags, ENDING_FLAGS), { aff: 14, "looked:dock.crate": true, curse_broken: true });
  assert.equal(flags.ending_long_way, true, "the live flags are not mutated");
});

test("schema versions: older shapes migrate, newer shapes are never coerced", () => {
  // A v3 save is upgraded to the current shape but keeps everything else.
  const old = { ...good(), version: 3, flags: { met_marta: true, ending_fog_lifts: true } };
  const d = normalizeSave(old, known);
  assert.equal(d.version, SAVE_VERSION);
  assert.deepEqual(d.flags, { met_marta: true });
  // A shape this build does not know is not a corrupt file and must not be loaded as one.
  assert.equal(normalizeSave({ ...good(), version: SAVE_VERSION + 1 }, known), null);
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...old, version: 3, unknownField: { keep: true } }));
  const r = readSave(known);
  assert.equal(r.migratedFrom, 3);
  assert.equal(r.data.version, SAVE_VERSION);
  assert.equal(r.future, undefined);
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...good(), version: SAVE_VERSION + 1 }));
  const future = readSave(known);
  assert.equal(future.data, null);
  assert.equal(future.corrupt, false);
  assert.equal(future.future, true);
  assert.equal(future.futureVersion, SAVE_VERSION + 1);
  assert.notEqual(future.raw, null);
});

test("archived pages are kept whole (not duplicated) and capped", () => {
  const raw = JSON.stringify({ ...good(), version: 3, unknownField: "keep me" });
  assert.equal(archiveSave(raw, "migrated", SAVE_KEY, 3), true);
  assert.equal(archiveSave(raw, "migrated", SAVE_KEY, 3), true, "re-reading does not duplicate it");
  let pages = archivedSaves();
  assert.equal(pages.length, 1);
  assert.equal(pages[0].reason, "migrated");
  assert.equal(pages[0].key, SAVE_KEY);
  assert.equal(pages[0].version, 3);
  assert.equal(pages[0].raw, raw, "the whole page, unknown data included");
  for (let i = 0; i < 8; i++) archiveSave(`raw-${i}`, "old-key", "brasscompass.save.v2", 2);
  pages = archivedSaves();
  assert.equal(pages.length, save.MAX_ARCHIVED);
  assert.equal(pages.at(-1).raw, "raw-7");
  assert.equal(localStorage.getItem(ARCHIVE_KEY) !== null, true);
});

test("pre-v4 keys are archived before they leave storage", () => {
  localStorage.setItem("brasscompass.save.v3", '{"act":2,"flags":{"quill_helped":true}}');
  assert.equal(hasAnySave(), true);
  assert.match(takeOldSave(), /quill_helped/);
  assert.equal(localStorage.getItem("brasscompass.save.v3"), null);
  assert.equal(hasAnySave(), false);
  const [page] = archivedSaves();
  assert.equal(page.reason, "old-key");
  assert.equal(page.key, "brasscompass.save.v3");
  assert.equal(page.version, 1);
  assert.match(page.raw, /quill_helped/);
});

test("a replaced voyage is stashed and can be taken up once", () => {
  assert.equal(stashCurrentSave(), false, "nothing to stash");
  assert.equal(hasStashedSave(), false);
  assert.equal(writeSave(good()), true);
  assert.equal(stashCurrentSave(), true);
  assert.equal(hasStashedSave(), true);
  assert.equal(localStorage.getItem(PREVIOUS_KEY), localStorage.getItem(SAVE_KEY));
  // A new voyage overwrites the live key, but not the stash.
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...good(), act: 1, room: "tavern" }));
  assert.deepEqual(readSave(known).data, { ...good(), act: 1, room: "tavern" });
  assert.equal(restoreStashedSave(), true);
  assert.equal(hasStashedSave(), false);
  assert.deepEqual(readSave(known).data, good(), "the whole old voyage came back");
  assert.equal(restoreStashedSave(), false, "one undo, not a stack");
});

test("stashing a second voyage archives the older undo page instead of dropping it", () => {
  assert.equal(writeSave(good()), true);
  const first = localStorage.getItem(SAVE_KEY);
  assert.equal(stashCurrentSave(), true);
  assert.equal(localStorage.getItem(PREVIOUS_KEY), first);
  assert.equal(writeSave({ ...good(), act: 1, room: "tavern" }), true);
  const second = localStorage.getItem(SAVE_KEY);
  assert.equal(stashCurrentSave(), true);
  assert.equal(localStorage.getItem(PREVIOUS_KEY), second);
  const archived = archivedSaves();
  assert.equal(archived.some((page) => page.raw === first && page.key === PREVIOUS_KEY), true,
    "the older undo page is still recoverable from the archive");
});

test("room and flag rename maps are applied before validation", () => {
  const custom = {
    ...known,
    renamedRooms: { old_harbour: "dock" },
    renamedFlags: { old_met: "met_marta" },
    endingFlags: new Set(["ending_fog_lifts"]),
  };
  const d = normalizeSave({
    ...good(), room: "old_harbour",
    flags: { old_met: true, ending_fog_lifts: true, kept: 1 },
  }, custom);
  assert.equal(d.room, "dock");
  assert.deepEqual(d.flags, { met_marta: true, kept: 1 });
  // An unknown room is still rejected: a rename map is not a licence to load anything.
  assert.equal(normalizeSave({ ...good(), room: "atlantis" }, custom), null);
  // Without the map the old room is unknown, so a save naming it is refused rather than wiped.
  assert.equal(normalizeSave({ ...good(), room: "old_harbour" }, known), null);
});

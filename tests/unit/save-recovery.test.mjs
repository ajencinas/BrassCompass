// Save persistence: golden saves through the real content, act/room repair, the archive and the
// recovery path, the stale-tab guard, and the guards that keep isEffect and the keys in step.
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const save = await vite.load("/src/game/save.ts");
const { SaveTabGuard } = await vite.load("/src/game/tabguard.ts");
const { actReach } = await vite.load("/src/game/reach.ts");
const { ROOMS } = await vite.load("/src/content/rooms.ts");
const { DIALOGUES } = await vite.load("/src/content/dialogue.ts");
const { ITEMS } = await vite.load("/src/content/items.ts");
const { ACTS, FIRST_ACT } = await vite.load("/src/content/acts.ts");
const { GLOBAL_COMBOS } = await vite.load("/src/content/combos.ts");
const {
  normalizeSave, readSave, writeSave, isEffect, backupCorrupt, archiveSave, archivedSaves, recoverablePages,
  restoreArchivedSave, restoreStashedSave, stashCurrentSave, hasAnySave, unreadableSave, savedQueue,
  storedSaveAt, actKnowledge, SAVE_KEY, SAVE_VERSION, OLD_SAVE_KEYS, ARCHIVE_KEY, PREVIOUS_KEY, MAX_ARCHIVED,
} = save;

/** The game's own notion of what a save may name, built from the real content. */
const known = {
  room: (id) => id in ROOMS,
  item: (id) => id in ITEMS,
  act: (n) => n in ACTS,
  firstAct: FIRST_ACT,
  talk: (tree, node) => tree in DIALOGUES && (node === undefined || node in DIALOGUES[tree].nodes),
  endingFlags: save.ENDING_RESET_FLAGS,
  ...actKnowledge(actReach({ rooms: ROOMS, dialogues: DIALOGUES, acts: ACTS, combos: GLOBAL_COMBOS }), ACTS),
};

function storage({ failSet = false } = {}) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (failSet) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => void m.delete(k),
    map: m,
  };
}
beforeEach(() => { globalThis.localStorage = storage(); });

const dir = fileURLToPath(new URL("../fixtures/saves/", import.meta.url));
const fixtures = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

test("golden saves: one per act boundary and mid-act, loaded through the real content, lose nothing", () => {
  assert.ok(fixtures.length >= 6);
  const acts = new Set();
  for (const name of fixtures) {
    const fixture = JSON.parse(readFileSync(dir + name, "utf8"));
    assert.equal(fixture.version, SAVE_VERSION, `${name}: regenerate fixtures when the shape changes`);
    localStorage.setItem(SAVE_KEY, JSON.stringify(fixture));
    const r = readSave(known);
    assert.equal(r.corrupt, false, name);
    assert.equal(r.repaired, undefined, `${name}: nothing to repair`);
    assert.deepEqual(r.data, fixture, `${name}: loads exactly as written (flags, inventory, notes, queue, position)`);
    acts.add(fixture.act);
  }
  assert.deepEqual([...acts].sort(), Object.keys(ACTS).map(Number).sort(), "every act has a golden save");
  assert.ok(fixtures.some((n) => n.includes("boundary")) && fixtures.some((n) => n.includes("mid")));
});

test("golden saves survive being written by the game and read back", () => {
  for (const name of fixtures) {
    const fixture = JSON.parse(readFileSync(dir + name, "utf8"));
    assert.equal(writeSave(fixture), true);
    assert.deepEqual(readSave(known).data, fixture, name);
  }
});

test("an older golden save (no version, notes or actStarted) keeps its progress in the real content", () => {
  const { version, notes, actStarted, at, ...old } = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  const d = normalizeSave(old, known);
  assert.equal(d.version, SAVE_VERSION);
  assert.equal(d.room, "below_decks");
  assert.deepEqual(d.flags, old.flags);
  assert.deepEqual(d.inventory, old.inventory);
});

test("every room of the real content belongs to exactly one act, so a saved room names its act", () => {
  for (const id of Object.keys(ROOMS)) assert.ok(known.actOfRoom(id) !== undefined, id);
});

test("an unknown room maps through LEGACY_ROOMS, else falls to the act's start with everything else kept", () => {
  const base = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  let repairs = [];
  const gone = normalizeSave({ ...base, room: "removed_room", x: 1, y: 2 }, known, repairs);
  assert.equal(gone.room, "marrow_deck");
  assert.equal(gone.act, 2);
  assert.deepEqual(gone.flags, base.flags);
  assert.deepEqual(gone.inventory, base.inventory);
  assert.deepEqual(gone.notes, base.notes);
  assert.equal(gone.x, undefined, "the position of a room that is gone means nothing");
  assert.equal(repairs.length, 1);
  // A rename map lands in the new room instead (and reports no repair).
  const renamed = normalizeSave({ ...base, room: "old_hold" }, { ...known, renamedRooms: { old_hold: "below_decks" } }, repairs = []);
  assert.equal(renamed.room, "below_decks");
  assert.equal(renamed.x, base.x, "a renamed room keeps the player's position");
  assert.equal(repairs.length, 0);
  // A queued door to a renamed room follows the rename too.
  const q = normalizeSave({ ...base, queue: [{ k: "go", room: "old_hold" }, { k: "go", room: "nowhere" }] },
    { ...known, renamedRooms: { old_hold: "below_decks" } });
  assert.deepEqual(q.queue, [{ k: "go", room: "below_decks" }]);
  // No act to fall back to (a minimal known): the save is not guessed at.
  assert.equal(normalizeSave({ ...base, room: "removed_room" }, { ...known, actStart: undefined }), null);
});

test("a room that does not belong to the save's act relocates to the act's start", () => {
  const base = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  const repairs = [];
  const d = normalizeSave({ ...base, room: "dock" }, known, repairs); // act 1's harbour, act 2 save
  assert.equal(d.act, 2);
  assert.equal(d.room, ACTS[2].start.room);
  assert.equal(d.x, undefined);
  assert.deepEqual(d.inventory, base.inventory);
  assert.match(repairs[0], /not part of act 2/);
});

test("an unknown act is worked out from the room, or refused, never silently act I", () => {
  const base = JSON.parse(readFileSync(dir + "act4-mid.json", "utf8"));
  for (const act of [9, 0, -1, 2.5, "four", {}]) {
    const repairs = [];
    const d = normalizeSave({ ...base, act }, known, repairs);
    assert.equal(d.act, 4, `act ${JSON.stringify(act)} follows the room`);
    assert.equal(d.room, "arcadia_cabin");
    assert.equal(repairs.length, 1);
  }
  // JSON turns NaN into null, which counts as no act at all: still worked out from the room.
  assert.equal(normalizeSave({ ...base, act: null }, known).act, 4);
  // Nothing to infer from: refuse (corrupt, page archived) rather than put act IV's player in act I.
  assert.equal(normalizeSave({ ...base, act: 9, room: "removed_room" }, known), null);
  assert.equal(normalizeSave({ ...base, act: 9 }, { ...known, actOfRoom: undefined }), null);
  // A save from before acts had a number is act I.
  const { act, ...legacy } = JSON.parse(readFileSync(dir + "act1-mid.json", "utf8"));
  assert.equal(normalizeSave(legacy, { ...known, actOfRoom: undefined }).act, FIRST_ACT);
  assert.equal(normalizeSave(legacy, known).act, 1);
});

test("readSave reports what it repaired so the game can say so", () => {
  const base = JSON.parse(readFileSync(dir + "act3-boundary.json", "utf8"));
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...base, room: "gone" }));
  const r = readSave(known);
  assert.equal(r.corrupt, false);
  assert.equal(r.data.room, "lagoon_shore");
  assert.equal(r.repaired.length, 1);
});

test("SAVE_KEY is never one of the old keys, and its suffix is the SAVE_VERSION", () => {
  assert.equal(OLD_SAVE_KEYS.includes(SAVE_KEY), false);
  assert.ok(SAVE_KEY.endsWith(`.v${SAVE_VERSION}`), `${SAVE_KEY} vs v${SAVE_VERSION}`);
  for (const key of OLD_SAVE_KEYS) {
    const v = Number(key.split(".v").pop());
    assert.ok(v < SAVE_VERSION, `${key} is older than the live shape`);
  }
});

/** One valid sample of every Effect kind; the test below keeps this list in step with types.ts. */
const SAMPLES = {
  flag: { k: "flag", id: "f", v: true }, add: { k: "add", id: "n", n: 1 }, give: { k: "give", item: "compass" },
  take: { k: "take", item: "compass" }, go: { k: "go", room: "dock" }, talk: { k: "talk", tree: "marta", node: "root" },
  act: { k: "act", n: 2 }, win: { k: "win" }, say: { k: "say", text: "Hm." }, sound: { k: "sound", id: "door" },
  music: { k: "music", track: "music_sea" }, note: { k: "note", id: "n", text: "t" },
};

test("isEffect accepts every Effect kind in types.ts: adding a kind without teaching it fails here", () => {
  const types = readFileSync(fileURLToPath(new URL("../../src/game/types.ts", import.meta.url)), "utf8");
  const block = types.slice(types.indexOf("export type Effect ="), types.indexOf("export interface Hotspot"));
  const kinds = [...block.matchAll(/\{ k: "(\w+)"/g)].map((m) => m[1]).sort();
  assert.ok(kinds.length >= 12, "found the union");
  assert.deepEqual(Object.keys(SAMPLES).sort(), kinds, "add a SAMPLES entry (and an isEffect case) for the new kind");
  for (const kind of kinds) {
    assert.equal(isEffect(SAMPLES[kind]), true, kind);
    assert.equal(isEffect({ k: kind }) || kind === "win", kind === "win", `${kind} needs its fields`);
  }
  assert.equal(isEffect({ k: "teleport" }), false);
});

test("an unreadable page that cannot be archived is never cleared: the raw page stays", () => {
  const raw = "{broken";
  localStorage.setItem(SAVE_KEY, raw);
  const real = localStorage;
  globalThis.localStorage = { ...real, getItem: real.getItem, removeItem: real.removeItem, setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.equal(backupCorrupt(raw), false, "the failure is reported, not swallowed");
  assert.equal(archiveSave(raw, "future", SAVE_KEY, 9), false);
  // The game's rule: clear only when the backup returned true. The page is where it was.
  assert.equal(real.getItem(SAVE_KEY), raw);
  assert.deepEqual(archivedSaves(), []);
  globalThis.localStorage = storage({ failSet: true });
  assert.equal(backupCorrupt(raw), false);
  assert.equal(stashCurrentSave(), "none");
});

test("a second corruption never overwrites the first backup", () => {
  assert.equal(backupCorrupt("{first"), true);
  assert.equal(backupCorrupt("{second"), true);
  assert.equal(backupCorrupt("{first"), true, "the same page is not duplicated");
  const pages = archivedSaves();
  assert.deepEqual(pages.map((p) => p.raw), ["{first", "{second"]);
  assert.ok(pages.every((p) => p.reason === "corrupt"));
  assert.equal(localStorage.getItem(SAVE_KEY + ".corrupt"), null, "the single overwritten key is gone");
  // Copies of voyages are evicted before a corrupt or newer-build page is.
  for (let i = 0; i < MAX_ARCHIVED + 2; i++) archiveSave(`{"copy":${i}}`, "migrated");
  const raws = archivedSaves().map((p) => p.raw);
  assert.equal(raws.length, MAX_ARCHIVED);
  assert.ok(raws.includes("{first") && raws.includes("{second"));
});

test("a backup an older build left under the .corrupt key is listed as the oldest page", () => {
  localStorage.setItem(SAVE_KEY + ".corrupt", "{legacy");
  assert.deepEqual(archivedSaves().map((p) => p.raw), ["{legacy"]);
  backupCorrupt("{new");
  assert.deepEqual(archivedSaves().map((p) => p.raw), ["{legacy", "{new"]);
});

test("Continue needs a readable save: a corrupt or newer-build page is offered for recovery instead", () => {
  assert.equal(hasAnySave(known), false);
  const good = JSON.parse(readFileSync(dir + "act1-mid.json", "utf8"));
  localStorage.setItem(SAVE_KEY, "{not json");
  assert.equal(hasAnySave(), true, "a bare key check still sees it");
  assert.equal(hasAnySave(known), false);
  assert.deepEqual(unreadableSave(known), { raw: "{not json", reason: "corrupt" });
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...good, version: SAVE_VERSION + 1 }));
  assert.equal(hasAnySave(known), false);
  assert.equal(unreadableSave(known).reason, "future");
  assert.equal(unreadableSave(known).version, SAVE_VERSION + 1);
  localStorage.setItem(SAVE_KEY, JSON.stringify(good));
  assert.equal(hasAnySave(known), true);
  assert.equal(unreadableSave(known), null);
});

test("recovery: the archive lists loadable pages, validates before restoring, and stashes the current voyage", () => {
  const one = JSON.parse(readFileSync(dir + "act1-mid.json", "utf8"));
  const two = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  archiveSave(JSON.stringify(two), "migrated", SAVE_KEY, 3);
  archiveSave("{broken", "corrupt");
  archiveSave(JSON.stringify({ ...one, version: SAVE_VERSION + 1 }), "future", SAVE_KEY, SAVE_VERSION + 1);
  archiveSave(JSON.stringify({ ...one, at: 5 }), "old-key", "brasscompass.save.v3", 3);
  const pages = recoverablePages(known);
  assert.deepEqual(pages.map((p) => p.data.act), [2], "only a page the current content can load is offered; old-story keys are not");
  // The page being replaced is archived first, so the recovery can itself be taken back.
  assert.equal(writeSave(one), true);
  assert.equal(restoreArchivedSave(pages[0].page, known), true);
  assert.deepEqual(readSave(known).data, two);
  assert.ok(archivedSaves().some((p) => p.reason === "replaced" && p.raw === JSON.stringify(one)));
  assert.deepEqual(recoverablePages(known).map((p) => p.data.act).sort(), [1, 2]);
  // An unreadable page is refused, and nothing is touched.
  const before = localStorage.getItem(SAVE_KEY);
  assert.equal(restoreArchivedSave({ at: 1, reason: "corrupt", key: SAVE_KEY, raw: "{broken" }, known), false);
  assert.equal(restoreArchivedSave({ at: 1, reason: "future", key: SAVE_KEY, raw: JSON.stringify({ ...one, version: 99 }) }, known), false);
  assert.equal(localStorage.getItem(SAVE_KEY), before);
});

test("a recovery whose current page cannot be archived leaves the current save alone", () => {
  const one = JSON.parse(readFileSync(dir + "act1-mid.json", "utf8"));
  const two = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  writeSave(one);
  const real = localStorage;
  globalThis.localStorage = { ...real, getItem: real.getItem, setItem: () => { throw new Error("Quota"); } };
  assert.equal(restoreArchivedSave({ at: 1, reason: "migrated", key: SAVE_KEY, raw: JSON.stringify(two) }, known), false);
  assert.deepEqual(JSON.parse(real.getItem(SAVE_KEY)), one);
});

test("restoreStashedSave validates the page and archives the save it replaces", () => {
  const one = JSON.parse(readFileSync(dir + "act1-mid.json", "utf8"));
  const two = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  writeSave(one);
  assert.equal(stashCurrentSave(), "ok");
  writeSave(two);
  assert.equal(restoreStashedSave(known), true);
  assert.deepEqual(readSave(known).data, one);
  assert.ok(archivedSaves().some((p) => p.reason === "replaced" && JSON.parse(p.raw).act === 2), "act II voyage kept");
  assert.equal(hasAnySave(known), true);
  // A stash that can no longer be read is archived and dropped, never installed over the live save.
  localStorage.setItem(PREVIOUS_KEY, "{rubbish");
  assert.equal(restoreStashedSave(known), false);
  assert.deepEqual(readSave(known).data, one);
  assert.equal(localStorage.getItem(PREVIOUS_KEY), null);
  assert.ok(archivedSaves().some((p) => p.raw === "{rubbish" && p.reason === "corrupt"));
  // ...and when storage refuses the archive, the stash stays where it is.
  localStorage.setItem(PREVIOUS_KEY, "{rubbish2");
  const real = localStorage;
  globalThis.localStorage = { ...real, getItem: real.getItem, removeItem: real.removeItem, setItem: () => { throw new Error("Quota"); } };
  assert.equal(restoreStashedSave(known), false);
  assert.equal(real.getItem(PREVIOUS_KEY), "{rubbish2");
});

test("a save made while a conversation node is open carries that node's terminal effects", () => {
  const waiting = [{ k: "say", text: "Hm." }, { k: "win" }];
  const terminal = [{ k: "talk", tree: "ending", node: "root" }, { k: "win" }];
  assert.deepEqual(savedQueue(waiting, terminal), [{ k: "say", text: "Hm." }, { k: "talk", tree: "ending", node: "root" }]);
  assert.equal(savedQueue(null, []), undefined);
  assert.equal(savedQueue([{ k: "win" }]), undefined);
  assert.deepEqual(savedQueue(undefined, [{ k: "act", n: 2 }]), [{ k: "act", n: 2 }]);
  // And they survive the trip through storage on the real content (a parked act end is the act's own).
  const base = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  writeSave({ ...base, queue: savedQueue(null, [{ k: "act", n: 2 }, { k: "go", room: "below_decks" }]) });
  assert.deepEqual(readSave(known).data.queue, [{ k: "act", n: 2 }, { k: "go", room: "below_decks" }]);
});

test("stale tab: a stored save newer than the one this tab saw is a conflict, with no event needed", () => {
  const guard = new SaveTabGuard(SAVE_KEY, () => 77);
  assert.equal(guard.checkStored(500), false, "not tracking a page yet: this tab's first write establishes it");
  guard.remember(1000);
  assert.equal(guard.checkStored(null), false, "no stored save or no stamp");
  assert.equal(guard.checkStored(1000), false, "the page this tab wrote");
  assert.equal(guard.checkStored(900), false);
  assert.equal(guard.conflicted, false);
  assert.equal(guard.checkStored(1001), true);
  assert.equal(guard.conflicted, true);
  assert.equal(guard.since, 77);
  // Deliberately taking up a voyage stops tracking until the next write.
  guard.clear();
  assert.equal(guard.checkStored(5000), false);
  // storedSaveAt reads the live key's stamp, tolerating anything else.
  assert.equal(storedSaveAt(), null);
  localStorage.setItem(SAVE_KEY, JSON.stringify({ at: 1234 }));
  assert.equal(storedSaveAt(), 1234);
  localStorage.setItem(SAVE_KEY, "{bad");
  assert.equal(storedSaveAt(), null);
  localStorage.setItem(SAVE_KEY, JSON.stringify({ at: "x" }));
  assert.equal(storedSaveAt(), null);
});

test("a full archive of unreadable pages still keeps a replaced voyage (a new page never evicts itself)", () => {
  for (let i = 0; i < MAX_ARCHIVED; i++) {
    assert.equal(archiveSave(i % 2 ? `{bad${i}` : JSON.stringify({ version: 99, i }), i % 2 ? "corrupt" : "future"), true);
  }
  assert.equal(archivedSaves().length, MAX_ARCHIVED);
  const one = JSON.parse(readFileSync(dir + "act1-mid.json", "utf8"));
  const raw = JSON.stringify(one);
  assert.equal(archiveSave(raw, "replaced"), true);
  const pages = archivedSaves();
  assert.equal(pages.length, MAX_ARCHIVED);
  assert.ok(pages.some((p) => p.raw === raw && p.reason === "replaced"), "the replaced page is kept");
  assert.ok(!pages.some((p) => p.raw === JSON.stringify({ version: 99, i: 0 })), "the oldest unreadable page made room");
});

test("stashCurrentSave tells 'nothing to keep' from 'could not keep'", () => {
  assert.equal(stashCurrentSave(), "none");
  const one = JSON.parse(readFileSync(dir + "act1-mid.json", "utf8"));
  const two = JSON.parse(readFileSync(dir + "act2-mid.json", "utf8"));
  writeSave(one);
  assert.equal(stashCurrentSave(), "ok");
  // A second stash needs the older undo page archived; a refusing store is a failure, not "none".
  writeSave(two);
  const real = localStorage;
  globalThis.localStorage = { ...real, getItem: real.getItem, removeItem: real.removeItem, setItem: () => { throw new Error("Quota"); } };
  assert.equal(stashCurrentSave(), "failed");
  assert.equal(real.getItem(PREVIOUS_KEY), JSON.stringify(one), "the earlier undo page is untouched");
  // With a full archive of unreadable pages the stash still succeeds.
  globalThis.localStorage = real;
  for (let i = 0; i < MAX_ARCHIVED; i++) backupCorrupt(`{bad${i}`);
  assert.equal(stashCurrentSave(), "ok");
  assert.equal(real.getItem(PREVIOUS_KEY), JSON.stringify(two));
  assert.ok(archivedSaves().some((p) => p.raw === JSON.stringify(one) && p.reason === "replaced"));
});

test("setAsideNotice words a corrupt page, a newer-build page and a page that could not be kept differently", () => {
  const corrupt = save.setAsideNotice("corrupt", true);
  const future = save.setAsideNotice("future", true);
  const lost = save.setAsideNotice("corrupt", false);
  assert.match(corrupt, /unreadable notebook was set aside/);
  assert.match(future, /newer notebook was set aside/);
  assert.match(lost, /couldn't set it aside/);
  assert.equal(new Set([corrupt, future, lost]).size, 3);
});

test("a saved queue carries an open node's terminals only when the node has no choices", () => {
  const go = { k: "go", room: "tavern" };
  const say = { k: "say", text: "x" };
  assert.deepEqual(save.openNodeTerminals({ do: [say, go, { k: "win" }] }), [go, { k: "win" }]);
  assert.deepEqual(save.openNodeTerminals({ do: [go], choices: [{ text: "a", to: "END" }] }), [], "choices end the node: no double fire");
  assert.deepEqual(save.openNodeTerminals(null), []);
  assert.deepEqual(save.openNodeTerminals({ choices: [] , do: [go] }), [go]);
  assert.deepEqual(savedQueue([say], save.openNodeTerminals({ do: [go] })), [say, go]);
  assert.equal(savedQueue(undefined, save.openNodeTerminals({ do: [go], choices: [{}] })), undefined);
});

/**
 * Save storage and validation.
 *
 * Kept apart from the game so the shape can be reasoned about (and tested) on its own: what a
 * save contains, what makes one unreadable, and what to do when the browser refuses to write.
 * Nothing here imports content: what counts as a known room, item or act is passed in.
 */

import type { CaseNote } from "./casebook";
import { SOUNDS, type Effect } from "./types";

/** Bumped when the meaning of a field changes; saves without one are version 1. */
export const SAVE_VERSION = 4;

/*
 * HOW TO RENAME OR REMOVE CONTENT WITHOUT STRANDING OLD SAVES
 *
 * A save names rooms, items, flags and conversation nodes by id. When content renames one, add an
 * `old -> new` entry to the matching map below (LEGACY_ROOMS / LEGACY_ITEMS / LEGACY_FLAGS /
 * LEGACY_NODES); `normalizeSave` applies them before anything is validated. Never delete an
 * entry: a save can be years old. When content *removes* a room outright, map it to the room the
 * player should land in; an id that is neither known nor mapped is not fatal any more — the
 * player is put at the start of their act with their inventory and flags kept (see
 * `normalizeSave`). A structural change to the save itself bumps SAVE_VERSION and SAVE_KEY
 * together, and the old page is archived rather than discarded. tests/fixtures/saves/ holds
 * golden saves that must keep loading through the real content: add one when the shape changes.
 */

/**
 * Items that were renamed by a content rewrite. A save holding the old id would otherwise lose
 * it on load, and Act I's crate only hands out the new one once — which would strand the player.
 * Act I's crate item was a lemon, then jet-caps (`mushroom`), and is now rum. An old id is only
 * mapped when the game no longer knows it.
 */
const LEGACY_ITEMS: Record<string, string> = {
  lemon: "rum",
  mushroom: "rum",
};

/**
 * Room ids renamed by a content rewrite. The reboot kept every room id, so this is empty today;
 * the map is the safe path for a future rename: `normalizeSave` applies it *before* validating
 * the room, so an old save lands in the new room instead of being thrown away.
 */
const LEGACY_ROOMS: Record<string, string> = {};

/**
 * Flag ids renamed by a content rewrite, applied before validation and before the ending flags
 * are cleared. The previous cut called its two closing choices `ending_pirate` / `ending_desk`;
 * the reboot's are `ending_long_way` / `ending_fog_lifts`.
 */
const LEGACY_FLAGS: Record<string, string> = {
  ending_pirate: "ending_long_way",
  ending_desk: "ending_fog_lifts",
};

/** Conversation nodes renamed by a content rewrite, by tree; a saved queue may still name them. */
const LEGACY_NODES: Record<string, Record<string, string>> = {
  tavernkeeper: { nofungus: "norum", nofungus2: "norum2" },
};

/**
 * Flags that pick the closing card. A save is deliberately written *before* the final choice, so
 * these are never part of a resumable voyage: the choice has to be made again on Continue. They
 * are stripped when a save is written (so a completed run cannot pre-seed the next one) and when
 * one is read (healing saves written by older builds, which did persist them).
 */
export const ENDING_FLAGS: ReadonlySet<string> = new Set([
  "ending_fog_lifts", "ending_long_way", "ending_pirate", "ending_desk",
]);

/**
 * The rest of what the final choice sets: `curse_broken` goes with laying the dead to rest,
 * `escaped_fog` with taking the living and running. They are companion markers used by the
 * ending cleanup; they are cleared with the ending flag so a completed run cannot pre-seed a
 * later voyage.
 */
export const FINAL_CHOICE_FLAGS: ReadonlySet<string> = new Set(["curse_broken", "escaped_fog"]);

/** Everything the final choice can set; none of it belongs in the pre-choice save. */
export const ENDING_RESET_FLAGS: ReadonlySet<string> = new Set([...ENDING_FLAGS, ...FINAL_CHOICE_FLAGS]);

export interface SaveData {
  /** Shape version; see SAVE_VERSION. */
  version: number;
  room: string;
  /** Where the player stood. Missing when the stored position was unusable: use the entry. */
  x?: number;
  y?: number;
  facing: 1 | -1;
  flags: Record<string, unknown>;
  inventory: string[];
  /** Which act the save belongs to. Older saves without one are treated as the first act. */
  act: number;
  /** Casebook entries filed so far. */
  notes: CaseNote[];
  /**
   * False when the save was written at the act boundary, before `startAct` ran the act's
   * opening effects. Those give items (Act III's crowbar) the act cannot be finished without,
   * so a resume has to run them.
   */
  actStarted: boolean;
  /**
   * Effects still waiting for a line to be read when the save was written: lines, sounds and
   * transitions (state changes apply at once and are already in `flags` and `inventory`).
   * A resume runs them.
   */
  queue?: Effect[];
  /**
   * The hint on screen when the save was written (the tip ladder's `shown()` line), so Continue
   * can say what Fenn was about to do. Additive: a save from before it simply has none.
   */
  tip?: string;
  /** When the save was written, in milliseconds since the epoch. Additive, like `tip`. */
  at?: number;
}

export const SAVE_KEY = "brasscompass.save.v4";
/** Saves from before the story rewrite: restarted at the beginning of the new voyage. */
export const OLD_SAVE_KEYS = ["brasscompass.save.v3", "brasscompass.save.v2"];
/** Every raw save that could not be used as-is, kept so no progress is ever silently deleted. */
export const ARCHIVE_KEY = "brasscompass.save.archive";
/** The voyage a "Begin anew" / "Restart" replaced, so the title can take it up again. */
export const PREVIOUS_KEY = "brasscompass.save.previous";

export interface SaveKnown {
  room: (id: string) => boolean;
  item: (id: string) => boolean;
  act: (n: number) => boolean;
  firstAct: number;
  /** Whether a conversation exists (and, given a node, whether the node does). */
  talk?: (tree: string, node?: string) => boolean;
  /** Where act `n` begins, or undefined for an act that doesn't exist. */
  actStart?: (n: number) => { room: string; pos?: { x: number; y: number } } | undefined;
  /** Whether room `room` belongs to act `n` (reach.ts); omitted, any known room is accepted. */
  roomInAct?: (n: number, room: string) => boolean;
  /** Whether conversation `tree` is reachable in act `n`; omitted, any known tree is accepted. */
  treeInAct?: (n: number, tree: string) => boolean;
  /** The last act. A queued `act` in this act is dropped: the ending is not a resumable queue. */
  lastAct?: number;
  /** The act a room belongs to, for a save whose act is unreadable; undefined when none/ambiguous. */
  actOfRoom?: (room: string) => number | undefined;
  /** Flags that choose the closing card; defaults to ENDING_FLAGS. */
  endingFlags?: ReadonlySet<string>;
  /** Room ids renamed by content, applied before the room is validated. */
  renamedRooms?: Readonly<Record<string, string>>;
  /** Flag ids renamed by content, applied before the ending flags are stripped. */
  renamedFlags?: Readonly<Record<string, string>>;
}

/** An item id as the current content knows it, or null when it names nothing. */
function knownItem(id: string, known: SaveKnown): string | null {
  if (known.item(id)) return id;
  const renamed = LEGACY_ITEMS[id];
  return renamed !== undefined && known.item(renamed) ? renamed : null;
}

/**
 * The act-awareness `SaveKnown` needs, built from `actReach` (reach.ts) and the act table, so the
 * game and the tests describe the same world. A room that two acts both reach has no single act.
 */
export function actKnowledge(
  reach: ReadonlyMap<number, { rooms: ReadonlySet<string>; trees: ReadonlySet<string> }>,
  acts: Readonly<Record<number, { start: { room: string; pos?: { x: number; y: number } } }>>,
): Pick<SaveKnown, "actStart" | "roomInAct" | "actOfRoom" | "treeInAct" | "lastAct"> {
  const lastAct = Math.max(0, ...Object.keys(acts).map(Number));
  return {
    actStart: (n) => acts[n]?.start,
    roomInAct: (n, room) => reach.get(n)?.rooms.has(room) ?? false,
    treeInAct: (n, tree) => reach.get(n)?.trees.has(tree) ?? false,
    actOfRoom: (room) => {
      const owners = [...reach].filter(([, r]) => r.rooms.has(room)).map(([n]) => n);
      return owners.length === 1 ? owners[0] : undefined;
    },
    lastAct,
  };
}

/** The shape version a stored object declares; saves without one are version 1. */
export function saveVersionOf(raw: unknown): number {
  if (!isObject(raw) || !isNum(raw.version)) return 1;
  return Math.max(1, Math.floor(raw.version));
}

/** `flags` without the closing-choice flags. The input is not modified. */
export function withoutEndingFlags(
  flags: Record<string, unknown>,
  endingFlags: ReadonlySet<string> = ENDING_RESET_FLAGS,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(flags).filter(([id]) => !endingFlags.has(id)));
}

/** Apply a rename map to a saved object's ids; an existing target wins over the old name. */
function renamedRecord(
  values: Record<string, unknown>,
  map: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const out = { ...values };
  for (const [from, to] of Object.entries(map)) {
    if (!(from in out)) continue;
    if (!(to in out)) out[to] = out[from];
    delete out[from];
  }
  return out;
}

/**
 * A saved queued effect brought up to date with the content, or null when it names something
 * that's gone and can't be mapped. Without this a queue parked before a rename would hand out
 * an item the game no longer has, or open a conversation at a node that no longer exists.
 * `act` is the act the save is in.
 */
function currentEffect(e: Effect, known: SaveKnown, act: number): Effect | null {
  // A parked act ending is always the save's own act ending, and the ending card belongs to the
  // last act: anything else (a damaged save's `act 9`) would roll the credits, or skip acts, from
  // the middle of another one.
  if (e.k === "act") {
    // The last act's ending is not a resumable queue: Continue must let the player make the
    // closing choice, not roll a blank card.
    if (known.lastAct !== undefined && e.n >= known.lastAct) return null;
    return e.n === act && known.act(e.n) ? e : null;
  }
  // A saved ending is never replayed: the save deliberately stops before the final choice, so
  // Continue must let the player make that choice again (with no ending flag left over). The
  // room's own scene/hotspot opens the closing conversation again.
  if (e.k === "win") return null;
  // A queued flag must not select an ending without the player making the closing choice.
  if ((e.k === "flag" || e.k === "add") && ENDING_RESET_FLAGS.has(e.id)) return null;
  if (e.k === "give" || e.k === "take") {
    const item = knownItem(e.item, known);
    return item === null ? null : { ...e, item };
  }
  if (e.k === "talk") {
    const node = e.node !== undefined ? (LEGACY_NODES[e.tree]?.[e.node] ?? e.node) : undefined;
    if (known.talk && !known.talk(e.tree)) return null;
    // A queued conversation must belong to the act it is resumed in; `ending` exists in every
    // act's dialogue map, but must never open from an earlier act.
    if (known.treeInAct && !known.treeInAct(act, e.tree)) return null;
    if (node !== undefined && known.talk && !known.talk(e.tree, node)) return { k: "talk", tree: e.tree };
    return node === undefined ? { k: "talk", tree: e.tree } : { k: "talk", tree: e.tree, node };
  }
  if (e.k === "go") {
    const room = (known.renamedRooms ?? LEGACY_ROOMS)[e.room] ?? e.room;
    if (!known.room(room)) return null;
    // A saved transition must not teleport across acts.
    if (known.roomInAct && !known.roomInAct(act, room)) return null;
    return room === e.room ? e : { ...e, room };
  }
  return e;
}

export interface LoadResult {
  data: SaveData | null;
  /** The unparsed text, kept so a corrupt save can be backed up rather than lost. */
  raw: string | null;
  /** True when a save existed but could not be used. */
  corrupt: boolean;
  /** The shape this save was written in, when it was older and has been migrated. */
  migratedFrom?: number;
  /**
   * True when the save was written by a newer build than this one. `raw` is the only safe copy:
   * the caller must archive it rather than overwrite it.
   */
  future?: boolean;
  /** The shape a future save declared, kept for the archive. */
  futureVersion?: number;
  /**
   * What `normalizeSave` had to repair to make the save usable (an unknown room moved to the act's
   * start, an unreadable act worked out from the room). The game says so; empty/absent when none.
   */
  repaired?: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Whether a stored value is a well-formed effect (names are resolved by the game). */
export function isEffect(v: unknown): v is Effect {
  if (!isObject(v)) return false;
  switch (v.k) {
    case "flag": return isStr(v.id) && "v" in v;
    case "add": return isStr(v.id) && isNum(v.n);
    case "give": case "take": return isStr(v.item);
    case "go": return isStr(v.room);
    case "talk": return isStr(v.tree) && (v.node === undefined || isStr(v.node));
    case "act": return isNum(v.n);
    case "win": return true;
    case "say": return isStr(v.text);
    case "sound": return (SOUNDS as readonly unknown[]).includes(v.id);
    case "music": return isStr(v.track);
    case "note": return isStr(v.id) && isStr(v.text);
    default: return false;
  }
}

/**
 * Turn whatever was stored into a usable save, or null when it can't be one. The things a
 * voyage can't continue without (the flags, the inventory list) must be sound; anything else
 * that's damaged or names something that no longer exists is dropped, mapped or reset:
 *
 * - a room that is renamed (LEGACY_ROOMS) lands in the new room; one that is gone, or that does
 *   not belong to the save's act, puts the player at the act's start (inventory and flags kept);
 * - an act that is missing is worked out from the room (a save from before acts is act I); an act
 *   that is present but unknown is worked out from the room too, and is refused when it cannot be
 *   — never quietly turned into act I with the player left in another act's room.
 *
 * Every repair is appended to `repairs`, so the game can tell the player.
 */
export function normalizeSave(raw: unknown, known: SaveKnown, repairs: string[] = []): SaveData | null {
  if (!isObject(raw)) return null;
  // A newer build's shape may mean something else in every field: never coerce it into this one.
  if (saveVersionOf(raw) > SAVE_VERSION) return null;
  if (!isObject(raw.flags)) return null;
  if (!Array.isArray(raw.inventory)) return null;

  const renamed = isStr(raw.room) ? ((known.renamedRooms ?? LEGACY_ROOMS)[raw.room] ?? raw.room) : null;
  const knownRoom = renamed !== null && known.room(renamed) ? renamed : null;

  let act: number;
  if (raw.act === undefined || raw.act === null) {
    act = (knownRoom !== null ? known.actOfRoom?.(knownRoom) : undefined) ?? known.firstAct;
  } else if (isNum(raw.act) && known.act(raw.act)) {
    act = raw.act;
  } else {
    const inferred = knownRoom !== null ? known.actOfRoom?.(knownRoom) : undefined;
    if (inferred === undefined) return null;
    act = inferred;
    repairs.push(`act ${String(raw.act)} is unknown; resumed in act ${inferred}`);
  }

  let room: string;
  let relocated: { x: number; y: number } | null | undefined;
  if (knownRoom !== null && (!known.roomInAct || known.roomInAct(act, knownRoom))) {
    room = knownRoom;
  } else {
    const start = known.actStart?.(act);
    if (!start || !known.room(start.room)) return null;
    repairs.push(`room ${isStr(raw.room) ? raw.room : "?"} is not part of act ${act}; moved to ${start.room}`);
    room = start.room;
    relocated = start.pos ?? null;
  }
  const inventory: string[] = [];
  for (const raw_id of raw.inventory) {
    if (!isStr(raw_id)) continue;
    const id = knownItem(raw_id, known);
    if (id !== null && !inventory.includes(id)) inventory.push(id);
  }
  const notes: CaseNote[] = [];
  if (Array.isArray(raw.notes)) {
    for (const n of raw.notes) {
      if (!isObject(n) || !isStr(n.id) || !isStr(n.text)) continue;
      if (notes.some((m) => m.id === n.id)) continue;
      notes.push({ id: n.id, text: n.text, act: isNum(n.act) ? n.act : act });
    }
  }
  // Rename first, then clear the ending choice: a save is always before that choice, so even an
  // old save that leaked one into its flags comes back ready to choose again.
  const flags = withoutEndingFlags(
    renamedRecord(raw.flags, known.renamedFlags ?? LEGACY_FLAGS),
    known.endingFlags ?? ENDING_RESET_FLAGS,
  );
  const data: SaveData = {
    version: SAVE_VERSION,
    room,
    facing: raw.facing === -1 ? -1 : 1,
    flags,
    inventory,
    act,
    notes,
    actStarted: raw.actStarted !== false,
  };
  if (relocated) { data.x = relocated.x; data.y = relocated.y; }
  else if (relocated === undefined && isNum(raw.x) && isNum(raw.y)) { data.x = raw.x; data.y = raw.y; }
  // The recap's own fields: additive, so a save written before them loads without them.
  if (isStr(raw.tip) && raw.tip.trim()) data.tip = raw.tip;
  if (isNum(raw.at)) data.at = raw.at;
  if (Array.isArray(raw.queue)) {
    const queue: Effect[] = [];
    for (const e of raw.queue) {
      if (!isEffect(e)) continue;
      const current = currentEffect(e, known, act);
      if (current) queue.push(current);
    }
    if (queue.length) data.queue = queue;
  }
  return data;
}

/** Read and validate the current save. Never throws; a bad save comes back as `corrupt`. */
export function readSave(known: SaveKnown): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { data: null, raw: null, corrupt: false };
  }
  if (!raw) return { data: null, raw: null, corrupt: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: null, raw, corrupt: true };
  }
  const version = saveVersionOf(parsed);
  if (version > SAVE_VERSION) return { data: null, raw, corrupt: false, future: true, futureVersion: version };
  const repairs: string[] = [];
  const data = normalizeSave(parsed, known, repairs);
  if (!data) return { data: null, raw, corrupt: true };
  const result: LoadResult = { data, raw, corrupt: false };
  if (version < SAVE_VERSION) result.migratedFrom = version;
  if (repairs.length) result.repaired = repairs;
  return result;
}

/** Write the save. Returns false when storage is full or blocked. */
export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to do */
  }
}

export type ArchiveReason = "migrated" | "old-key" | "future" | "corrupt" | "replaced";

export interface ArchivedSave {
  at: number;
  reason: ArchiveReason;
  /** The storage key the raw text came from. */
  key: string;
  /** The shape it declared, when it could be read. */
  version?: number;
  raw: string;
}

/**
 * How many archived pages to keep: the last few, not an unbounded notebook. When it is full the
 * pages that are copies of a voyage (migrated, replaced, old keys) go first; an unreadable or
 * newer-build page is the only copy of what it holds, so it is the last to be dropped.
 */
export const MAX_ARCHIVED = 8;
const PRECIOUS: ReadonlySet<ArchiveReason> = new Set(["corrupt", "future"]);

/** The legacy single backup key older builds wrote for a corrupt save. */
const LEGACY_CORRUPT_KEY = SAVE_KEY + ".corrupt";

function readArchive(): ArchivedSave[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is ArchivedSave =>
      isObject(v) && isStr(v.raw) && isStr(v.reason) && isStr(v.key) && isNum(v.at));
  } catch {
    return [];
  }
}

/**
 * Read the archive, dropping anything malformed (or written by something else). A backup left by
 * an older build under the single `.corrupt` key is listed too, as the oldest page.
 */
export function archivedSaves(): ArchivedSave[] {
  const list = readArchive();
  try {
    const legacy = localStorage.getItem(LEGACY_CORRUPT_KEY);
    if (legacy && !list.some((saved) => saved.raw === legacy)) {
      list.unshift({ at: 0, reason: "corrupt", key: LEGACY_CORRUPT_KEY, raw: legacy });
    }
  } catch { /* storage refused: the archive itself is what counts */ }
  return list;
}

/**
 * Keep a raw save that cannot be loaded as the current one: an older shape, an old-story key, one
 * written by a newer build, one that is unreadable, or the voyage another replaced. Idempotent, so
 * a re-read doesn't duplicate it. Returns false when it could not be kept: callers must then leave
 * the original where it is (preservation beats tidiness).
 */
export function archiveSave(raw: string, reason: ArchiveReason, key = SAVE_KEY, version?: number): boolean {
  try {
    const list = readArchive();
    if (list.some((saved) => saved.raw === raw)) return true;
    list.push({ at: Date.now(), reason, key, ...(version !== undefined ? { version } : {}), raw });
    // The page just added is never the one to go: a full archive of unreadable pages must still
    // have room for the voyage being replaced (that copy may be the only one). Copies go first,
    // then the oldest page of any kind.
    while (list.length > MAX_ARCHIVED) {
      const older = list.slice(0, -1);
      const spare = older.findIndex((saved) => !PRECIOUS.has(saved.reason));
      list.splice(spare >= 0 ? spare : 0, 1);
    }
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
    // Read it back: a store that accepted the call but kept nothing is a failure too.
    return readArchive().some((saved) => saved.raw === raw);
  } catch {
    return false;
  }
}

/**
 * Keep an unreadable save in the archive, as its own timestamped page, so a bad parse never
 * destroys progress and a second corruption never overwrites the first. True once it is safe;
 * only then may the caller clear the live key.
 */
export function backupCorrupt(raw: string, version?: number): boolean {
  return archiveSave(raw, "corrupt", SAVE_KEY, version);
}

/** Pages worth offering back: voyages in this build's shape, not the old story's saves. */
export interface RecoverablePage {
  page: ArchivedSave;
  data: SaveData;
}

/** Archived pages the current content can load again, newest first. */
export function recoverablePages(known: SaveKnown): RecoverablePage[] {
  const out: RecoverablePage[] = [];
  for (const page of archivedSaves()) {
    // The old story's saves restart; they were archived so they are never lost, not to be resumed.
    if (page.reason === "old-key" && page.key !== PREVIOUS_KEY) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(page.raw); } catch { continue; }
    const data = normalizeSave(parsed, known);
    if (data) out.push({ page, data });
  }
  return out.sort((a, b) => b.page.at - a.page.at);
}

/**
 * Make an archived page the current save. The page is validated with the same normalizer a load
 * uses; whatever voyage is current is archived first (and left alone if that fails), so a
 * recovery can itself be taken back from the list.
 */
export function restoreArchivedSave(page: ArchivedSave, known: SaveKnown): boolean {
  let parsed: unknown;
  try { parsed = JSON.parse(page.raw); } catch { return false; }
  const data = normalizeSave(parsed, known);
  if (!data) return false;
  try {
    const current = localStorage.getItem(SAVE_KEY);
    if (current && current !== page.raw && !archiveSave(current, "replaced")) return false;
  } catch {
    return false;
  }
  return writeSave(data);
}

/**
 * Take an old key out of storage, but archive its page first. The old story cannot be resumed in
 * this one; it can still be read back, or recovered by hand, instead of vanishing on first read.
 */
export function takeOldSave(): string | null {
  let first: string | null = null;
  for (const key of OLD_SAVE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        let version: number | undefined;
        try { version = saveVersionOf(JSON.parse(raw)); } catch { /* unreadable, raw is enough */ }
        // Only drop the old key once the page is safely in the archive. If storage refuses the
        // archive write, the old key stays where it is: preservation beats tidiness.
        if (archiveSave(raw, "old-key", key, version)) localStorage.removeItem(key);
        first ??= raw;
      }
    } catch {
      /* keep looking */
    }
  }
  return first;
}

/**
 * What stashing the current save did: there was nothing to keep, it is kept, or it could not be
 * kept (the archive or storage refused). A new voyage must not replace a save that "failed".
 */
export type StashResult = "none" | "ok" | "failed";

/**
 * Keep the current save as the one a new voyage replaced. `Begin anew` and `Restart` call this
 * before their first write, so the title can offer "Take up last voyage" without a redesign.
 */
export function stashCurrentSave(): StashResult {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return "none";
    // A second new voyage replaces the one-step undo too; put the older page in the archive
    // rather than dropping it, so "one undo" doesn't mean "one page only". If the archive
    // refuses it, the stash is left as it is: the older page is not overwritten.
    const older = localStorage.getItem(PREVIOUS_KEY);
    if (older && older !== raw && !archiveSave(older, "replaced", PREVIOUS_KEY)) return "failed";
    localStorage.setItem(PREVIOUS_KEY, raw);
    return localStorage.getItem(PREVIOUS_KEY) === raw ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

/** The one line the title shows when it has just set an unreadable live page aside. */
export function setAsideNotice(reason: "corrupt" | "future", kept: boolean): string {
  if (!kept) {
    return "The last page of my notebook can't be read, and I couldn't set it aside. Begin will not " +
      "write over it: free some browser storage and reload.";
  }
  return reason === "future"
    ? "A page from a newer notebook was set aside untouched. Open that newer copy of the game to read it; Begin starts a fresh page here."
    : "A page from an unreadable notebook was set aside, kept in the archive. Begin starts a fresh page.";
}

export function hasStashedSave(): boolean {
  try {
    return localStorage.getItem(PREVIOUS_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Put the stashed voyage back as the current save. One undo; the stash is consumed. The page is
 * validated first (a page that can no longer be read is archived and the stash cleared, never
 * installed), and the save it replaces is archived rather than overwritten.
 */
export function restoreStashedSave(known: SaveKnown): boolean {
  try {
    const raw = localStorage.getItem(PREVIOUS_KEY);
    if (!raw) return false;
    let data: SaveData | null = null;
    try { data = normalizeSave(JSON.parse(raw), known); } catch { /* unreadable */ }
    if (!data) {
      if (archiveSave(raw, "corrupt", PREVIOUS_KEY)) localStorage.removeItem(PREVIOUS_KEY);
      return false;
    }
    const current = localStorage.getItem(SAVE_KEY);
    if (current && current !== raw && !archiveSave(current, "replaced")) return false;
    if (!writeSave(data)) return false;
    localStorage.removeItem(PREVIOUS_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether Continue has something to continue. With `known`, the save must be readable (a corrupt
 * or newer-build page is not a voyage to resume; the title offers to recover it instead); an
 * old-story key still counts, since Continue is what archives it. Without `known`, any key.
 */
export function hasAnySave(known?: SaveKnown): boolean {
  try {
    if (known) {
      if (localStorage.getItem(SAVE_KEY) !== null) return readSave(known).data !== null;
    } else if (localStorage.getItem(SAVE_KEY) !== null) return true;
    return OLD_SAVE_KEYS.some((k) => localStorage.getItem(k) !== null);
  } catch {
    return false;
  }
}

/** The live page when it exists but cannot be resumed, so it can be put in the archive. */
export function unreadableSave(known: SaveKnown): { raw: string; reason: "corrupt" | "future"; version?: number } | null {
  const r = readSave(known);
  if (r.data || !r.raw) return null;
  return r.future
    ? { raw: r.raw, reason: "future", version: r.futureVersion }
    : { raw: r.raw, reason: "corrupt" };
}

/** `at` of the save currently in storage, or null (no save, no timestamp, storage refused). */
export function storedSaveAt(): number | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isObject(parsed) && isNum(parsed.at) ? parsed.at : null;
  } catch {
    return null;
  }
}

/**
 * The saved queue: what is still waiting to play, minus a pending `win` (the save is before the
 * final choice), plus the terminal effects (go, talk, act) of a conversation node that is open
 * right now. Those run only when the player leaves the node, but its `seen:` flag is already
 * set, so a save made mid-node must carry them or closing the tab would lose them for good.
 */
export function savedQueue(waiting: readonly Effect[] | null | undefined, openNodeTerminal: readonly Effect[] = []): Effect[] | undefined {
  const queue = [...(waiting ?? []), ...openNodeTerminal].filter((e) => e.k !== "win");
  return queue.length ? queue : undefined;
}

/**
 * The terminal effects (go, talk, act, win) a save should carry for the conversation node that is
 * open. A node that offers choices ends through them, so a terminal beside choices is not "the
 * rest of the node" to replay: carrying it would fire it on load as well as on the choice that
 * ends the talk. The content lint forbids that shape; this keeps a save safe if one slips in.
 */
export function openNodeTerminals(node: { choices?: readonly unknown[]; do?: readonly Effect[] } | null | undefined): Effect[] {
  if (!node || node.choices?.length) return [];
  return (node.do ?? []).filter((e) => e.k === "go" || e.k === "talk" || e.k === "act" || e.k === "win");
}

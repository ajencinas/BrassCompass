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
 * `escaped_fog` with taking the living and running. They drive the last tip ("Let the ending
 * play"), so they must be cleared with the ending flag or Continue would think the choice had
 * already been made.
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
  /**
   * The flags act `n`'s own content can set, `seen:` and `looked:` included (see reach.ts), or
   * undefined for an act that doesn't exist. Only an old save's migration needs it.
   */
  actFlags?: (n: number) => ReadonlySet<string> | undefined;
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
  if (e.k === "act") return e.n === act && known.act(e.n) ? e : null;
  // A saved ending is never replayed: the save deliberately stops before the final choice, so
  // Continue must let the player make that choice again (with no ending flag left over). The
  // room's own scene/hotspot opens the closing conversation again.
  if (e.k === "win") return null;
  if (e.k === "give" || e.k === "take") {
    const item = knownItem(e.item, known);
    return item === null ? null : { ...e, item };
  }
  if (e.k === "talk") {
    const node = e.node !== undefined ? (LEGACY_NODES[e.tree]?.[e.node] ?? e.node) : undefined;
    if (known.talk && !known.talk(e.tree)) return null;
    if (node !== undefined && known.talk && !known.talk(e.tree, node)) return { k: "talk", tree: e.tree };
    return node === undefined ? { k: "talk", tree: e.tree } : { k: "talk", tree: e.tree, node };
  }
  if (e.k === "go" && !known.room(e.room)) return null;
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
 * voyage can't continue without (a known room, the flags, the inventory list) must be sound;
 * anything else that's damaged or names something that no longer exists is dropped or reset.
 */
export function normalizeSave(raw: unknown, known: SaveKnown): SaveData | null {
  if (!isObject(raw)) return null;
  // A newer build's shape may mean something else in every field: never coerce it into this one.
  if (saveVersionOf(raw) > SAVE_VERSION) return null;
  if (!isStr(raw.room)) return null;
  const room = (known.renamedRooms ?? LEGACY_ROOMS)[raw.room] ?? raw.room;
  if (!known.room(room)) return null;
  if (!isObject(raw.flags)) return null;
  if (!Array.isArray(raw.inventory)) return null;

  const act = isNum(raw.act) && known.act(raw.act) ? raw.act : known.firstAct;
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
  if (isNum(raw.x) && isNum(raw.y)) { data.x = raw.x; data.y = raw.y; }
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
  const data = normalizeSave(parsed, known);
  if (!data) return { data: null, raw, corrupt: true };
  return version < SAVE_VERSION
    ? { data, raw, corrupt: false, migratedFrom: version }
    : { data, raw, corrupt: false };
}

/**
 * What survives from a save of the old story: only its act and flags, since the act restarts.
 * Returns null when there's nothing worth keeping (unreadable, or still in the first act).
 * Given `actFlags`, the flags are those `flagsForRestart` keeps.
 */
export function migrateOldSave(raw: string, known: Pick<SaveKnown, "act" | "firstAct" | "actFlags">): { act: number; flags: Record<string, unknown> } | null {
  let d: unknown;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!isObject(d)) return null;
  const act = isNum(d.act) && known.act(d.act) ? d.act : known.firstAct;
  if (act === known.firstAct) return null;
  const flags = isObject(d.flags) ? { ...d.flags } : {};
  return { act, flags: known.actFlags ? flagsForRestart(flags, act, { ...known, actFlags: known.actFlags }) : flags };
}

/**
 * The flags a save keeps when its act restarts from the top, with that act's starting
 * inventory. A flag the restarted act sets itself (or a later act does) says one of its one-shot
 * sources is spent — Pell's chest opened, a conversation heard, a thing looked at — without the
 * item that came out of it, and can strand the act: those go. A flag an earlier act can set is
 * progress, and stays (counters such as `aff` included). Flags nothing sets any more are kept;
 * nothing reads them either.
 */
export function flagsForRestart(
  flags: Record<string, unknown>,
  act: number,
  known: Pick<SaveKnown, "act" | "firstAct"> & { actFlags: NonNullable<SaveKnown["actFlags"]> },
): Record<string, unknown> {
  const earlier = new Set<string>();
  for (let n = known.firstAct; n < act; n++) for (const id of known.actFlags(n) ?? []) earlier.add(id);
  const restarted = new Set<string>();
  for (let n = act; known.act(n); n++) for (const id of known.actFlags(n) ?? []) if (!earlier.has(id)) restarted.add(id);
  return Object.fromEntries(Object.entries(flags).filter(([id]) => !restarted.has(id)));
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

/** Keep an unreadable save beside the real one, so a bad parse never destroys progress. */
export function backupCorrupt(raw: string): void {
  try {
    localStorage.setItem(SAVE_KEY + ".corrupt", raw);
  } catch {
    /* nothing else to do */
  }
}

export type ArchiveReason = "migrated" | "old-key" | "future" | "corrupt";

export interface ArchivedSave {
  at: number;
  reason: ArchiveReason;
  /** The storage key the raw text came from. */
  key: string;
  /** The shape it declared, when it could be read. */
  version?: number;
  raw: string;
}

/** How many archived pages to keep: the last few, not an unbounded notebook. */
export const MAX_ARCHIVED = 5;

/** Read the archive, dropping anything malformed (or written by something else). */
export function archivedSaves(): ArchivedSave[] {
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
 * Keep a raw save that cannot be loaded as the current one: an older shape, an old-story key, or
 * one written by a newer build. Best-effort and idempotent, so a re-read doesn't duplicate it.
 */
export function archiveSave(raw: string, reason: ArchiveReason, key = SAVE_KEY, version?: number): boolean {
  try {
    const list = archivedSaves();
    if (list.some((saved) => saved.raw === raw)) return true;
    list.push({ at: Date.now(), reason, key, ...(version !== undefined ? { version } : {}), raw });
    while (list.length > MAX_ARCHIVED) list.shift();
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
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
 * Keep the current save as the one a new voyage replaced. `Begin anew` and `Restart` call this
 * before their first write, so the title can offer "Take up last voyage" without a redesign.
 */
export function stashCurrentSave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    // A second new voyage replaces the one-step undo too; put the older page in the archive
    // rather than dropping it, so "one undo" doesn't mean "one page only".
    const older = localStorage.getItem(PREVIOUS_KEY);
    if (older) archiveSave(older, "old-key", PREVIOUS_KEY);
    localStorage.setItem(PREVIOUS_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function hasStashedSave(): boolean {
  try {
    return localStorage.getItem(PREVIOUS_KEY) !== null;
  } catch {
    return false;
  }
}

/** Put the stashed voyage back as the current save. One undo; the stash is consumed. */
export function restoreStashedSave(): boolean {
  try {
    const raw = localStorage.getItem(PREVIOUS_KEY);
    if (!raw) return false;
    localStorage.setItem(SAVE_KEY, raw);
    localStorage.removeItem(PREVIOUS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasAnySave(): boolean {
  try {
    return [SAVE_KEY, ...OLD_SAVE_KEYS].some((k) => localStorage.getItem(k) !== null);
  } catch {
    return false;
  }
}

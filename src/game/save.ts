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
export const SAVE_VERSION = 2;

/**
 * Items that were renamed by a content rewrite. A save holding the old id would otherwise lose
 * it on load, and Act I's crate only hands out the new one once — which would strand the player.
 */
const LEGACY_ITEMS: Record<string, string> = {
  mushroom: "rum",
};

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
}

export const SAVE_KEY = "brasscompass.save.v3";
/** Saves from before the story rewrite: restarted at the beginning of their act. */
export const OLD_SAVE_KEYS = ["brasscompass.save.v2"];

/** What the game knows exists, so a save naming something that's gone can be cleaned up. */
export interface SaveKnown {
  room: (id: string) => boolean;
  item: (id: string) => boolean;
  act: (n: number) => boolean;
  firstAct: number;
}

export interface LoadResult {
  data: SaveData | null;
  /** The unparsed text, kept so a corrupt save can be backed up rather than lost. */
  raw: string | null;
  /** True when a save existed but could not be used. */
  corrupt: boolean;
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
  if (!isStr(raw.room) || !known.room(raw.room)) return null;
  if (!isObject(raw.flags)) return null;
  if (!Array.isArray(raw.inventory)) return null;

  const act = isNum(raw.act) && known.act(raw.act) ? raw.act : known.firstAct;
  const inventory: string[] = [];
  for (const raw_id of raw.inventory) {
    if (!isStr(raw_id)) continue;
    const id = LEGACY_ITEMS[raw_id] ?? raw_id;
    if (known.item(id) && !inventory.includes(id)) inventory.push(id);
  }
  const notes: CaseNote[] = [];
  if (Array.isArray(raw.notes)) {
    for (const n of raw.notes) {
      if (!isObject(n) || !isStr(n.id) || !isStr(n.text)) continue;
      if (notes.some((m) => m.id === n.id)) continue;
      notes.push({ id: n.id, text: n.text, act: isNum(n.act) ? n.act : act });
    }
  }
  const data: SaveData = {
    version: SAVE_VERSION,
    room: raw.room,
    facing: raw.facing === -1 ? -1 : 1,
    flags: { ...raw.flags },
    inventory,
    act,
    notes,
    actStarted: raw.actStarted !== false,
  };
  if (isNum(raw.x) && isNum(raw.y)) { data.x = raw.x; data.y = raw.y; }
  if (Array.isArray(raw.queue)) {
    const queue = raw.queue.filter(isEffect);
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
  const data = normalizeSave(parsed, known);
  return data ? { data, raw, corrupt: false } : { data: null, raw, corrupt: true };
}

/**
 * What survives from a save of the old story: only its act and flags, since the act restarts.
 * Returns null when there's nothing worth keeping (unreadable, or still in the first act).
 */
export function migrateOldSave(raw: string, known: Pick<SaveKnown, "act" | "firstAct">): { act: number; flags: Record<string, unknown> } | null {
  let d: unknown;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!isObject(d)) return null;
  const act = isNum(d.act) && known.act(d.act) ? d.act : known.firstAct;
  if (act === known.firstAct) return null;
  return { act, flags: isObject(d.flags) ? { ...d.flags } : {} };
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

/** Take an old save out of storage, if one exists. Returns its raw text. */
export function takeOldSave(): string | null {
  for (const key of OLD_SAVE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        localStorage.removeItem(key);
        return raw;
      }
    } catch {
      /* keep looking */
    }
  }
  return null;
}

export function hasAnySave(): boolean {
  try {
    return [SAVE_KEY, ...OLD_SAVE_KEYS].some((k) => localStorage.getItem(k) !== null);
  } catch {
    return false;
  }
}

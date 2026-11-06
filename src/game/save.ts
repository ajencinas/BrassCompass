/**
 * Save storage and validation.
 *
 * Kept apart from the game so the shape can be reasoned about (and tested) on its own: what a
 * save contains, what makes one unreadable, and what to do when the browser refuses to write.
 */

import type { CaseNote } from "./casebook";

export interface SaveData {
  room: string;
  x: number;
  y: number;
  facing: 1 | -1;
  flags: Record<string, unknown>;
  inventory: string[];
  /** Which act the save belongs to. Older saves without one are treated as Act I. */
  act: number;
  /** Casebook entries filed so far. */
  notes?: CaseNote[];
  /**
   * False when the save was written at the act boundary, before `startAct` ran the act's
   * opening effects. Those give items (Act III's crowbar) the act cannot be finished without,
   * so a resume has to run them.
   */
  actStarted?: boolean;
}

export const SAVE_KEY = "brasscompass.save.v3";
/** Saves from before the story rewrite: restarted at the beginning of their act. */
export const OLD_SAVE_KEYS = ["brasscompass.save.v2"];

export interface LoadResult {
  data: SaveData | null;
  /** The unparsed text, kept so a corrupt save can be backed up rather than lost. */
  raw: string | null;
  /** True when a save existed but could not be used. */
  corrupt: boolean;
}

/** Read and validate the current save. Never throws; a bad save comes back as `corrupt`. */
export function readSave(isRoom: (id: string) => boolean): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { data: null, raw: null, corrupt: false };
  }
  if (!raw) return { data: null, raw: null, corrupt: false };

  try {
    const d = JSON.parse(raw) as SaveData;
    const usable =
      !!d &&
      typeof d === "object" &&
      isRoom(d.room) &&
      Array.isArray(d.inventory) &&
      d.inventory.every((id) => typeof id === "string") &&
      !!d.flags &&
      typeof d.flags === "object" &&
      !Array.isArray(d.flags) &&
      Number.isFinite(d.x) &&
      Number.isFinite(d.y);
    return usable ? { data: d, raw, corrupt: false } : { data: null, raw, corrupt: true };
  } catch {
    return { data: null, raw, corrupt: true };
  }
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

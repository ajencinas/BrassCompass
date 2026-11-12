/**
 * Two tabs, one notebook.
 *
 * `localStorage` is shared by every tab on the origin, so two copies of the game overwrite each
 * other's save without either noticing. The browser already tells us when another tab writes:
 * the `storage` event fires in *this* tab (never in the writer), with the key that changed.
 * This guard turns that signal into one plain fact — "another tab wrote the voyage" — and the
 * game stops writing over it and tells the player to reload. It does not try to merge voyages.
 *
 * Kept separate from the game and free of DOM types in its input, so the rule can be tested in
 * Node without a browser.
 */

import { SAVE_KEY } from "./save";

/** The part of a StorageEvent the guard needs. */
export interface StorageChange {
  key: string | null;
  newValue: string | null;
}

export class SaveTabGuard {
  private conflictAt: number | null = null;
  constructor(
    private key: string = SAVE_KEY,
    private now: () => number = Date.now,
  ) {}

  /**
   * Note a storage event. Returns true when another tab wrote the save. A removal (null value)
   * is not a conflict: nothing was clobbered, and this tab can carry on.
   */
  observe(event: StorageChange): boolean {
    if (event.key !== this.key || event.newValue === null) return false;
    this.conflictAt = this.now();
    return true;
  }

  /** True once another tab has written the save this page loaded. */
  get conflicted(): boolean {
    return this.conflictAt !== null;
  }

  /** When the conflict was first seen (milliseconds since the epoch), or null. */
  get since(): number | null {
    return this.conflictAt;
  }

  /** Forget the conflict: this tab is deliberately loading or starting a voyage afresh. */
  clear(): void {
    this.conflictAt = null;
  }
}

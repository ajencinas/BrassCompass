/**
 * Act structure. An act is a self-contained run of rooms with its own opening and closing
 * cinematic; finishing one carries the inventory and flags forward and drops you into the next.
 * The acts and the ending are written in src/content/scripts/acts.adv.
 */

import type { Pt } from "../engine/walkbox";
import type { Cond, Effect } from "../game/types";
import { CONTENT } from "./content";

export interface ActDef {
  n: number;
  /** Shown on the act card. */
  title: string;
  start: { room: string; pos?: Pt };
  /** Opening cinematic. Skipped gracefully if the file is absent. */
  intro?: string;
  /** Cinematic played when the act is completed. */
  outro?: string;
  /** Line spoken on arriving in the act. */
  caption?: string;
  /** Exactly what the player carries when the act starts; earlier tools are stowed. */
  inventory?: string[];
  /** Effects run once when the act starts, after the caption. */
  onStart?: Effect[];
}

/** The closing card after the last act. Each line shows when its conditions hold. */
export interface EndingDef {
  title: string;
  /** Per-ending titles: the first whose conditions hold replaces `title`. */
  titles?: { if: Cond[]; text: string }[];
  lines: { if?: Cond[]; text: string }[];
  /**
   * The painting the closing card rises over: the first whose conditions hold. `focus` is the
   * point of the background to centre on; `music` plays under the card.
   */
  paintings?: { if?: Cond[]; image: string; focus?: Pt; music?: string }[];
}

export const ACTS: Record<number, ActDef> = CONTENT.acts;

export const ENDING: EndingDef = CONTENT.ending;

export const FIRST_ACT = 1;
export const LAST_ACT = Object.keys(ACTS).length;

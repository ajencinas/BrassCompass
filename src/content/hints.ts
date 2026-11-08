/**
 * Tips, compiled from src/content/scripts/tips.adv: one plain line telling the player what to
 * do next, and optionally a nudge to show first. The first entry whose conditions hold is the
 * current tip; src/game/tips.ts decides whether the nudge or the full line is shown.
 */

import type { Cond } from "../game/types";
import { CONTENT } from "./content";

export interface Tip {
  if: Cond[];
  /** The full line: exactly what to do next. */
  text: string;
  /** Shown first, on the first ask: the person, place or idea, short of the answer. */
  nudge?: string;
}

export const TIPS: Tip[] = CONTENT.tips;

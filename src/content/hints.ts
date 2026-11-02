/**
 * Tips, compiled from src/content/scripts/tips.adv: one plain line telling the player what to
 * do next. The first entry whose conditions hold is the current tip.
 */

import type { Cond } from "../game/types";
import { CONTENT } from "./content";

export interface Tip {
  if: Cond[];
  text: string;
}

export const TIPS: Tip[] = CONTENT.tips;

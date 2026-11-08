/**
 * Which tip to show, and how much of it: the tip ladder.
 *
 * The first tip whose conditions hold is the current one (tips.adv lists each act from its last
 * step back to its first). A tip may carry a nudge: a hint that points at the person, place or
 * idea without giving the answer. Asking for a tip (H or the Tip button) shows the current tip's
 * nudge first; asking again while the same tip is current shows its full line, and from then on
 * that tip is always shown in full. Tip mode keeps the tip on screen, which counts as having been
 * asked once: it shows the nudge, and the next ask gives the full line. A tip without a nudge is
 * shown in full straight away.
 *
 * Kept apart from the game so the rules can be tested without a canvas.
 */

import type { Cond } from "./types";

export interface TipRule {
  if: Cond[];
  /** The full line: exactly what to do next. */
  text: string;
  /** Optional first rung: a pointer at the person, place or idea, short of the answer. */
  nudge?: string;
}

/** When no tip holds (content between acts, or a state the tips don't cover). */
export const TIP_FALLBACK = "Look around: hover over things to see what they are, and talk to everyone.";

/** Added after a nudge, so the player knows the answer is one more ask away. */
export const TIP_AGAIN = " (Ask again for the answer.)";

export class TipLadder {
  /** Tips whose nudge has been given: asking again gives the full line. */
  private nudged = new Set<number>();
  /** Tips given in full: they stay full. */
  private full = new Set<number>();

  constructor(private rules: () => readonly TipRule[], private holds: (c: Cond) => boolean) {}

  /** The index of the current tip, or -1. */
  current(): number {
    return this.rules().findIndex((t) => t.if.every((c) => this.holds(c)));
  }

  /** The current tip's full line (what to do next), whatever has been asked. */
  answer(): string {
    const i = this.current();
    return i < 0 ? TIP_FALLBACK : this.rules()[i].text;
  }

  /** What tip mode shows: the nudge until this tip has been asked for in full. Changes nothing. */
  shown(): string {
    const i = this.current();
    if (i < 0) return TIP_FALLBACK;
    const tip = this.rules()[i];
    return tip.nudge && !this.full.has(i) ? tip.nudge + TIP_AGAIN : tip.text;
  }

  /**
   * Asking for a tip: the next rung for the current one. `onScreen` is true in tip mode, where
   * the nudge is already showing, so the ask goes straight to the full line.
   */
  ask(onScreen = false): string {
    const i = this.current();
    if (i < 0) return TIP_FALLBACK;
    const tip = this.rules()[i];
    if (!tip.nudge || this.full.has(i) || this.nudged.has(i) || onScreen) {
      this.full.add(i);
      return tip.text;
    }
    this.nudged.add(i);
    return tip.nudge + TIP_AGAIN;
  }

  /** A new voyage, or a save loaded: every tip starts again from its nudge. */
  reset(): void {
    this.nudged.clear();
    this.full.clear();
  }
}

/**
 * Exit-following transitions. Going through a way out, the view leans a little toward it as the
 * curtain falls; in the next room it starts a touch close and settles back as the curtain lifts,
 * so a door reads as a door and not a cut. The view only ever scales up (k >= 1) about a point,
 * so no edge of the painting shows. Reduced motion: a plain fade.
 */

import { LOGICAL_W, SCENE_H } from "../engine/view";
import type { Pt } from "../engine/walkbox";
import type { ExitSide } from "./connect";

/** How far the view leans toward the way out at full black. */
const LEAN = 0.06;
/** How close the new room starts before it settles. */
const SETTLE = 0.035;

export interface Zoom { k: number; x: number; y: number }

export class Transition {
  /** World point the view leans toward (the door), while the curtain falls. */
  private toward: Pt | null = null;
  /** World point the new room settles about (where Fenn arrives), while it lifts. */
  private from: Pt | null = null;
  /** The side the next painting should be revealed from, following the way out. */
  private entry: ExitSide | null = null;

  /** Going through a way out at `at` (world coordinates). Without one, a plain fade. */
  leave(at: Pt | null): void {
    this.toward = at;
    this.from = null;
    this.entry = null;
  }

  /**
   * The new room is in. It settles about `at` only if we left through a way out, and reveals
   * from `entry` (the opposite of the side the way out was on) when the exit continues in a
   * direction a player can read.
   */
  arrive(at: Pt, entry: ExitSide | null = null): void {
    this.from = this.toward ? at : null;
    this.entry = this.from ? entry : null;
    this.toward = null;
  }

  /** The side the arriving painting should slide in from; null for a plain settle. */
  entrySide(): ExitSide | null {
    return this.entry;
  }

  clear(): void {
    this.toward = this.from = null;
    this.entry = null;
  }

  /**
   * The scene's transform for a curtain at `fade` (0 clear .. 1 black), as a scale `k` about the
   * screen point (x, y); null when there's nothing to do.
   */
  zoom(fade: number, cameraX: number, reduced: boolean): Zoom | null {
    const at = this.toward ?? this.from;
    if (!at) return null;
    if (this.from && fade <= 0.001) {
      // The reveal is over: the directional wipe must not outlive it and wake on the next
      // curtain (Restart, back to the title), which has no side to come from.
      this.from = null;
      this.entry = null;
      return null;
    }
    if (reduced) return null;
    const e = fade * fade * (3 - 2 * fade);
    const k = 1 + (this.toward ? LEAN : SETTLE) * e;
    return {
      k,
      x: Math.max(0, Math.min(LOGICAL_W, at.x - cameraX)),
      y: Math.max(0, Math.min(SCENE_H, at.y)),
    };
  }
}

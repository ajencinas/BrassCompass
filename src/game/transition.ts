/**
 * Exit-following transitions. Going through a way out, the view leans a little toward it as the
 * curtain falls; in the next room it starts a touch close and settles back as the curtain lifts,
 * so a door reads as a door and not a cut. The view only ever scales up (k >= 1) about a point,
 * so no edge of the painting shows. Reduced motion: a plain fade.
 */

import { LOGICAL_W, SCENE_H } from "../engine/view";
import type { Pt } from "../engine/walkbox";

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

  /** Going through a way out at `at` (world coordinates). Without one, a plain fade. */
  leave(at: Pt | null): void {
    this.toward = at;
    this.from = null;
  }

  /** The new room is in. It settles about `at` only if we left through a way out. */
  arrive(at: Pt): void {
    this.from = this.toward ? at : null;
    this.toward = null;
  }

  clear(): void {
    this.toward = this.from = null;
  }

  /**
   * The scene's transform for a curtain at `fade` (0 clear .. 1 black), as a scale `k` about the
   * screen point (x, y); null when there's nothing to do.
   */
  zoom(fade: number, cameraX: number, reduced: boolean): Zoom | null {
    const at = this.toward ?? this.from;
    if (!at) return null;
    if (this.from && fade <= 0.001) {
      this.from = null;
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

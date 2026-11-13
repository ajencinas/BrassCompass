/**
 * Exit-following transitions. Going through a way out, the whole view walks into it as the curtain
 * falls: the scene — painting, people, props, lamps — pushes in on the threshold, so the cut is
 * one continuous camera move rather than a cut to a magnified crop of the background alone. In the
 * next room the view starts a touch close and settles back as the curtain lifts, so a door reads
 * as a door and not a cut. The view only ever scales up (k >= 1) about a point, so the frame
 * shows a sub-window of the camera's own window - and the camera's window is inside the plate
 * (the camera is clamped to the room's width and the plate is blitted at the room's width), so
 * no edge of the painting can ever show. The push is exactly where the passage shot picks the
 * plate up. Reduced motion: a plain fade.
 */

import { LOGICAL_W, SCENE_H } from "../engine/view";
import type { Pt } from "../engine/walkbox";
import type { ExitSide } from "./connect";

/**
 * How far the view pushes toward the way out by the time it is black. It has to be a real move,
 * not a hint: this is the only thing between the player and the cut, and the passage shot starts
 * from where it leaves the painting (see `Connector`).
 */
const LEAN = 0.34;
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

  /**
   * The same transform, without the bookkeeping: a hit test needs to know where the scene is
   * being painted so a click lands on what the player can see, but it must not be the thing
   * that ends the reveal.
   */
  peekZoom(fade: number, cameraX: number, reduced: boolean): Zoom | null {
    const at = this.toward ?? this.from;
    if (!at || reduced) return null;
    const e = fade * fade * (3 - 2 * fade);
    const k = 1 + (this.toward ? LEAN : SETTLE) * e;
    return {
      k,
      x: Math.max(0, Math.min(LOGICAL_W, at.x - cameraX)),
      y: Math.max(0, Math.min(SCENE_H, at.y)),
    };
  }
}

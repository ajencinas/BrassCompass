/**
 * The short passage between two rooms that do not share a painted threshold.
 *
 * It is deliberately a *shot*, not a card: the frame the player was walking into keeps coming at
 * them — the same painting, pushed further in, sliding the way they are travelling, its doorway
 * light receding, fog crossing the gap — and then it is black and the next painting arrives from
 * the opposite side. No words, no title, no progress mark, and no second art style: the passage
 * is made of the room's own plate, so the cut is one continuous camera move through darkness.
 *
 * The whole thing runs on game time for 0.5–0.9 s while the curtain is black, so it feels like
 * walking through the gap rather than waiting behind it.
 *
 * The older version drew a one-point-perspective corridor in flat vector shapes: sharp black
 * walls, perfect lamp circles, straight rails. Beside a painted plate it read as a different
 * game for half a second, which is exactly the seam a passage is supposed to hide.
 */

import { LOGICAL_H, LOGICAL_W, SCENE_H } from "../engine/view";
import type { ExitSide, PassageKind } from "./connect";
import { cropScreenPoint, thresholdCrop, type PassagePlate } from "./fade";

const W = LOGICAL_W;
const H = LOGICAL_H;
const TAU = Math.PI * 2;

type Rgb = readonly [number, number, number];

/** Seconds each passage holds. All inside the 0.5–0.9 s brief. */
const DURATION: Record<PassageKind, number> = {
  steps: 0.60,
  street: 0.66,
  quay: 0.62,
  water: 0.86,
  planks: 0.54,
};

/**
 * How much further the camera travels into the painting during the shot, as a multiple of the
 * room's own frame. It starts where the exit card left the crop (1.34) and only ever grows, so
 * the two halves of the transition are one move.
 */
const PUSH: Record<PassageKind, number> = {
  steps: 0.69,
  street: 0.82,
  quay: 0.92,
  water: 1.16,
  planks: 0.58,
};

interface Look {
  /** Fog drifting through the gap. */
  fog: Rgb;
  /** The light left behind in the doorway. */
  lamp: Rgb;
}

const LOOK: Record<PassageKind, Look> = {
  street: { fog: [150, 176, 198], lamp: [255, 196, 108] },
  steps: { fog: [144, 172, 196], lamp: [255, 188, 100] },
  quay: { fog: [148, 180, 201], lamp: [255, 205, 128] },
  water: { fog: [138, 170, 194], lamp: [255, 198, 120] },
  planks: { fog: [116, 138, 154], lamp: [255, 176, 92] },
};

function rgba(c: Rgb, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function smooth(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Leaves quickly, then eases: the step through the gap is fastest at the start. */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Which way the frame slides while the camera travels: the way the player is going. */
function drift(side: ExitSide, t: number): { dx: number; dy: number } {
  const d = 74 * t;
  switch (side) {
    case "left": return { dx: d, dy: 0 };
    case "right": return { dx: -d, dy: 0 };
    case "above": return { dx: 0, dy: d * 0.7 };
    case "below": return { dx: 0, dy: -d * 0.7 };
  }
}

export class Connector {
  private spec: { kind: PassageKind; side: ExitSide; from: string; to: string } | null = null;
  /** The painting being walked through, graded exactly as it was on screen. */
  private plate: PassagePlate | null = null;
  private elapsed = 0;
  /** Whether the clock has ticked yet: the first tick leaves the shot where the room left it. */
  private started = false;
  private duration = 0.65;

  get active(): boolean {
    return this.spec !== null;
  }

  get kind(): PassageKind | null {
    return this.spec?.kind ?? null;
  }

  begin(
    kind: PassageKind, side: ExitSide, from: string, to: string, plate: PassagePlate | null = null,
  ): void {
    this.spec = { kind, side, from, to };
    this.plate = plate;
    this.elapsed = 0;
    this.started = false;
    this.duration = DURATION[kind];
  }

  /**
   * Advance the shot. Returns true once it has run its full length.
   *
   * The first tick does not move the clock: the shot has to BEGIN on the frame the room was
   * left on - the camera at 1.34, about the doorway - and not a step further in. The curtain
   * is down over it either way, but the shot's first drawn frame should be the continuation
   * of the scene's last one, not a jump past it.
   */
  update(dt: number): boolean {
    if (!this.spec) return true;
    if (!this.started) {
      this.started = true;
      return false;
    }
    this.elapsed += dt;
    return this.elapsed >= this.duration;
  }

  end(): void {
    this.spec = null;
    this.plate = null;
    this.elapsed = 0;
    this.started = false;
  }

  /**
   * The shot is composed for the scene rectangle (the painting's own 1920 × 880) and drawn at
   * 1:1 in logical pixels, so it lands exactly where the plate it is made from was.
   */
  draw(ctx: CanvasRenderingContext2D, reduced: boolean): void {
    if (!this.spec) return;
    const t = clamp01(this.elapsed / this.duration);
    const { kind, side } = this.spec;
    const look = LOOK[kind];
    ctx.save();
    // The whole frame goes black first: the strip below the scene is the verb panel, and a
    // cut hides the panel. Reduced motion gets no travelling shot, but the frame must still be
    // black - the curtain is down, and the room cannot change under a live panel.
    ctx.fillStyle = "#020406";
    ctx.fillRect(0, 0, W, H);
    if (reduced) {
      // Reduced motion gets no travelling shot. The room's own fade is enough.
      ctx.restore();
      return;
    }
    // The passage itself happens in the scene's rectangle: it is the picture's own shape, and
    // the panel below it must stay black, never a stretched piece of painting.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, SCENE_H);
    ctx.clip();
    // The shot is painted in the canvas's own coordinates, exactly where the scene was: a
    // portrait phone's narrower window is a CSS crop of this canvas, so the picture and the
    // scene it replaces stay aligned without any shifting of their own.

    const plate = this.plate;
    if (plate) this.through(ctx, plate, t, side, look, kind);
    else this.dark(ctx, t, look);

    // Fine fog crossing the gap in front of the camera, so the move has air in it.
    for (let i = 0; i < 3; i++) {
      const x = ((i * 0.37 + t * (0.5 + i * 0.12)) % 1) * W;
      const y = SCENE_H * (0.42 + i * 0.13);
      const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.3);
      g.addColorStop(0, rgba(look.fog, 0.05 + 0.03 * (1 - t)));
      g.addColorStop(1, rgba(look.fog, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // The corners go first: the gap closes around the middle of the frame.
    const vig = ctx.createRadialGradient(W * 0.5, SCENE_H * 0.48, SCENE_H * 0.16,
      W * 0.5, SCENE_H * 0.48, W * 0.66);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.7, "rgba(0,0,0,0.2)");
    vig.addColorStop(1, `rgba(0,0,0,${0.55 + 0.3 * t})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Ease in from black and back out to black. The lift is slower than the fall: the player is
    // stepping out of the room's last dark frame, so the shot has to arrive from under it rather
    // than flash back up.
    const cover = 1 - smooth(0.04, 0.36, t) * smooth(0, 0.26, 1 - t);
    if (cover > 0.001) {
      ctx.fillStyle = `rgba(2,4,6,${cover})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    ctx.restore();
  }

  /**
   * The room's own painting, still travelling: the camera keeps pushing into the doorway the
   * scene's own curtain-push left it on, sliding the way the player is going, while the doorway's
   * light falls behind and the frame darkens to black.
   */
  private through(
    ctx: CanvasRenderingContext2D, card: PassagePlate, t: number,
    side: ExitSide, look: Look, kind: PassageKind,
  ): void {
    const e = easeOut(t);
    const zoom = 1.34 + PUSH[kind] * e;
    const { dx, dy } = drift(side, e);
    // The pivot starts where the scene's own lean left it - the doorway on screen - and then
    // slides the way the player is travelling, so the doorway recedes behind them. The crop is
    // built from the camera's own window, so the passage's first frame is exactly the frame
    // the room was left on.
    const pivot = {
      x: Math.max(0, Math.min(W, (card.pivotX ?? 0) + dx)),
      y: Math.max(0, Math.min(SCENE_H, (card.pivotY ?? 0) + dy)),
    };
    const crop = thresholdCrop(card, zoom, pivot);
    // The scene's rectangle only: the strip below it is the verb panel, and the panel is dark
    // during a cut anyway.
    ctx.drawImage(card.image, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);

    // The light we are leaving: a warm bloom on the real threshold, receding as we go.
    const at = cropScreenPoint(crop, card.x + card.w / 2, card.y + card.h / 2);
    const reach = (0.16 + 0.22 * (1 - t)) * W;
    const bloom = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, reach);
    bloom.addColorStop(0, rgba(look.lamp, 0.22 * (1 - 0.55 * t)));
    bloom.addColorStop(0.35, rgba(look.lamp, 0.07 * (1 - 0.6 * t)));
    bloom.addColorStop(1, rgba(look.lamp, 0));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Darkness closing from the side we are leaving, as the doorway gets left behind.
    const away = ctx.createLinearGradient(
      side === "left" ? W : 0, 0, side === "left" ? 0 : W, 0);
    away.addColorStop(0, `rgba(2,4,6,${0.28 + 0.42 * t})`);
    away.addColorStop(1, "rgba(2,4,6,0.05)");
    ctx.fillStyle = away;
    ctx.fillRect(0, 0, W, H);

    // And the whole frame sinking toward black, so the swap happens in the dark.
    ctx.fillStyle = `rgba(2,4,6,${Math.max(0, (t - 0.35) * 0.9)})`;
    ctx.fillRect(0, 0, W, H);
  }

  /** No plate to travel through (art still arriving): soft fog and a lamp, no drawn geometry. */
  private dark(ctx: CanvasRenderingContext2D, t: number, look: Look): void {
    const g = ctx.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, "rgba(7,17,27,1)");
    g.addColorStop(1, "rgba(16,26,34,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const at = { x: W * 0.5, y: SCENE_H * 0.5 };
    const reach = W * (0.24 + 0.1 * (1 - t));
    const bloom = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, reach);
    bloom.addColorStop(0, rgba(look.lamp, 0.2 * (1 - t)));
    bloom.addColorStop(1, rgba(look.lamp, 0));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(at.x, at.y, reach, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(2,4,6,${0.3 + 0.6 * t})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/**
 * The scene curtain: the plain fade, the directional reveal of an arriving room, and the painted
 * threshold card held under the black.
 *
 * All of this used to be the tail of `Game.renderFade`. It is drawing, not game state: every
 * input is a number or a small plain record (`fade`, `reduced`, the exit side, the threshold
 * card). Keeping the geometry in pure helpers (`fadeEase`, `exitCardCrop`, `entryFadeBand`)
 * means the close-up crop and the entry wash can be checked without a browser, while the paint
 * order stays exactly what it was.
 */

import { LOGICAL_W, LOGICAL_H } from "../engine/view";
import type { ExitSide } from "./connect";

/** The painted threshold the player is passing through, held during the curtain. */
export interface ExitCardSource {
  image: CanvasImageSource;
  /** The painting's own pixel size, for clamping the close-up crop. */
  imageW: number;
  imageH: number;
  /** The threshold's own rectangle in world coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smoothstep, the one curve both the curtain and the scene's lean use. */
export function fadeEase(f: number): number {
  return f * f * (3 - 2 * f);
}

/** Where the close-up of a threshold comes from, and the screen rectangle it fills. */
export interface ExitCardCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * The close-up crop of the room painting around a threshold, clamped to the painting, scaled
 * to cover the frame and pushed in a little as the curtain falls.
 */
export function exitCardCrop(card: ExitCardSource, eased: number): ExitCardCrop {
  const zoom = 1.06 + eased * 0.18;
  const sw = Math.max(1, Math.min(card.imageW, card.w * 1.25));
  const sh = Math.max(1, Math.min(card.imageH, card.h * 1.25));
  const sx = Math.max(0, Math.min(card.imageW - sw, card.x + card.w / 2 - sw / 2));
  const sy = Math.max(0, Math.min(card.imageH - sh, card.y + card.h / 2 - sh / 2));
  const scale = Math.max(LOGICAL_W / sw, LOGICAL_H / sh) * zoom;
  const dw = sw * scale;
  const dh = sh * scale;
  return {
    sx, sy, sw, sh,
    dx: LOGICAL_W / 2 - dw / 2,
    dy: LOGICAL_H / 2 - dh / 2,
    dw, dh,
  };
}

/** The moving edge of the arriving-room reveal, as plain numbers. */
export interface EntryFadeBand {
  /** The wash runs left-to-right (or right-to-left); otherwise top-to-bottom. */
  horizontal: boolean;
  /** The black is past the edge (we leave right/below) rather than ahead of it. */
  fromFarEnd: boolean;
  /** Start of the transparent part of the wash, 0..1. */
  a: number;
  /** The soft edge, just past the hard black, 0..1. */
  b: number;
}

/**
 * The arriving room is revealed from the side the way out points at: leave left, enter from the
 * right; go up a stair, come up from below. The black is a soft directional wash rather than a
 * hard wipe, so the painting arrives under a moving edge of darkness.
 */
export function entryFadeBand(eased: number, side: ExitSide): EntryFadeBand {
  const horizontal = side === "left" || side === "right";
  const dim = horizontal ? LOGICAL_W : LOGICAL_H;
  const band = dim * 0.22;
  const fromFarEnd = side === "right" || side === "below";
  const edge = fromFarEnd ? dim * eased : dim * (1 - eased);
  const a = Math.max(0, Math.min(1, (edge - band) / dim));
  const b = Math.max(0.0001, Math.min(1, edge / dim));
  return { horizontal, fromFarEnd, a, b };
}

/** The arriving room's reveal: black from one side, soft-edged and directional. */
export function drawEntryFade(ctx: CanvasRenderingContext2D, eased: number, side: ExitSide): void {
  if (eased >= 0.999) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    return;
  }
  const { horizontal, fromFarEnd, a, b } = entryFadeBand(eased, side);
  const g = horizontal
    ? ctx.createLinearGradient(0, 0, LOGICAL_W, 0)
    : ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  if (fromFarEnd) {
    g.addColorStop(0, `rgba(0,0,0,${eased})`);
    g.addColorStop(a, `rgba(0,0,0,${eased})`);
    g.addColorStop(Math.min(1, b + 0.0001), "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(a, "rgba(0,0,0,0)");
    g.addColorStop(Math.min(1, b + 0.0001), `rgba(0,0,0,${eased})`);
    g.addColorStop(1, `rgba(0,0,0,${eased})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

/**
 * Hold on the painted door/hatch/stair being used while the curtain falls. It is the
 * painted-threshold continuity cue: the cut happens through something you can see, not between
 * two unrelated paintings. The card appears after the first darkening.
 */
export function drawExitCard(
  ctx: CanvasRenderingContext2D,
  card: ExitCardSource,
  f: number,
  eased: number,
): void {
  const crop = exitCardCrop(card, eased);
  const a = Math.min(1, (f - 0.28) / 0.22);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#020406";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.drawImage(card.image, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
  const warm = ctx.createRadialGradient(LOGICAL_W / 2, LOGICAL_H * 0.54, 10,
    LOGICAL_W / 2, LOGICAL_H * 0.54, LOGICAL_W * 0.46);
  warm.addColorStop(0, "rgba(255,190,105,0.12)");
  warm.addColorStop(0.55, "rgba(255,155,70,0.04)");
  warm.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, eased - 0.25) * 0.8})`;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.restore();
}

/** Everything the curtain needs from the game at paint time. */
export interface SceneFade {
  /** 0 clear .. 1 black. */
  fade: number;
  reduced: boolean;
  /** The side the arriving painting is revealed from; null for a plain fade. */
  entry: ExitSide | null;
  /** The threshold being crossed, or null. */
  card: ExitCardSource | null;
}

/**
 * Paint the curtain. The passage connector is drawn by its owner before this is called (it
 * replaces the curtain entirely while it runs); everything else is here.
 */
export function drawFade(ctx: CanvasRenderingContext2D, state: SceneFade): void {
  if (state.fade <= 0.001) return;
  const f = state.fade;
  const eased = fadeEase(f);
  if (state.entry && !state.reduced) drawEntryFade(ctx, eased, state.entry);
  else {
    ctx.fillStyle = `rgba(0,0,0,${eased})`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
  if (state.card && f > 0.28 && !state.entry) drawExitCard(ctx, state.card, f, eased);
}

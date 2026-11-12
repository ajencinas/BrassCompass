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
 * Where the middle of the visible scene is, in logical pixels. The desktop frame's middle is
 * (960, 540); a phone's scene canvas is 880 high and, held upright, shows only a slice of the
 * width, so the exit card and the loading cue are centred on what the player can see.
 */
export interface FadeCenter { x: number; y: number }
const DEFAULT_CENTER: FadeCenter = { x: LOGICAL_W / 2, y: LOGICAL_H / 2 };

/**
 * The close-up crop of the room painting around a threshold, clamped to the painting, scaled
 * to cover the frame and pushed in a little as the curtain falls.
 */
export function exitCardCrop(
  card: ExitCardSource, eased: number, cx = LOGICAL_W / 2, cy = LOGICAL_H / 2,
): ExitCardCrop {
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
    dx: cx - dw / 2,
    dy: cy - dh / 2,
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
  center: FadeCenter = DEFAULT_CENTER,
): void {
  const crop = exitCardCrop(card, eased, center.x, center.y);
  const a = Math.min(1, (f - 0.28) / 0.22);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#020406";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.drawImage(card.image, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
  const warm = ctx.createRadialGradient(center.x, center.y + LOGICAL_H * 0.04, 10,
    center.x, center.y + LOGICAL_H * 0.04, LOGICAL_W * 0.46);
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

/** Seconds the curtain waits on a room's art before a small "loading" cue appears. */
export const LOADING_CUE_AFTER = 1.5;
/**
 * Seconds the curtain will wait on a room's art, at most. A slow connection should be waited
 * for (a big plate on 3G takes many seconds), but not for ever: after this the room is shown
 * on the painted fallback plate and the real art swaps in if it arrives.
 */
export const ROOM_WAIT_CAP = 25;

/** The cue's opacity after `waited` seconds of waiting: 0 until it is due, then in over 0.5 s. */
export function loadingCueAlpha(waited: number): number {
  return Math.max(0, Math.min(1, (waited - LOADING_CUE_AFTER) / 0.5)) * 0.75;
}

/**
 * A small ring of dots and the word "Loading" at the middle of the black, once the wait has
 * run past `LOADING_CUE_AFTER`. Under reduced motion the ring holds still and only the dots'
 * brightness steps round, so it never spins.
 */
export function drawLoadingCue(
  ctx: CanvasRenderingContext2D, waited: number, reduced: boolean, center: FadeCenter = DEFAULT_CENTER,
): void {
  const alpha = loadingCueAlpha(waited);
  if (alpha <= 0) return;
  const cx = center.x, cy = center.y + 6, n = 8, r = 18;
  const head = Math.floor(waited * 8) % n;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#d8c9a3";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const age = reduced ? 0 : (head - i + n) % n;
    ctx.globalAlpha = alpha * (reduced ? 0.6 : Math.max(0.18, 1 - age / n));
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy - 30 + Math.sin(a) * r, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.font = "22px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Loading", cx, cy + 12);
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
  /** Seconds the curtain has been held on a room's art still arriving (0 when it is not). */
  waited?: number;
  /** The middle of the visible scene (see FadeCenter); the desktop frame's middle if omitted. */
  center?: FadeCenter;
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
  const center = state.center ?? DEFAULT_CENTER;
  if (state.card && f > 0.28 && !state.entry) drawExitCard(ctx, state.card, f, eased, center);
  if (state.waited && f > 0.99) drawLoadingCue(ctx, state.waited, state.reduced, center);
}

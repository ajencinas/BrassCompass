/**
 * The scene curtain: the plain fade, the directional reveal of an arriving room, and the geometry
 * the passage shot uses to travel through the room's own painting.
 *
 * All of this used to be the tail of `Game.renderFade`. It is drawing, not game state: every
 * input is a number or a small plain record (`fade`, `reduced`, the exit side, the threshold
 * shot). Keeping the geometry in pure helpers (`fadeEase`, `thresholdCrop`, `entryFadeBand`)
 * means the close-up crop and the entry wash can be checked without a browser, while the paint
 * order stays exactly what it was.
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H } from "../engine/view";
import type { Pt } from "../engine/walkbox";
import type { ExitSide } from "./connect";

/**
 * The room's own painting, and the threshold in it the player is walking into. The passage shot
 * travels through this plate: the frame the player was looking at, pushed in toward the door, so
 * the gap between two rooms continues a camera move instead of cutting to unrelated art.
 */
export interface PassagePlate {
  image: CanvasImageSource;
  /** The painting's own pixel size, for clamping the crop. */
  imageW: number;
  imageH: number;
  /** The threshold's own rectangle in painting pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** How wide a slice of the painting the screen was showing (the logical width). */
  viewW?: number;
  /** How tall a slice of the painting the screen was showing (the scene height). */
  viewH?: number;
  /** The painting's left edge the camera was showing. */
  viewX?: number;
  /** Where the doorway sat on screen when the curtain fell (the lean's pivot). */
  pivotX?: number;
  pivotY?: number;
  /**
   * How many world pixels one painting pixel covers. A plate is normally the room's own width
   * (so this is 1), but a room whose art failed to load falls back to a smaller painting
   * stretched across the room: the crop has to follow that stretch, or it samples the wrong
   * part of the picture.
   */
  scaleX?: number;
  scaleY?: number;
}

/** Smoothstep, the one curve both the curtain and the scene's lean use. */
export function fadeEase(f: number): number {
  return f * f * (3 - 2 * f);
}

/** Where the crop of the painting comes from, and the screen rectangle it fills. */
export interface PassageCrop {
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
 * The crop of the painting a camera at `zoom`, pivoting on `pivot`, shows in the scene's own
 * rectangle. This is the same arithmetic the scene's lean uses, so the passage's first frame IS
 * the frame the room was left on: the doorway stays where the curtain found it, and the room
 * does not jump as the picture takes over.
 *
 * Because the source window is always a sub-window of the camera's own window, and the camera's
 * window is always inside the plate, the crop can never sample past the painting: there is
 * nothing to clamp, and nothing that can go black at the edge.
 */
export function thresholdCrop(card: PassagePlate, zoom: number, pivot: Pt): PassageCrop {
  const k = Math.max(1, zoom);
  const viewW = card.viewW ?? LOGICAL_W;
  const viewH = card.viewH ?? SCENE_H;
  // The pivot stays put; the window's edges pull in by 1/k. The window is measured in world
  // pixels (that is what the camera and the pivot are) and then converted into the painting's
  // own pixels, which are wider or narrower when the art is stretched across the room.
  const sx = ((card.viewX ?? 0) + pivot.x - pivot.x / k) / (card.scaleX ?? 1);
  const sy = (pivot.y - pivot.y / k) / (card.scaleY ?? 1);
  const sw = viewW / k / (card.scaleX ?? 1);
  const sh = viewH / k / (card.scaleY ?? 1);
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: viewW, dh: viewH };
}

/**
 * Where a painting point lands on screen under a crop, in logical pixels. Used to keep the warm
 * light of the doorway on the doorway as the camera pushes in.
 */
export function cropScreenPoint(crop: PassageCrop, px: number, py: number): { x: number; y: number } {
  const k = crop.sw > 0 ? crop.dw / crop.sw : 1;
  return { x: crop.dx + (px - crop.sx) * k, y: crop.dy + (py - crop.sy) * k };
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
  // A vertical reveal runs over the SCENE's height, not the whole frame: the strip below it is
  // the verb panel, and a stair must not bring the panel in before the room.
  const dim = horizontal ? LOGICAL_W : SCENE_H;
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
    : ctx.createLinearGradient(0, 0, 0, SCENE_H);
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
  // A vertical reveal washes the scene only: the verb panel below it stays black until the
  // room has arrived, so a stair never brings the buttons in before the staircase.
  ctx.fillRect(0, 0, LOGICAL_W, horizontal ? LOGICAL_H : SCENE_H);
  if (!horizontal) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, SCENE_H, LOGICAL_W, LOGICAL_H - SCENE_H);
  }
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
  if (state.waited && f > 0.99) drawLoadingCue(ctx, state.waited, state.reduced, center);
}

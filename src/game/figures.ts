/**
 * Drawing figures: one cell of a sprite sheet, standing on a floor point.
 *
 * A generated sheet is not reliably baseline-aligned, so each cell's opaque extents are measured
 * (see `Assets.frameBounds`) and the art is scaled by its real content rather than by the canvas
 * it arrived on. The torso — not the bounding box — is the horizontal anchor, which stops a
 * character swaying as limbs or a bag swing between frames.
 */

import type { Assets } from "../engine/assets";

export interface FigureOptions {
  frames?: number;
  frame?: number;
  /** Fraction of a whole figure the art contains, measured from the top. */
  visible?: number;
  flip?: boolean;
  /** A CSS filter, from the room or the sprite. */
  grade?: string;
  anchor?: "torso" | "box";
}

/** Draw one cell of `key`, `height` pixels tall, with its feet at (x, y). */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  key: string,
  x: number,
  y: number,
  height: number,
  opts: FigureOptions = {}
): void {
  const img = assets.img(key);
  const b = img && assets.frameBounds(key, opts.frames ?? 1)?.[opts.frame ?? 0];
  if (!img || !b) return;

  const k = (height * (opts.visible ?? 1)) / (b.bottom - b.top);
  const anchor = opts.anchor === "box" ? (b.left + b.right) / 2 : b.torso;

  ctx.save();
  ctx.translate(x, 0);
  ctx.filter = opts.grade ?? "none";
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(
    img,
    b.left, b.top, b.right - b.left, b.bottom - b.top,
    (b.left - anchor) * k, y - height, (b.right - b.left) * k, (b.bottom - b.top) * k
  );
  ctx.restore();
}

/** The soft contact shadow under a figure that reaches the floor. */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  alpha = 0.34
): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y - 2, w / 2, Math.max(3, w * 0.13), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a sprite scaled to a person's height at that floor row. `size` is relative to a standing
 * adult, so 1 is an adult and 0.72 is a child.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  key: string,
  x: number,
  y: number,
  height: number,
  opts: { visible?: number; figure?: boolean; flip?: boolean; grade?: string } = {}
): void {
  const b = assets.frameBounds(key)?.[0];
  if (!b) return;
  const visible = opts.visible ?? 1;
  // Only art that reaches the floor casts a contact shadow.
  if (visible >= 1) {
    drawShadow(ctx, x, y, height * ((b.right - b.left) / (b.bottom - b.top)) * 0.8);
  }
  drawFigure(ctx, assets, key, x, y, height, {
    visible,
    flip: opts.flip,
    grade: opts.grade,
    anchor: opts.figure ? "torso" : "box",
  });
}

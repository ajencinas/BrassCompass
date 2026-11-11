/**
 * Cues — the small canvas marks the game draws instead of words.
 *
 * The top bar is icon-only: one simple line glyph per button, no labels on the glass. The
 * scene's own cues are light and motion (see game.ts): a warm threshold pool, a breathing
 * rim, a chevron. Nothing here draws text.
 */

export type BarGlyph = "eye" | "scroll" | "candle" | "chart" | "compass" | "pause";

/** A rounded-rectangle path, for the quiet icon plates and their focus rings. */
export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}

/**
 * One glyph, centred on (cx, cy) and drawn inside a `size`-pixel box. Simple strokes, no fill
 * except where a little solid ink helps the shape read at 24 px: an eye, a rolled scroll, a
 * candle, a chart, a compass and a pause. Callers pass the colour and an alpha for the idle
 * fade; the glyph itself never carries a word.
 */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: BarGlyph,
  cx: number,
  cy: number,
  size: number,
  color: string,
  alpha = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 24, size / 24);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (glyph) {
    case "eye": {
      // Almond outline, iris, pupil.
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.bezierCurveTo(-5.5, -6.4, 5.5, -6.4, 10, 0);
      ctx.bezierCurveTo(5.5, 6.4, -5.5, 6.4, -10, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 1.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "scroll": {
      // A curled sheet seen edge-on: two rolled ends and a quietly open middle.
      ctx.beginPath();
      ctx.moveTo(-7.5, -7);
      ctx.bezierCurveTo(-10, -7, -10, -3.5, -7.5, -3.5);
      ctx.lineTo(7.5, -3.5);
      ctx.bezierCurveTo(10, -3.5, 10, 0, 7.5, 0);
      ctx.lineTo(-7.5, 0);
      ctx.bezierCurveTo(-10, 0, -10, 3.5, -7.5, 3.5);
      ctx.lineTo(7.5, 3.5);
      ctx.bezierCurveTo(10, 3.5, 10, 7, 7.5, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5.5, -1.8);
      ctx.lineTo(5.5, -1.8);
      ctx.moveTo(-5.5, 1.8);
      ctx.lineTo(5.5, 1.8);
      ctx.stroke();
      break;
    }
    case "candle": {
      // Saucer, wax, wick, flame.
      ctx.beginPath();
      ctx.moveTo(-8, 9.5);
      ctx.lineTo(8, 9.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4.5, 1);
      ctx.lineTo(-4.5, 8);
      ctx.lineTo(4.5, 8);
      ctx.lineTo(4.5, 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(0, -1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -9.5);
      ctx.bezierCurveTo(4.2, -6.2, 3.3, -1.8, 0, -1.8);
      ctx.bezierCurveTo(-3.3, -1.8, -4.2, -6.2, 0, -9.5);
      ctx.stroke();
      break;
    }
    case "chart": {
      // A sheet with a course on it: line crossed and two fixes.
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.lineTo(5.5, -9);
      ctx.quadraticCurveTo(7, -9, 7, -7.5);
      ctx.lineTo(7, 7.5);
      ctx.quadraticCurveTo(7, 9, 5.5, 9);
      ctx.lineTo(-5.5, 9);
      ctx.quadraticCurveTo(-7, 9, -7, 7.5);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, 4.5);
      ctx.lineTo(-1.5, 0.5);
      ctx.lineTo(1.5, 2.5);
      ctx.lineTo(4.5, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-4, 4.5, 1.1, 0, Math.PI * 2);
      ctx.arc(4.5, -4, 1.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "compass": {
      // Rose ring, north tick, needle pointing north-east.
      ctx.beginPath();
      ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -10.2);
      ctx.lineTo(0, -8.2);
      ctx.moveTo(0, 8.2);
      ctx.lineTo(0, 10.2);
      ctx.moveTo(-10.2, 0);
      ctx.lineTo(-8.2, 0);
      ctx.moveTo(8.2, 0);
      ctx.lineTo(10.2, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -6.4);
      ctx.lineTo(2.3, 0.4);
      ctx.lineTo(0, 2.2);
      ctx.lineTo(-2.3, 0.4);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 1.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pause": {
      ctx.beginPath();
      roundRectPath(ctx, -7, -8, 5, 16, 2);
      ctx.fill();
      ctx.beginPath();
      roundRectPath(ctx, 2, -8, 5, 16, 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

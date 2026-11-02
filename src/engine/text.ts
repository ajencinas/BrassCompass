/** Text rendering helpers — wrapping, outlines, typewriter reveal. */

export interface TextStyle {
  size: number;
  family?: string;
  weight?: string;
  color: string;
  align?: CanvasTextAlign;
  shadow?: boolean;
  maxWidth?: number;
  lineHeight?: number;
}

const DEFAULT_FAMILY = 'Georgia, "Times New Roman", serif';

export function fontOf(s: TextStyle): string {
  return `${s.weight ?? "normal"} ${s.size}px ${s.family ?? DEFAULT_FAMILY}`;
}

export function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  style: TextStyle
): string[] {
  ctx.font = fontOf(style);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  lines.push(line);
  return lines;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle
): void {
  ctx.save();
  ctx.font = fontOf(style);
  ctx.textAlign = style.align ?? "left";
  ctx.textBaseline = "top";
  if (style.shadow !== false) {
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = style.color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw wrapped lines; returns the total height used. */
export function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle
): number {
  const lh = style.lineHeight ?? Math.round(style.size * 1.35);
  const lines = wrap(ctx, text, style.maxWidth ?? 800, style);
  lines.forEach((ln, i) => drawText(ctx, ln, x, y + i * lh, style));
  return lines.length * lh;
}

/**
 * Reveal `full` up to `chars` characters, but never cut a word in half —
 * jumps to the end of the current word so text doesn't jitter.
 */
export function typewriterSlice(full: string, chars: number): string {
  if (chars >= full.length) return full;
  let cut = Math.max(0, Math.floor(chars));
  while (cut < full.length && full[cut] !== " ") cut++;
  return full.slice(0, cut);
}

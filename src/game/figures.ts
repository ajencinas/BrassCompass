/**
 * Drawing figures: one cell of a sprite sheet, standing on a floor point.
 *
 * A generated sheet is not reliably baseline-aligned, so each cell's opaque extents are measured
 * (see `Assets.frameBounds`) and the art is scaled by its real content rather than by the canvas
 * it arrived on. The torso — not the bounding box — is the horizontal anchor, which stops a
 * character swaying as limbs or a bag swing between frames.
 */

import type { Assets, Bounds } from "../engine/assets";

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
  const frame = opts.frame ?? 0;
  const b = img && assets.frameBounds(key, opts.frames ?? 1)?.[frame];
  if (!img || !b) return;

  const k = (height * (opts.visible ?? 1)) / (b.bottom - b.top);
  const anchor = opts.anchor === "box" ? (b.left + b.right) / 2 : b.torso;
  const dw = (b.right - b.left) * k, dh = (b.bottom - b.top) * k;

  // The cell, already graded and scaled close to the size it lands on screen: one cheap blit
  // a frame instead of a filtered, heavily downscaled draw of the whole sheet.
  const t = ctx.getTransform();
  const deviceH = dh * Math.hypot(t.c, t.d);
  const baked = deviceH > 0 ? bake(img, key, opts.frames ?? 1, frame, b, opts.grade ?? "none", deviceH) : null;

  ctx.save();
  ctx.translate(x, 0);
  if (opts.flip) ctx.scale(-1, 1);
  if (baked) {
    ctx.drawImage(baked, (b.left - anchor) * k, y - height, dw, dh);
  } else {
    ctx.filter = opts.grade ?? "none";
    ctx.drawImage(img, b.left, b.top, b.right - b.left, b.bottom - b.top, (b.left - anchor) * k, y - height, dw, dh);
  }
  ctx.restore();
}

// ------------------------------------------------------------ baked cells

/**
 * Baked cells, least recently used first. Heights are bucketed in steps of ~9% (always rounded
 * up, so a bake is only ever drawn smaller), which keeps a breathing or walking figure on one or
 * two bakes rather than a new one every frame.
 */
const bakes = new Map<string, HTMLCanvasElement>();
let bakedPixels = 0;
/** ~32 MB of RGBA: a room's cast plus the player's walk cycles at two or three depths. */
const BAKE_BUDGET = 8_000_000;
const BUCKETS_PER_DOUBLING = 8;

function bake(
  img: HTMLImageElement,
  key: string,
  frames: number,
  frame: number,
  b: Bounds,
  grade: string,
  deviceH: number
): HTMLCanvasElement | null {
  const srcW = b.right - b.left, srcH = b.bottom - b.top;
  const step = Math.ceil(Math.log2(deviceH) * BUCKETS_PER_DOUBLING);
  // Never bake larger than the source: past that there's no detail left to keep.
  const h = Math.min(srcH, Math.ceil(2 ** (step / BUCKETS_PER_DOUBLING)));
  const id = `${key}|${frames}|${frame}|${grade}|${h}`;
  const hit = bakes.get(id);
  if (hit) {
    bakes.delete(id);
    bakes.set(id, hit);
    return hit;
  }

  const w = Math.max(1, Math.round((srcW * h) / srcH));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = "high";
  const css = grade !== "none" && grade !== "" ? grade : null;
  if (css && filterSupported()) cx.filter = css;
  cx.drawImage(img, b.left, b.top, srcW, srcH, 0, 0, w, h);
  if (css && !filterSupported()) applyGradeByHand(cx, w, h, css);

  bakes.set(id, c);
  bakedPixels += w * h;
  for (const [old, oc] of bakes) {
    if (bakedPixels <= BAKE_BUDGET || old === id) break;
    bakes.delete(old);
    bakedPixels -= oc.width * oc.height;
    oc.width = oc.height = 0;   // hand the memory back now (Safari is slow to)
  }
  return c;
}

let filterOk: boolean | undefined;
/** Whether canvas `filter` works here. Safari before 18 accepts the property and ignores it. */
function filterSupported(): boolean {
  if (filterOk !== undefined) return filterOk;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const cx = c.getContext("2d", { willReadFrequently: true })!;
    cx.filter = "brightness(0)";
    cx.fillStyle = "#fff";
    cx.fillRect(0, 0, 1, 1);
    filterOk = cx.getImageData(0, 0, 1, 1).data[0] < 128;
  } catch {
    filterOk = false;
  }
  return filterOk;
}

/**
 * The colour filters rooms use (brightness, contrast, saturate, sepia, grayscale, hue-rotate,
 * invert, opacity), applied to pixels for browsers whose canvas ignores `filter`. Done once per
 * bake, so the cost doesn't matter. Each function is the Filter Effects spec's matrix.
 */
function applyGradeByHand(cx: CanvasRenderingContext2D, w: number, h: number, css: string): void {
  type Step = (p: number[]) => number[];
  const steps: Step[] = [];
  const re = /([a-z-]+)\(\s*(-?[\d.]+)(%|deg|rad|turn)?\s*\)/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const fn = m[1];
    let v = Number(m[2]);
    if (m[3] === "%") v /= 100;
    const mat = (a: number[]): Step => ([r, g, bl, al]) => [
      a[0] * r + a[1] * g + a[2] * bl, a[3] * r + a[4] * g + a[5] * bl, a[6] * r + a[7] * g + a[8] * bl, al,
    ];
    switch (fn) {
      case "brightness": steps.push(([r, g, bl, al]) => [r * v, g * v, bl * v, al]); break;
      case "contrast": steps.push(([r, g, bl, al]) => [(r - 0.5) * v + 0.5, (g - 0.5) * v + 0.5, (bl - 0.5) * v + 0.5, al]); break;
      case "opacity": steps.push(([r, g, bl, al]) => [r, g, bl, al * Math.min(1, v)]); break;
      case "invert": { const t = Math.min(1, v); steps.push(([r, g, bl, al]) => [r + (1 - 2 * r) * t, g + (1 - 2 * g) * t, bl + (1 - 2 * bl) * t, al]); break; }
      case "saturate": {
        const s = v;
        steps.push(mat([
          0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
          0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
          0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
        ]));
        break;
      }
      case "grayscale": {
        const s = 1 - Math.min(1, v);
        steps.push(mat([
          0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s,
          0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s,
          0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s,
        ]));
        break;
      }
      case "sepia": {
        const s = 1 - Math.min(1, v);
        steps.push(mat([
          0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s,
          0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s,
          0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s,
        ]));
        break;
      }
      case "hue-rotate": {
        const deg = m[3] === "rad" ? (v * 180) / Math.PI : m[3] === "turn" ? v * 360 : v;
        const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
        steps.push(mat([
          0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
          0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
          0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
        ]));
        break;
      }
    }
  }
  if (!steps.length) return;
  const clamp = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
  try {
    const im = cx.getImageData(0, 0, w, h);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      let p = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, d[i + 3] / 255];
      for (const s of steps) p = s(p).map(clamp);
      d[i] = p[0] * 255; d[i + 1] = p[1] * 255; d[i + 2] = p[2] * 255; d[i + 3] = p[3] * 255;
    }
    cx.putImageData(im, 0, 0);
  } catch { /* leave it ungraded rather than fail the draw */ }
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

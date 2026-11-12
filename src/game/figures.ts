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
  /** Lean in radians, pivoting on the feet: a speaker leaning into a line (+ is toward the right). */
  lean?: number;
  /** Height multiplier about the feet, width compensating (1 = none): the lift of a word. */
  squash?: number;
  /**
   * A soft halo cast from the figure's own silhouette, drawn behind it: tint and blur come from
   * the room's light (see paint.ts). The alpha silhouette is baked and blurred once per pose,
   * size and tint, then blitted — no per-frame shadow or filter.
   */
  wrap?: { colour: string; blur: number; rim?: Rim };
}

/**
 * Light that reaches the figure's surface, not just the air behind it: a tinted wash over the
 * lit side of the coat. `side` is the screen side the lamp is on (-1 left, 1 right, 0 overhead).
 */
export interface Rim { rgb: string; alpha: number; side: -1 | 0 | 1 }

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
  const anchor = opts.anchor === "box" ? (b.left + b.right) / 2 : stableTorso(key, opts.frames ?? 1, frame, img.width, b.torso);
  const dw = (b.right - b.left) * k, dh = (b.bottom - b.top) * k;

  // The cell, already graded and scaled close to the size it lands on screen: one cheap blit
  // a frame instead of a filtered, heavily downscaled draw of the whole sheet.
  const t = ctx.getTransform();
  const deviceH = dh * Math.hypot(t.c, t.d);
  const baked = deviceH > 0 ? bake(img, key, opts.frames ?? 1, frame, b, opts.grade ?? "none", deviceH) : null;
  const glow = opts.wrap ? glowFor(img, key, opts.frames ?? 1, frame, b, dw, dh, opts.wrap) : null;

  ctx.save();
  // Feet are the pivot: leaning and squashing never lift them off the floor.
  ctx.translate(x, y);
  if (opts.lean) ctx.rotate(opts.lean);
  const squash = opts.squash ?? 1;
  if (squash !== 1) ctx.scale(1 / Math.sqrt(squash), squash);
  if (opts.flip) ctx.scale(-1, 1);
  if (glow) {
    // The halo is baked at the same user-space size as the silhouette, so a size bucket within
    // ~9% only needs a scale. Lifted off the boots: light comes from above the figure.
    const q = dw / glow.dw;
    const offsetY = -opts.wrap!.blur * 0.55;
    const box = q / GLOW_SCALE;
    // The halo is already blurred; bilinear is plenty, and high-quality upscaling of a big
    // translucent image is a real per-frame cost.
    ctx.save();
    ctx.imageSmoothingQuality = "low";
    ctx.drawImage(glow.canvas, (b.left - anchor) * k - glow.pad * q, -height - glow.pad * q + offsetY, glow.canvas.width * box, glow.canvas.height * box);
    ctx.restore();
  }
  if (baked) {
    // Lit side: art space is unflipped, so a mirrored figure takes the lamp on the other edge.
    const lit = opts.wrap?.rim ? rimFor(baked, opts.wrap.rim, opts.flip ?? false) : null;
    ctx.drawImage(lit ?? baked, (b.left - anchor) * k, -height, dw, dh);
  } else {
    ctx.filter = splitGrade(opts.grade).filter || "none";
    ctx.drawImage(img, b.left, b.top, b.right - b.left, b.bottom - b.top, (b.left - anchor) * k, -height, dw, dh);
  }
  ctx.restore();
}

/**
 * Where the chest sits in each cell of the two walk strips, as a fraction of the cell's width,
 * measured over the top third of the figure only. The generic torso (15-45% down) takes in the
 * satchel and the swinging arm, and on frame 5 of the side strip it jumps 70 px sideways, so the
 * walking figure swayed with it. Cells not listed fall back to the measured torso.
 */
const CHEST: Record<string, readonly number[]> = {
  // Measured on the r2 strips (elias_walk_v2_painted_r2.png, elias_walk_vertical_painted_r2.png).
  // The strips these replaced measured: char_walk_v2 [0.4561, 0.4551, 0.4561, 0.4867, 0.4633, 0.4694],
  // char_walk_vertical [0.5217, 0.4959, 0.5027, 0.4878, 0.4905, 0.4932].
  char_walk_v2: [0.538, 0.4399, 0.4198, 0.4852, 0.4494, 0.4462],
  char_walk_vertical: [0.4845, 0.4858, 0.5052, 0.5142, 0.5077, 0.509],
};

function stableTorso(key: string, frames: number, frame: number, imgW: number, measured: number): number {
  const chest = CHEST[key];
  if (!chest || chest.length !== frames || frame >= chest.length) return measured;
  const cell = imgW / frames;
  return (frame + chest[frame]) * cell;
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
  const split = splitGrade(grade);
  const css = split.filter || null;
  if (css && filterSupported()) cx.filter = css;
  cx.drawImage(img, b.left, b.top, srcW, srcH, 0, 0, w, h);
  if (css && !filterSupported()) applyGradeByHand(cx, w, h, css);
  if (split.tint) {
    // The room's colour over the cloth only (never the empty cell): the cast takes the light it stands in.
    cx.filter = "none";
    cx.globalCompositeOperation = "source-atop";
    cx.fillStyle = split.tint;
    cx.fillRect(0, 0, w, h);
    cx.globalCompositeOperation = "source-over";
  }

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

// ------------------------------------------------------------ baked rim light

/**
 * A lit copy of one baked cell, per (colour, strength, side). Looked up by the baked canvas itself
 * (a weak key: when a bake is evicted its rims go with it) and by one small integer, so asking
 * for it every frame builds no string and reorders nothing.
 */
interface RimEntry { canvas: HTMLCanvasElement; pixels: number; stamp: number; owner: Map<number, RimEntry>; key: number }
const rimsByBase = new WeakMap<HTMLCanvasElement, Map<number, RimEntry>>();
const rimEntries = new Set<RimEntry>();
let rimPixels = 0;
let rimTick = 0;
/**
 * ~24 MB of RGBA. A walk cycle crossing a lamp's pool takes a few tint and side variants of each
 * of its six poses, and a room's cast stands in its own: 2 MP rebuilt those canvases every few steps.
 */
const RIM_BUDGET = 6_000_000;
/** The lamp colours in use, numbered: "255,178,96" becomes 0, 1, 2... */
const rimColours = new Map<string, number>();

/**
 * A copy of a baked cell with the lamp's colour washed over the side that faces it, only where
 * there is cloth (source-atop), fading out by the middle of the body. Made once per pose, size
 * and quantised tint, then blitted like the plain cell: no per-frame work.
 */
function rimFor(base: HTMLCanvasElement, rim: Rim, flip: boolean): HTMLCanvasElement | null {
  const w = base.width, h = base.height;
  if (w <= 0 || h <= 0) return null;
  const side = rim.side === 0 ? 0 : flip ? -rim.side : rim.side;
  let colour = rimColours.get(rim.rgb);
  if (colour === undefined) { colour = rimColours.size; rimColours.set(rim.rgb, colour); }
  // alpha is in twentieths (0.05 steps), side is -1, 0 or 1.
  const key = (colour * 32 + Math.round(rim.alpha * 20)) * 3 + side + 1;
  let owned = rimsByBase.get(base);
  if (!owned) { owned = new Map(); rimsByBase.set(base, owned); }
  const hit = owned.get(key);
  if (hit && hit.canvas.width === w) {
    hit.stamp = ++rimTick;
    return hit.canvas;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.drawImage(base, 0, 0);
  cx.globalCompositeOperation = "source-atop";
  const g = side === 0 ? cx.createLinearGradient(0, 0, 0, h * 0.55)
    : cx.createLinearGradient(side > 0 ? w : 0, 0, side > 0 ? w * 0.25 : w * 0.75, 0);
  g.addColorStop(0, `rgba(${rim.rgb},${rim.alpha})`);
  g.addColorStop(1, `rgba(${rim.rgb},0)`);
  cx.fillStyle = g;
  cx.fillRect(0, 0, w, h);
  if (hit) { rimEntries.delete(hit); rimPixels -= hit.pixels; }
  const entry: RimEntry = { canvas: c, pixels: w * h, stamp: ++rimTick, owner: owned, key };
  owned.set(key, entry);
  rimEntries.add(entry);
  rimPixels += entry.pixels;
  // Over budget (rare): drop the least recently drawn until it fits again.
  while (rimPixels > RIM_BUDGET && rimEntries.size > 1) {
    let oldest: RimEntry | null = null;
    for (const e of rimEntries) if (e !== entry && (!oldest || e.stamp < oldest.stamp)) oldest = e;
    if (!oldest) break;
    rimEntries.delete(oldest);
    oldest.owner.delete(oldest.key);
    rimPixels -= oldest.pixels;
    oldest.canvas.width = oldest.canvas.height = 0;
  }
  return c;
}

// ------------------------------------------------------------ baked halos

interface GlowBake {
  canvas: HTMLCanvasElement;
  /** Transparent border around the silhouette, in user pixels. */
  pad: number;
  /** The silhouette size this bake was made for, so a nearby bucket can be scaled onto it. */
  dw: number;
  dh: number;
}

/**
 * A tinted, blurred silhouette for a figure, baked once per pose/size/tint. It is drawn behind
 * the figure as a plain image every frame, which is far cheaper than a per-frame canvas shadow
 * or filter (the shadow alone cost ~117 ms a frame for a tavern cast in the headless reference).
 */
const glows = new Map<string, GlowBake>();
let glowPixels = 0;
/** ~12 MB of RGBA: a room's cast at a couple of depths, plus the player's walk cycle. */
const GLOW_BUDGET = 3_000_000;
/** The halo is a blur: half resolution is invisible after upscaling and quarters its cost. */
const GLOW_SCALE = 0.5;

function glowFor(
  img: HTMLImageElement,
  key: string,
  frames: number,
  frame: number,
  b: Bounds,
  dw: number,
  dh: number,
  wrap: { colour: string; blur: number }
): GlowBake | null {
  if (!filterSupported() || dw <= 0 || dh <= 0) return null;
  // A size bucket keeps a breathing or walking figure on one bake per pose, not one per frame.
  const step = Math.ceil(Math.log2(Math.max(1, dh)) * BUCKETS_PER_DOUBLING);
  const id = `${key}|${frames}|${frame}|${step}|${wrap.blur}|${wrap.colour}`;
  const hit = glows.get(id);
  if (hit) {
    glows.delete(id);
    glows.set(id, hit);
    return hit;
  }

  // Enough room for the blur plus the upward lift, on every side.
  const pad = Math.ceil(wrap.blur * 2.6 + 4);
  const w = Math.max(1, Math.ceil((dw + pad * 2) * GLOW_SCALE));
  const h = Math.max(1, Math.ceil((dh + pad * 2) * GLOW_SCALE));
  const shape = document.createElement("canvas");
  shape.width = w;
  shape.height = h;
  const sx = shape.getContext("2d");
  if (!sx) return null;
  sx.imageSmoothingEnabled = true;
  sx.imageSmoothingQuality = "high";
  sx.drawImage(img, b.left, b.top, b.right - b.left, b.bottom - b.top, pad * GLOW_SCALE, pad * GLOW_SCALE, dw * GLOW_SCALE, dh * GLOW_SCALE);
  sx.globalCompositeOperation = "source-in";
  sx.fillStyle = wrap.colour;
  sx.fillRect(0, 0, w, h);

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.filter = `blur(${wrap.blur * GLOW_SCALE}px)`;
  cx.drawImage(shape, 0, 0);
  cx.filter = "none";

  const entry: GlowBake = { canvas: c, pad, dw, dh };
  glows.set(id, entry);
  glowPixels += w * h;
  for (const [old, oc] of glows) {
    if (glowPixels <= GLOW_BUDGET || old === id) break;
    glows.delete(old);
    glowPixels -= oc.canvas.width * oc.canvas.height;
    oc.canvas.width = oc.canvas.height = 0;   // hand the memory back now (Safari is slow to)
  }
  return entry;
}

/**
 * A grade is a CSS filter plus, optionally, `tint(hue)`: the room's own colour laid over the
 * figure (not a CSS function, like `tone` in a backdrop). `tint(160)` is a teal-green wash at a
 * fixed gentle strength, so a cast standing in a green room is not lit like a tavern.
 */
const TINT_ALPHA = 0.42;
const splits = new Map<string, { filter: string; tint: string | null }>();
function splitGrade(grade: string | undefined): { filter: string; tint: string | null } {
  const g = grade ?? "none";
  let hit = splits.get(g);
  if (!hit) {
    const m = /\btint\(\s*(-?[\d.]+)\s*\)/.exec(g);
    const filter = g.replace(/\btint\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    hit = { filter: filter === "none" ? "" : filter, tint: m ? `hsla(${Number(m[1])},62%,40%,${TINT_ALPHA})` : null };
    splits.set(g, hit);
  }
  return hit;
}

let filterOk: boolean | undefined;
/** Whether canvas `filter` works here. Safari before 18 accepts the property and ignores it. */
export function filterSupported(): boolean {
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
export function applyGradeByHand(cx: CanvasRenderingContext2D, w: number, h: number, css: string): void {
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

/**
 * The contact shadow under a figure that reaches the floor. A hard black ellipse reads as a
 * sticker on a painted plate, so this is a soft pool: a small, denser core right at the feet
 * and a wide, faint falloff that fades to nothing. It grounds the figure without a disc edge.
 */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  alpha = 0.34,
  /** Which side the nearest lamp is on (-1 left, 1 right, 0 none): the pool slides away from it. */
  lightSide: -1 | 0 | 1 = 0,
  /** The room's ambient colour at the feet, "r,g,b" (see `shadowTintOf`): the shade takes its hue. */
  tint?: string
): void {
  const pool = shadowPool(tint);
  const rx = w * 1.25 * (lightSide ? 1.12 : 1), ry = Math.max(5, w * 0.27);
  const cx = x - lightSide * w * 0.14;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha * 2.7);
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(pool, cx - rx, y - ry - 1, rx * 2, ry * 2);
  ctx.restore();
}

/**
 * The ambient colour a figure's contact shadow should take: the halo's tint (which already mixes
 * the room's daylight, fog and the nearest lamp), quantised so only a handful of pools exist.
 * Cached on the wrap object, which the paint pass keeps stable while a figure stands still.
 */
const tints = new WeakMap<object, string>();
export function shadowTintOf(wrap: { colour: string } | undefined): string | undefined {
  if (!wrap) return undefined;
  const hit = tints.get(wrap);
  if (hit !== undefined) return hit;
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(wrap.colour);
  const out = m ? `${m[1]},${m[2]},${m[3]}` : "";
  tints.set(wrap, out);
  return out;
}

/**
 * The soft pool, painted once per tint: a wide faint falloff and a denser core right under the
 * feet, as one elliptical image that every figure scales. A blit, where the old shadow built two
 * radial gradients and paths per figure per frame. With no tint it is slightly blue-black; with
 * one, the shade picks up a trace of the room's own light so it sits in the plate's shade.
 */
const pools = new Map<string, HTMLCanvasElement>();
function shadowPool(tint?: string): HTMLCanvasElement {
  const key = tint || "";
  const hit = pools.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const [tr, tg, tb] = key ? key.split(",").map(Number) : [0, 0, 0];
    const f = key ? `${Math.round(4 + tr * 0.13)},${Math.round(6 + tg * 0.13)},${Math.round(10 + tb * 0.13)}` : "5,7,16";
    const k = key ? `${Math.round(2 + tr * 0.07)},${Math.round(3 + tg * 0.07)},${Math.round(6 + tb * 0.07)}` : "2,3,9";
    g.translate(128, 32);
    g.scale(1, 0.25);
    const falloff = g.createRadialGradient(0, 0, 0, 0, 0, 128);
    falloff.addColorStop(0, `rgba(${f},0.75)`);
    falloff.addColorStop(0.4, `rgba(${f},0.5)`);
    falloff.addColorStop(0.75, `rgba(${f},0.17)`);
    falloff.addColorStop(1, `rgba(${f},0)`);
    g.fillStyle = falloff;
    g.fillRect(-128, -128, 256, 256);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 62);
    core.addColorStop(0, `rgba(${k},0.7)`);
    core.addColorStop(1, `rgba(${k},0)`);
    g.fillStyle = core;
    g.fillRect(-128, -128, 256, 256);
  }
  if (pools.size > 40) pools.clear();
  pools.set(key, c);
  return c;
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
  opts: { visible?: number; figure?: boolean; flip?: boolean; grade?: string; lean?: number; squash?: number; wrap?: { colour: string; blur: number; rim?: Rim } } = {}
): void {
  const b = assets.frameBounds(key)?.[0];
  if (!b) return;
  const visible = opts.visible ?? 1;
  // Only art that reaches the floor casts a contact shadow; never wider than a body's (arms
  // flung wide made a puddle of it).
  if (visible >= 1) {
    drawShadow(ctx, x, y, Math.min(height * 0.3, height * ((b.right - b.left) / (b.bottom - b.top)) * 0.8), 0.34, opts.wrap?.rim?.side ?? 0, shadowTintOf(opts.wrap));
  }
  drawFigure(ctx, assets, key, x, y, height, {
    visible,
    flip: opts.flip,
    grade: opts.grade,
    anchor: opts.figure ? "torso" : "box",
    lean: opts.lean,
    squash: opts.squash,
    wrap: opts.wrap,
  });
}

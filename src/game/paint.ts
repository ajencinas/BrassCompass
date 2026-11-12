/**
 * The paint pass: one shared, very quiet film over the whole scene.
 *
 * The plates are painted, but figures are cut out and dropped on them: every edge is a hard
 * alpha boundary, and every room is graded by different art. This puts one screen-space finish
 * over the lot — grain, a filmic teal/warm veil and a gentle vignette — and gives each figure a
 * soft tinted halo behind it, so its silhouette bleeds into the paint instead of sitting on top.
 *
 * It is deliberately cheap: veil, vignette and grain are baked into one 1920×880 overlay once
 * per context, so a frame pays one screen blit. The figure halo is baked from the sprite's own
 * alpha at half resolution, once per pose/size/tint, and then blitted; no per-frame blur or
 * shadow.
 *
 * Toggle: PAINT_PASS. Off restores the old vignette-only finish, exactly.
 *
 * UI: the pass is drawn inside the scene, before the top bar, panel, narration and cursor, and
 * only in gameplay — the title and ending are untouched, so type is never grained.
 */

import { LOGICAL_W, SCENE_H } from "../engine/view";
import type { LightKind, Room, RoomLight } from "./types";

/** One constant: the whole treatment. */
export const PAINT_PASS = true;

type Rgb = readonly [number, number, number];
const clamp = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : n);

/** Colours a painted light throws, when the room doesn't name its own. */
const LIGHT_RGB: Record<LightKind, Rgb> = {
  lantern: [255, 178, 96],
  candle: [255, 196, 120],
  fire: [255, 128, 52],
  lamp: [255, 214, 150],
  moon: [170, 196, 255],
};
/** A room with no lamp and no fog is taken to be in daylight: a warm sun, not a cold one. */
const DAY_RGB: Rgb = [255, 226, 190];
const FOG_RGB: Rgb = [176, 198, 220];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function parseColour(css: string | undefined): Rgb | null {
  if (!css) return null;
  const m = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(m);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i.exec(m);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/** A figure's halo, worked out from where it stands: the nearest lamp's colour against the fog. */
export interface FigureWrap { colour: string; blur: number }

/**
 * Tint for a figure at (x, y). A lamp within reach warms (or greens, or reddens) it; fog and
 * haze cool it; daylight with neither stays warm. The alpha is low enough to read as light
 * spilling around a body, not as a sticker outline.
 */
export function figureWrap(room: Room, x: number, y: number, height: number, lightOn?: (light: RoomLight) => boolean): FigureWrap {
  let hue: Rgb = DAY_RGB;
  let weight = 0.28;

  // Fog: a haze band that covers the figure's floor line (or any haze at all) cools the halo.
  const haze = room.haze ?? [];
  let fog = 0;
  for (const h of haze) {
    if (y >= h.top - 160 && y <= h.bottom + 220) fog = Math.max(fog, Math.min(1, h.alpha * 2.4));
  }
  if (fog > 0) {
    // A cool slate rather than the fog's own pale tint: a white halo would outline the figure
    // against the fog instead of sinking it into it.
    const tint = mix(parseColour(haze.find((h) => h.tint)?.tint) ?? FOG_RGB, [92, 112, 136], 0.45);
    hue = mix(hue, tint, fog * 0.7);
    weight = Math.max(weight, 0.22 + fog * 0.10);
  }

  // Lamps: a light whose pool reaches this spot pulls the halo toward its colour. A doused
  // lantern throws no light at all, so its condition must hold.
  for (const l of room.lights ?? []) {
    if (lightOn && !lightOn(l)) continue;
    const reach = Math.max(360, l.radius * 2.6);
    const d = Math.hypot(l.at.x - x, l.at.y - y);
    if (d >= reach) continue;
    const k = (1 - d / reach) ** 2;
    const rgb = parseColour(l.colour) ?? LIGHT_RGB[l.kind];
    hue = mix(hue, rgb, k * 0.85);
    weight = Math.max(weight, 0.2 + k * 0.14);
  }

  // Quantised, so a breathing or walking figure keeps the same halo bake: a continuous tint
  // or blur would change the cache key every frame and re-blur the silhouette every frame.
  const step = (n: number, by: number): number => Math.round(n / by) * by;
  const alpha = Math.round(Math.min(0.36, weight) * 10) / 10;
  const blur = Math.max(10, Math.round((Math.min(32, height * 0.08)) / 2) * 2);
  const rgb = [clamp(hue[0]), clamp(hue[1]), clamp(hue[2])].map((n) => clamp(step(n, 32)));
  return { colour: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`, blur };
}

// ------------------------------------------------------------ grain

/** Power of two, so the tiled lookup below can wrap with a mask. */
const GRAIN_SIZE = 256;
/** How many levels of luminance the grain adds either side of the plate, before the veil. */
const GRAIN_TARGET = 2.4;

/**
 * A seamless field of signed paper tooth: mottle, the tooth of the canvas, and a little dust.
 * Values are centred on zero so baking it into the overlay cannot lift the exposure.
 */
function makeGrain(): Float32Array {
  // A tiny deterministic PRNG so the same grain appears on every run and platform.
  let seed = 0x9e3779b9;
  const rnd = (): number => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed / 4294967296;
  };
  // Wrapped lattice value noise: the mottle tiles with the field, so the repeat never shows.
  const lattice = (cells: number): number[] => {
    const out = new Array(cells * cells);
    for (let i = 0; i < out.length; i++) out[i] = rnd();
    return out;
  };
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  const sample = (grid: number[], cells: number, u: number, v: number): number => {
    const gx = u * cells, gy = v * cells;
    const x0 = Math.floor(gx) % cells, y0 = Math.floor(gy) % cells;
    const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
    const fx = smooth(gx - Math.floor(gx)), fy = smooth(gy - Math.floor(gy));
    const top = grid[y0 * cells + x0] + (grid[y0 * cells + x1] - grid[y0 * cells + x0]) * fx;
    const bot = grid[y1 * cells + x0] + (grid[y1 * cells + x1] - grid[y1 * cells + x0]) * fx;
    return top + (bot - top) * fy;
  };
  const coarse = lattice(3), mid = lattice(7);
  const out = new Float32Array(GRAIN_SIZE * GRAIN_SIZE);
  let sum = 0;
  for (let y = 0; y < GRAIN_SIZE; y++) {
    for (let x = 0; x < GRAIN_SIZE; x++) {
      const u = x / GRAIN_SIZE, v = y / GRAIN_SIZE;
      const n = (sample(coarse, 3, u, v) - 0.5) * 0.9 + (sample(mid, 7, u, v) - 0.5) * 0.42 + (rnd() - 0.5) * 0.7;
      out[y * GRAIN_SIZE + x] = n;
      sum += n;
    }
  }
  const mean = sum / out.length;
  for (let i = 0; i < out.length; i++) out[i] -= mean;
  return out;
}

// ------------------------------------------------------------ pass

export class Paint {
  private overlayFor: { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } | null = null;

  /**
   * The grade, vignette and grain, baked together once per context. One blit a frame instead of
   * a full-screen soft-light pass plus a screen pass plus a grain fill: those three blend layers
   * cost ~48 ms a frame in the headless reference; the baked overlay's blit was within noise of
   * the old vignette-only frame.
   *
   * The grain is written into the overlay's colour, scaled by the overlay's own alpha, so the
   * grain that reaches the plate is about GRAIN_TARGET levels whether the pixel sits under heavy
   * vignette or thin veil — and it adds no exposure of its own.
   */
  private overlay(ctx: CanvasRenderingContext2D): HTMLCanvasElement | null {
    if (this.overlayFor?.ctx !== ctx) {
      const c = document.createElement("canvas");
      c.width = LOGICAL_W;
      c.height = SCENE_H;
      const x = c.getContext("2d");
      if (!x) return null;

      // The shared grade: a cool head, a warm foot. Kept low: a veil, not a colour wash.
      const g = x.createLinearGradient(0, 0, LOGICAL_W * 0.25, SCENE_H);
      g.addColorStop(0, "rgba(30,46,66,0.085)");
      g.addColorStop(0.5, "rgba(70,64,54,0.035)");
      g.addColorStop(1, "rgba(104,82,56,0.07)");
      x.fillStyle = g;
      x.fillRect(0, 0, LOGICAL_W, SCENE_H);

      // The scene's vignette, kept close to the old one so the finish never changes exposure:
      // the corners fall off the same way, only a touch gentler and very slightly blue-black.
      const v = x.createRadialGradient(
        LOGICAL_W / 2, SCENE_H / 2, SCENE_H * 0.36,
        LOGICAL_W / 2, SCENE_H / 2, SCENE_H * 0.98
      );
      v.addColorStop(0, "rgba(4,7,12,0)");
      v.addColorStop(1, "rgba(4,6,11,0.50)");
      x.fillStyle = v;
      x.fillRect(0, 0, LOGICAL_W, SCENE_H);

      // Fold the grain in by hand. The overlay is alpha-composited over the scene, so a colour
      // delta d in the overlay lands as d * alpha on the plate; divide by alpha to keep the
      // grain even, and let the very thin centre use the same target.
      const grain = makeGrain();
      const im = x.getImageData(0, 0, LOGICAL_W, SCENE_H);
      const d = im.data;
      for (let y = 0, i = 0; y < SCENE_H; y++) {
        const row = (y & (GRAIN_SIZE - 1)) * GRAIN_SIZE;
        for (let px = 0; px < LOGICAL_W; px++, i += 4) {
          const n = grain[row + (px & (GRAIN_SIZE - 1))];
          const a = d[i + 3] / 255;
          const delta = (n * GRAIN_TARGET) / Math.max(a, 0.07);
          d[i] = clamp(d[i] + delta);
          d[i + 1] = clamp(d[i + 1] + delta);
          d[i + 2] = clamp(d[i + 2] + delta);
        }
      }
      x.putImageData(im, 0, 0);

      this.overlayFor = { ctx, canvas: c };
    }
    return this.overlayFor.canvas;
  }

  /** Draw the shared finish over the scene. Called once per rendered frame, in gameplay only. */
  draw(ctx: CanvasRenderingContext2D): void {
    const overlay = this.overlay(ctx);
    if (overlay) ctx.drawImage(overlay, 0, 0);
  }
}

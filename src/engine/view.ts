/**
 * View — logical 1920x1080 canvas, DPI-aware, letterboxed.
 * All game code draws in logical coordinates and never touches DPR.
 */

export const LOGICAL_W = 1920;
export const LOGICAL_H = 1080;

/** Height of the playfield; the remaining strip is the verb panel. */
export const SCENE_H = 880;

export class View {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** logical -> CSS pixel factor */
  scale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The stage normally fills the window; the dev editor narrows it to make room for itself.
    const stage = this.canvas.parentElement;
    const availW = stage?.clientWidth || window.innerWidth;
    const availH = stage?.clientHeight || window.innerHeight;

    // Fit inside the window, preserving 16:9.
    const s = Math.min(availW / LOGICAL_W, availH / LOGICAL_H);
    this.scale = s;

    // The backing store is the CSS box in device pixels, exactly: sizing the two separately
    // (CSS floored, store rounded) made the browser resample every frame by a fraction of a
    // pixel, which blurred the whole picture. The drawing transform is then whatever maps the
    // 1920x1080 world onto that store.
    const cssW = Math.floor(LOGICAL_W * s), cssH = Math.floor(LOGICAL_H * s);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));

    this.ctx.setTransform(this.canvas.width / LOGICAL_W, 0, 0, this.canvas.height / LOGICAL_H, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  /** Convert a DOM pointer event to logical game coordinates. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * LOGICAL_W,
      y: ((clientY - r.top) / r.height) * LOGICAL_H,
    };
  }
}

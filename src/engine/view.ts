/**
 * View — logical 1920x1080 canvas, DPI-aware, letterboxed.
 * All game code draws in logical coordinates and never touches DPR.
 *
 * On a phone the whole 1920x1080 frame at 390 CSS pixels wide would put the HUD's 20–28 px type
 * at 4–6 CSS pixels, and its buttons far below a finger. So mobile play draws only the scene
 * (the 1920x880 playfield) and a DOM touch HUD handles the verbs, satchel and actions at real
 * CSS sizes. `setSceneOnly` picks which logical height the same world is mapped through; the
 * pointer conversion follows it, so a tap on a hotspot still means the same world point.
 */

export const LOGICAL_W = 1920;
export const LOGICAL_H = 1080;

/**
 * The backing store is capped at the game's own resolution. A 4K window used to render a
 * 4K (or 8K at DPR 2) canvas and then let the browser scale it down — four to sixteen times
 * the pixels for a 1920x1080 painting. CSS still fills the window; only the drawn pixels are
 * capped, at 1920x1080 / DPR up to 2.
 */
const MAX_DPR = 2;
const MAX_BACKING_W = LOGICAL_W;
const MAX_BACKING_H = LOGICAL_H;

/** Height of the playfield; the remaining strip is the verb panel. */
export const SCENE_H = 880;

/** A viewport whose short side is at most this can get the touch layout. */
const MOBILE_SHORT_SIDE = 820;
/** A wider window is a desktop, even if it has a touchscreen (a 1366x768 laptop, say). */
const MOBILE_MAX_WIDTH = 1024;

/**
 * Whether this browser should get the mobile/touch layout: a phone or small-tablet viewport.
 * A desktop window, including a touch laptop, keeps the desktop UI. Either layout can be forced
 * for testing with ?mobile=1 / ?nomobile=1.
 */
export function wantsMobileLayout(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has("mobile")) return params.get("mobile") !== "0";
  if (params.has("nomobile")) return false;
  const coarse =
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia?.("(any-pointer: coarse)").matches === true ||
    window.matchMedia?.("(pointer: coarse)").matches === true;
  if (window.innerWidth > MOBILE_MAX_WIDTH) return false;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  if (shortSide > MOBILE_SHORT_SIDE) return false;
  // A phone-shaped window gets the touch layout even when a test or a desktop browser reports
  // no touch hardware, because the desktop chrome is four-pixel type at 390 wide. The shape
  // test is deliberately phone-sized: the browser suite's 800x600 desktop window, and every
  // 1366x768 laptop, stay on the desktop UI.
  const portraitPhone = window.innerHeight > window.innerWidth && window.innerWidth <= 600;
  const landscapePhone = window.innerWidth <= 900 && window.innerHeight <= 480;
  return coarse || portraitPhone || landscapePhone;
}

export class View {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** logical -> CSS pixel factor */
  scale = 1;
  /** A phone/tablet touch layout: no shrink-to-fit 1080 frame, the scene fills the width. */
  readonly mobile: boolean;
  /** Mobile play maps the 1920x880 scene, not the full 1920x1080 frame. */
  private sceneOnly = false;

  constructor(canvas: HTMLCanvasElement, mobile = false) {
    this.canvas = canvas;
    this.mobile = mobile;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.resize();
  }

  /** The logical height currently mapped onto the canvas (880 for mobile play, else 1080). */
  get logicalHeight(): number {
    return this.mobile && this.sceneOnly ? SCENE_H : LOGICAL_H;
  }

  /**
   * Mobile only: play shows the scene alone (the DOM touch HUD supplies the panel), while the
   * title, prologue and ending use the full frame. Re-fits the canvas when it changes.
   */
  setSceneOnly(on: boolean): void {
    if (!this.mobile || this.sceneOnly === on) return;
    this.sceneOnly = on;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    // The stage normally fills the window; the dev editor narrows it to make room for itself.
    const stage = this.canvas.parentElement;
    const availW = stage?.clientWidth || window.innerWidth;
    const availH = stage?.clientHeight || window.innerHeight;
    const logicalH = this.logicalHeight;

    // Fit inside the stage, preserving the aspect of the logical frame in use.
    const s = Math.min(availW / LOGICAL_W, availH / logicalH);
    this.scale = s;

    // The backing store is the CSS box in device pixels, capped as above: sizing the two
    // separately (CSS floored, store rounded) made the browser resample every frame by a
    // fraction of a pixel, which blurred the whole picture. The drawing transform is then
    // whatever maps the logical world onto that store.
    const cssW = Math.floor(LOGICAL_W * s), cssH = Math.floor(logicalH * s);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    // At most 1920x1080 of backing pixels, however large the CSS box or high the DPR.
    const render = Math.min(dpr, MAX_BACKING_W / Math.max(1, cssW), MAX_BACKING_H / Math.max(1, cssH));
    this.canvas.width = Math.max(1, Math.round(cssW * render));
    this.canvas.height = Math.max(1, Math.round(cssH * render));

    this.ctx.setTransform(this.canvas.width / LOGICAL_W, 0, 0, this.canvas.height / logicalH, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  /** Convert a DOM pointer event to logical game coordinates. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * LOGICAL_W,
      y: ((clientY - r.top) / r.height) * this.logicalHeight,
    };
  }
}

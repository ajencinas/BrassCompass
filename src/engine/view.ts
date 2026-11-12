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

/**
 * Render quality, for a weak machine: how many pixels the backing store may have, how the
 * browser filters a scaled painting, and whether the Q-reveal's glow may use the canvas's
 * blur (`shadowBlur`, the most expensive thing the scene does per frame) or must make do with
 * a cheap double stroke. "high" is the game as designed and the default.
 */
export type Quality = "high" | "medium" | "low";
export const QUALITIES: readonly Quality[] = ["high", "medium", "low"];
export const QUALITY_PRESETS: Record<Quality, { backingW: number; backingH: number; smoothing: ImageSmoothingQuality; cheapGlow: boolean }> = {
  high: { backingW: MAX_BACKING_W, backingH: MAX_BACKING_H, smoothing: "high", cheapGlow: false },
  medium: { backingW: 1600, backingH: 900, smoothing: "medium", cheapGlow: false },
  low: { backingW: 1280, backingH: 720, smoothing: "low", cheapGlow: true },
};

/**
 * The backing-store scale for a CSS box: device pixels per CSS pixel, capped by DPR and by the
 * quality's pixel budget (the 1920x1080 cap at "high").
 */
export function backingScale(quality: Quality, dpr: number, cssW: number, cssH: number): number {
  const p = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.high;
  return Math.min(Math.min(dpr, MAX_DPR), p.backingW / Math.max(1, cssW), p.backingH / Math.max(1, cssH));
}

/**
 * The filter for drawing the painting at this scale. Where the backing store is smaller than
 * the 1920-wide logical frame every plate is being downscaled, and "high" (a wide-kernel
 * resample of a multi-megapixel plate, every frame) costs a lot for no visible gain; at or
 * above 1:1 the quality's own setting applies.
 */
export function smoothingFor(quality: Quality, backingW: number): ImageSmoothingQuality {
  const wanted = (QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.high).smoothing;
  return backingW < LOGICAL_W && wanted === "high" ? "medium" : wanted;
}

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
  /** The title painting is up (portrait phones fill the screen with a crop of it). */
  private titleCover = false;
  /** CSS pixels of the canvas hidden left of the stage while a portrait crop is showing. */
  private cropX = 0;
  private cssW = 0;
  private stageW = 0;
  private covering = false;
  private _quality: Quality = "high";
  private resizeTimer: number | null = null;
  private resizeDirty = false;
  private dprQuery: MediaQueryList | null = null;

  constructor(canvas: HTMLCanvasElement, mobile = false) {
    this.canvas = canvas;
    this.mobile = mobile;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.resize();
    this.watchDpr();
  }

  get quality(): Quality { return this._quality; }

  /**
   * True when glows must not use the canvas's `shadowBlur` (quality "low"): draw a double
   * stroke (a wide faint one under a narrow bright one) instead.
   */
  get cheapGlow(): boolean { return QUALITY_PRESETS[this._quality].cheapGlow; }

  /** Pick a render quality (see `Quality`); re-fits the backing store at once. */
  setQuality(q: Quality): void {
    if (!QUALITY_PRESETS[q] || q === this._quality) return;
    this._quality = q;
    this.resize();
  }

  /**
   * `resize()` for a stream of window `resize` events: the first runs at once, the rest
   * within `ms` collapse into one trailing call. Resetting the canvas size clears and
   * reallocates the backing store, so a window being dragged must not do it per event.
   */
  resizeSoon(ms = 120): void {
    if (this.resizeTimer !== null) { this.resizeDirty = true; return; }
    this.resize();
    const settle = (): void => {
      this.resizeTimer = null;
      if (!this.resizeDirty) return;
      this.resizeDirty = false;
      this.resize();
      this.resizeTimer = window.setTimeout(settle, ms);
    };
    this.resizeTimer = window.setTimeout(settle, ms);
  }

  /**
   * The device pixel ratio changes without any `resize` event (the window dragged to another
   * monitor, browser zoom on some engines): a `(resolution: Ndppx)` query stops matching, and
   * the next one is armed for the new ratio.
   */
  private watchDpr(): void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    this.dprQuery?.removeEventListener?.("change", this.onDprChange);
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery.addEventListener?.("change", this.onDprChange, { once: true });
  }
  private onDprChange = (): void => {
    this.resizeSoon();
    this.watchDpr();
  };

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

  /**
   * Mobile portrait: how the canvas is fitted to its stage. "scene" scales the playfield to the
   * stage's height and crops its width around Fenn (see `panTo`); "title" does the same for the
   * title painting, but never so large that its logo is cut off; null is the plain fit.
   */
  private coverMode(): "scene" | "title" | null {
    if (!this.mobile || typeof window === "undefined" || window.innerWidth > window.innerHeight) return null;
    if (this.sceneOnly) return "scene";
    return this.titleCover ? "title" : null;
  }

  /** Mobile only: the title painting is showing (a portrait phone fills its screen with it). */
  setTitleCover(on: boolean): void {
    if (!this.mobile || this.titleCover === on) return;
    this.titleCover = on;
    this.resize();
  }

  /** The slice of the logical frame a portrait crop shows, or the whole frame. */
  get visible(): { x: number; w: number } {
    if (!this.covering || this.scale <= 0) return { x: 0, w: LOGICAL_W };
    return { x: this.cropX / this.scale, w: Math.min(LOGICAL_W, this.stageW / this.scale) };
  }

  /**
   * Slide a portrait crop towards `focusX` (a logical x), so the stage shows the world around it.
   * Pointer conversion reads the canvas's real box, so a tap lands on the same world point
   * wherever the crop is. A no-op unless a crop is showing.
   */
  panTo(focusX: number, dt: number, snap = false): void {
    if (!this.covering) return;
    const room = Math.max(0, this.cssW - this.stageW);
    // A look-around drag holds the view where the finger left it for a few seconds.
    if (snap) this.peekUntil = 0;
    if (!snap && performance.now() < this.peekUntil) { this.applyCrop(); return; }
    const goal = Math.max(0, Math.min(room, focusX * this.scale - this.stageW / 2));
    if (snap || Math.abs(goal - this.cropX) < 0.4) this.cropX = goal;
    else this.cropX += (goal - this.cropX) * Math.min(1, dt * 9);
    this.applyCrop();
  }

  private peekUntil = 0;

  /**
   * A finger dragged the scene sideways: slide the crop the other way (as if holding the
   * painting), and keep it there a few seconds before it glides back to Fenn.
   */
  dragCrop(dxCss: number): void {
    if (!this.covering) return;
    this.cropX = Math.max(0, Math.min(Math.max(0, this.cssW - this.stageW), this.cropX - dxCss));
    this.peekUntil = performance.now() + 3200;
    this.applyCrop();
  }

  private applyCrop(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const x = this.covering ? Math.round(this.cropX * dpr) / dpr : 0;
    const css = x > 0 ? `translate3d(${-x}px,0,0)` : "";
    if (this.canvas.style.transform !== css) this.canvas.style.transform = css;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    // The stage normally fills the window; the dev editor narrows it to make room for itself.
    const stage = this.canvas.parentElement;
    const availW = stage?.clientWidth || window.innerWidth;
    const availH = stage?.clientHeight || window.innerHeight;
    const logicalH = this.logicalHeight;

    // Fit inside the stage, preserving the aspect of the logical frame in use.
    const cover = this.coverMode();
    let s = Math.min(availW / LOGICAL_W, availH / logicalH);
    // A portrait phone has more height than a 16:9 frame can use: scale to the height instead and
    // crop the sides. The title stops short of that so its logo (about 640 logical px wide) stays whole.
    if (cover === "scene") s = Math.max(availW / LOGICAL_W, availH / logicalH);
    else if (cover === "title") s = Math.max(availW / LOGICAL_W, Math.min(availH / logicalH, availW / 640));
    this.scale = s;
    this.covering = cover !== null;
    if (typeof document !== "undefined") document.body.classList.toggle("m-cover", this.covering);

    // The backing store is the CSS box in device pixels, capped as above: sizing the two
    // separately (CSS floored, store rounded) made the browser resample every frame by a
    // fraction of a pixel, which blurred the whole picture. The drawing transform is then
    // whatever maps the logical world onto that store.
    const cssW = Math.floor(LOGICAL_W * s), cssH = Math.floor(logicalH * s);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    // At most 1920x1080 of backing pixels (less at a lower quality), however large the CSS box
    // or high the DPR.
    const render = backingScale(this._quality, dpr, cssW, cssH);
    this.canvas.width = Math.max(1, Math.round(cssW * render));
    this.canvas.height = Math.max(1, Math.round(cssH * render));

    this.ctx.setTransform(this.canvas.width / LOGICAL_W, 0, 0, this.canvas.height / logicalH, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = smoothingFor(this._quality, this.canvas.width);

    this.cssW = cssW;
    this.stageW = availW;
    this.cropX = Math.max(0, Math.min(Math.max(0, cssW - availW), this.cropX));
    this.applyCrop();
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

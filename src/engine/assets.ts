/**
 * Asset loading with progress reporting.
 *
 * Images stream through one queue with a small concurrency limit, most-wanted first. An image is
 * published (visible through `img()`) only once it is fully downloaded, decoded and, for figure
 * art, measured, so the first frame that draws it never stalls on a decode or a `getImageData`.
 * Anything that waits for `img(key)` to appear — the room curtain does — therefore waits for a
 * drawable image, and asking for one that hasn't arrived moves it to the front of the queue.
 *
 * Audio never blocks: an <audio> element is usable as soon as it exists (it buffers on play),
 * and iOS won't fetch media before a user gesture anyway.
 *
 * Nothing else is loaded at boot. The title, the first room and the cold open are fetched by
 * `load`; every later room asks for its own plate, sprites and portraits with `ensure`, and an
 * image failure is retried a few times before a painted fallback (for backgrounds) is put in
 * its place. A failed background therefore cannot leave a room black or hold the curtain.
 */

export interface AssetManifest {
  images: Record<string, string>;
  audio: Record<string, string>;
}

export interface LoadOptions {
  /** Keys to fetch first, in order. The rest follow in manifest order. */
  priority?: string[];
  /** Frame counts of sprite sheets, so their cells are measured at load too. */
  frames?: Record<string, number>;
}

interface Job {
  key: string;
  url: string;
  done: Promise<void>;
  resolve: () => void;
}

/** Simultaneous image downloads. Enough to fill the pipe, few enough that order matters. */
const CONCURRENCY = 4;
/** Attempts per image, then a fallback for backgrounds. */
const ATTEMPTS = 3;
/** Give a single image request this long before abandoning the attempt. */
const IMAGE_TIMEOUT_MS = 15_000;
/** Backoff between attempts; a flaky connection gets a second and a third chance. */
const RETRY_DELAY_MS = 260;

export class Assets {
  readonly images = new Map<string, HTMLImageElement>();
  readonly audio = new Map<string, HTMLAudioElement>();

  private jobs = new Map<string, Job>();
  private queue: Job[] = [];
  private running = 0;
  private sheetFrames = new Map<string, number>();
  private failed = new Set<string>();
  /** Every URL the game may ask for later, not just what this boot needs. */
  private catalog = new Map<string, string>();
  private fallback: Promise<HTMLImageElement | null> | null = null;

  /** Teach the loader where the rest of the art lives, so `ensure` can fetch it by key. */
  setCatalog(images: Record<string, string>): void {
    for (const [key, url] of Object.entries(images)) this.catalog.set(key, url);
  }

  /** Whether any of these keys failed after retries (a boot screen can name the reason). */
  hasFailed(keys: Iterable<string>): boolean {
    for (const key of keys) if (this.failed.has(key)) return true;
    return false;
  }

  async load(manifest: AssetManifest, onProgress: (p: number) => void, opts: LoadOptions = {}): Promise<void> {
    for (const [k, n] of Object.entries(opts.frames ?? {})) this.sheetFrames.set(k, n);

    this.setCatalog(manifest.images);

    for (const [key, url] of Object.entries(manifest.audio)) {
      if (this.audio.has(key)) continue;
      const a = new Audio();
      a.preload = "auto";
      a.src = url;
      a.addEventListener("error", () => console.warn("audio failed:", key, url), { once: true });
      this.audio.set(key, a);
    }

    const keys = Object.keys(manifest.images);
    const order = [
      ...(opts.priority ?? []).filter((k) => k in manifest.images),
      ...keys,
    ];
    const seen = new Set<string>();
    const mine: Promise<void>[] = [];
    let settled = 0;
    const total = keys.length;
    if (total === 0) onProgress(1);
    for (const key of order) {
      if (seen.has(key)) continue;
      seen.add(key);
      const job = this.enqueue(key, manifest.images[key]);
      mine.push(job.done.then(() => {
        settled++;
        onProgress(Math.min(1, settled / total));
      }));
    }
    this.pump();
    await Promise.all(mine);
  }

  /**
   * Fetch only the keys a room (or an ending card) actually needs. Nothing else is scheduled:
   * the next room's art is asked for when the player goes through its door, not at boot.
   * Deduplicates against loaded, failed and already-queued keys, so calling it every entry is
   * cheap. Resolves once those keys have arrived (or finally failed).
   */
  async ensure(keys: Iterable<string>, onProgress?: (p: number) => void): Promise<void> {
    const wanted = [...new Set(keys)].filter((key) => this.catalog.has(key));
    if (!wanted.length) { onProgress?.(1); return; }
    let settled = 0;
    const waits = wanted.map((key) => this.enqueue(key, this.catalog.get(key)!).done.then(() => {
      settled++;
      onProgress?.(Math.min(1, settled / wanted.length));
    }));
    this.pump();
    await Promise.all(waits);
  }

  /**
   * Resolves once every key that is loading or loaded is decoded and measured (missing or failed
   * keys count as settled). Also moves them to the front of the queue. Hold a curtain on it.
   */
  ready(keys: Iterable<string>): Promise<void> {
    const waits: Promise<void>[] = [];
    for (const key of keys) {
      const job = this.jobs.get(key);
      if (!job) continue;
      this.bump(key);
      waits.push(job.done);
    }
    this.pump();
    return Promise.all(waits).then(() => undefined);
  }

  /** Whether `key` has arrived (or failed) — i.e. `ready([key])` would resolve at once. */
  isReady(key: string): boolean {
    return this.images.has(key) || !this.jobs.has(key) || this.failed.has(key);
  }

  /** Fetch these next, ahead of anything else still waiting. */
  prioritize(keys: Iterable<string>): void {
    for (const key of [...keys].reverse()) this.bump(key);
  }

  img(key: string): HTMLImageElement | undefined {
    const img = this.images.get(key);
    // Someone wants this now: let it jump the queue.
    if (!img && this.queue.length) this.bump(key);
    return img;
  }

  private enqueue(key: string, url: string): Job {
    const existing = this.jobs.get(key);
    if (existing) return existing;
    // Already loaded or finally failed: a resolved job lets ensure() count it without a fetch.
    if (this.images.has(key) || this.failed.has(key)) {
      let resolve!: () => void;
      const done = new Promise<void>((r) => { resolve = r; });
      resolve();
      return { key, url, done, resolve };
    }
    let resolve!: () => void;
    const done = new Promise<void>((r) => { resolve = r; });
    const job: Job = { key, url, done, resolve };
    this.jobs.set(key, job);
    this.queue.push(job);
    return job;
  }

  private bump(key: string): void {
    const i = this.queue.findIndex((j) => j.key === key);
    if (i <= 0) return;
    const [job] = this.queue.splice(i, 1);
    this.queue.unshift(job);
  }

  private pump(): void {
    while (this.running < CONCURRENCY && this.queue.length) {
      const job = this.queue.shift()!;
      this.running++;
      void this.fetchImage(job).finally(() => {
        this.running--;
        job.resolve();
        this.pump();
      });
    }
  }

  private async fetchImage(job: Job): Promise<void> {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const url = attempt === 1 ? job.url : retryUrl(job.url, attempt);
      const img = await loadImage(url);
      if (img) {
        // Decode off the main thread now, not on the first drawImage of a room's first frame.
        try { await img.decode(); } catch { /* decoded lazily instead */ }
        if (!job.key.startsWith("bg_")) {
          const n = this.sheetFrames.get(job.key);
          await this.measure(job.key, img, n && n > 1 ? [1, n] : [1]);
        }
        this.images.set(job.key, img);
        return;
      }
      if (attempt < ATTEMPTS) await delay(RETRY_DELAY_MS * attempt);
    }
    console.warn("image failed after retries:", job.key, job.url);
    this.failed.add(job.key);
    // A missing plate must not leave the room black: paint a quiet fallback under the scene.
    if (job.key.startsWith("bg_")) {
      const fallback = await this.fallbackImage();
      if (fallback) this.images.set(job.key, fallback);
    }
  }

  /** One dark, foggy plate reused when any background has failed for good. */
  private fallbackImage(): Promise<HTMLImageElement | null> {
    if (!this.fallback) {
      this.fallback = new Promise((resolve) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="880" viewBox="0 0 1920 880">
          <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0a1420"/><stop offset="0.62" stop-color="#122536"/><stop offset="1" stop-color="#071018"/>
          </linearGradient><radialGradient id="g" cx="0.5" cy="0.3" r="0.7">
            <stop offset="0" stop-color="#28435a" stop-opacity="0.5"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
          </radialGradient></defs>
          <rect width="1920" height="880" fill="url(#f)"/><rect width="1920" height="880" fill="url(#g)"/>
        </svg>`;
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
    }
    return this.fallback;
  }

  private boundsCache = new Map<string, Bounds[]>();

  /** Measure every announced cell count of an image, between frames. */
  private async measure(key: string, img: HTMLImageElement, counts: number[]): Promise<void> {
    await idle();
    const alpha = readAlpha(img);
    if (!alpha) return;
    for (const n of counts) {
      const id = `${key}#${n}`;
      if (!this.boundsCache.has(id)) this.boundsCache.set(id, scanBounds(alpha, img.width, img.height, n));
    }
  }

  /**
   * Opaque extents of each cell of a horizontal strip (a single image is one cell), so figures
   * are anchored by their real feet rather than the transparent padding diffusion leaves around
   * them. Generated sheets are not reliably baseline-aligned, so every cell is measured on its own.
   * Measured at load; a cell count nobody announced is measured here, once.
   */
  frameBounds(key: string, frames = 1): Bounds[] | undefined {
    const id = `${key}#${frames}`;
    const cached = this.boundsCache.get(id);
    if (cached) return cached;
    const img = this.images.get(key);
    if (!img || !img.width) return undefined;

    const alpha = readAlpha(img);
    if (!alpha) return undefined;
    const out = scanBounds(alpha, img.width, img.height, frames);
    this.boundsCache.set(id, out);
    return out;
  }
}

interface Alpha { w: number; h: number; step: number; data: Uint8ClampedArray }

/** A downscaled copy of an image's pixels (full-size sheets can be millions of pixels). */
function readAlpha(img: HTMLImageElement): Alpha | undefined {
  const step = Math.max(1, Math.floor(Math.max(img.width, img.height) / 768));
  const w = Math.ceil(img.width / step), h = Math.ceil(img.height / step);
  try {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const cx = c.getContext("2d", { willReadFrequently: true })!;
    cx.drawImage(img, 0, 0, w, h);
    return { w, h, step, data: cx.getImageData(0, 0, w, h).data };
  } catch {
    return undefined;
  }
}

/** Yield to the browser so measuring never lands inside a busy frame. */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 200 });
    else setTimeout(resolve, 0);
  });
}

function scanBounds(
  a: Alpha,
  imgW: number,
  imgH: number,
  frames: number
): Bounds[] {
  const { w, h, step, data } = a;
  const solid = (x: number, y: number) => data[(y * w + x) * 4 + 3] >= 96;

  const out: Bounds[] = [];
  const cellW = w / frames;
  for (let f = 0; f < frames; f++) {
    const x0 = Math.round(f * cellW), x1 = Math.round((f + 1) * cellW);
    let top = h, bottom = -1, left = x1, right = -1;
    for (let y = 0; y < h; y++) {
      for (let x = x0; x < x1; x++) {
        if (!solid(x, y)) continue;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    if (bottom < 0) {
      const cell = imgW / frames;
      out.push({ top: 0, bottom: imgH, left: f * cell, right: (f + 1) * cell, torso: (f + 0.5) * cell });
      continue;
    }
    // Torso: the opaque span 15–45% down the figure. Limbs, bags and strides swing about it.
    let tl = right, tr = left;
    const bandTop = top + Math.floor((bottom - top) * 0.15);
    const bandBottom = top + Math.floor((bottom - top) * 0.45);
    for (let y = bandTop; y <= bandBottom; y++) {
      for (let x = left; x <= right; x++) {
        if (!solid(x, y)) continue;
        if (x < tl) tl = x;
        if (x > tr) tr = x;
      }
    }
    out.push({
      top: top * step,
      bottom: Math.min(imgH, (bottom + 1) * step),
      left: left * step,
      right: Math.min(imgW, (right + 1) * step),
      torso: tr >= tl ? ((tl + tr + 1) / 2) * step : ((left + right + 1) / 2) * step,
    });
  }
  return out;
}

/** Opaque region of one image cell, in source pixels of the whole image. */
export interface Bounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Horizontal centre of the torso, the stable anchor for a figure. */
  torso: number;
}

/** Load one image with a deadline; a stalled request must not hold a room forever. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    let done = false;
    const finish = (value: HTMLImageElement | null): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), IMAGE_TIMEOUT_MS);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/** A retry of a cached 404 needs a different URL or the browser may answer from its cache. */
function retryUrl(url: string, attempt: number): string {
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}retry=${attempt}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
const CONCURRENCY = 5;

export class Assets {
  readonly images = new Map<string, HTMLImageElement>();
  readonly audio = new Map<string, HTMLAudioElement>();

  private jobs = new Map<string, Job>();
  private queue: Job[] = [];
  private running = 0;
  private sheetFrames = new Map<string, number>();
  private failed = new Set<string>();

  async load(manifest: AssetManifest, onProgress: (p: number) => void, opts: LoadOptions = {}): Promise<void> {
    for (const [k, n] of Object.entries(opts.frames ?? {})) this.sheetFrames.set(k, n);

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
    const img = new Image();
    img.decoding = "async";
    const ok = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = job.url;
    });
    if (!ok) {
      console.warn("image failed:", job.key, job.url);
      this.failed.add(job.key);
      return;
    }
    // Decode off the main thread now, not on the first drawImage of a room's first frame.
    try { await img.decode(); } catch { /* decoded lazily instead */ }
    if (!job.key.startsWith("bg_")) {
      const n = this.sheetFrames.get(job.key);
      await this.measure(job.key, img, n && n > 1 ? [1, n] : [1]);
    }
    this.images.set(job.key, img);
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

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
 * and iOS won't fetch media before a user gesture anyway. Only the tracks named in
 * `LoadOptions.eagerAudio` (the title's and the first room's) are preloaded at boot; the rest
 * fetch just their metadata and buffer when a room first plays them. A track that errors is
 * retried a few times with a backoff, again when the connection comes back, and once more when
 * a room is entered; only when it has finally failed is the player told, once, through
 * `onNotice`, and the game carries on without it.
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
  /** Audio keys to preload at boot; every other track fetches metadata only. Default: all. */
  eagerAudio?: string[];
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
/**
 * Timing, as one mutable record so a test can shorten it. `stallMs` is a stall deadline, not a
 * total one: an image attempt is abandoned only after this long with no bytes arriving, and the
 * clock restarts with every chunk, so a big sprite on a slow link is never given up on while
 * it is still coming. `directMs` is the total allowance for the plain <img> fallback, which
 * cannot report progress. `retryDelayMs` is the backoff between attempts.
 */
export const LOAD_TIMING = { stallMs: 15_000, directMs: 30_000, retryDelayMs: 260, retryAgainMs: 6_000 };
/** Attempts per audio track before it is reported as failed. */
const AUDIO_ATTEMPTS = 3;

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
  /** Backgrounds currently showing the painted fallback: a later retry may replace them. */
  private fallbackKeys = new Set<string>();
  /** When each failed image last failed (performance.now), so entering a room is not a retry storm. */
  private failedAt = new Map<string, number>();
  private onlineHooked = false;
  /** Audio: attempts so far per key, the tracks given up on, and whether the player was told. */
  private audioTries = new Map<string, number>();
  private audioUrls = new Map<string, string>();
  private audioGaveUp = new Set<string>();
  private audioGaveUpAt = 0;
  private audioNoticed = false;
  /** A non-blocking message for the player (the game shows it on its notice banner). */
  onNotice: ((text: string) => void) | null = null;

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

    const eager = opts.eagerAudio ? new Set(opts.eagerAudio) : null;
    for (const [key, url] of Object.entries(manifest.audio)) {
      if (this.audio.has(key)) continue;
      const a = new Audio();
      a.preload = !eager || eager.has(key) ? "auto" : "metadata";
      a.src = url;
      this.audioUrls.set(key, url);
      a.addEventListener("error", () => this.audioFailed(key, a));
      this.audio.set(key, a);
    }
    this.hookOnline();

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
    // Entering a room is a second chance for what failed before (a blip, a dropped link).
    this.retryFailed(wanted, LOAD_TIMING.retryAgainMs);
    this.retryAudio(LOAD_TIMING.retryAgainMs);
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
    // A background that is only the painted fallback does not count as loaded.
    if ((this.images.has(key) && !this.fallbackKeys.has(key)) || this.failed.has(key)) {
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
        this.fallbackKeys.delete(job.key);
        this.failed.delete(job.key);
        this.failedAt.delete(job.key);
        return;
      }
      if (attempt < ATTEMPTS) await delay(LOAD_TIMING.retryDelayMs * attempt);
    }
    console.warn("image failed after retries:", job.key, job.url);
    this.failed.add(job.key);
    this.failedAt.set(job.key, now());
    // A missing plate must not leave the room black: paint a quiet fallback under the scene.
    if (job.key.startsWith("bg_") && !this.images.has(job.key)) {
      const fallback = await this.fallbackImage();
      if (fallback && !this.images.has(job.key)) {
        this.images.set(job.key, fallback);
        this.fallbackKeys.add(job.key);
      }
    }
  }

  /**
   * Stop waiting for these backgrounds: show the painted fallback plate now (the curtain has
   * waited as long as it will). The real image keeps loading and replaces the fallback if it
   * arrives. Returns once the fallback is in place.
   */
  async giveUp(keys: Iterable<string>): Promise<void> {
    const pending = [...keys].filter((k) => k.startsWith("bg_") && !this.images.has(k));
    if (!pending.length) return;
    const fallback = await this.fallbackImage();
    if (!fallback) return;
    for (const key of pending) {
      if (this.images.has(key)) continue;   // it arrived while the fallback was being made
      this.images.set(key, fallback);
      this.fallbackKeys.add(key);
    }
  }

  /**
   * Give images that failed for good another go: `keys` (or all of them), no sooner than
   * `minAgeMs` after they last failed. They re-enter the queue as fresh jobs; a background
   * keeps its painted fallback until the real plate arrives.
   */
  retryFailed(keys?: Iterable<string>, minAgeMs = 0): void {
    const retried: string[] = [];
    for (const key of keys ? [...keys] : [...this.failed]) {
      if (!this.failed.has(key) || !this.catalog.has(key)) continue;
      if (now() - (this.failedAt.get(key) ?? -Infinity) < minAgeMs) continue;
      this.failed.delete(key);
      this.jobs.delete(key);
      retried.push(key);
    }
    for (const key of retried) this.enqueue(key, this.catalog.get(key)!);
    if (retried.length) this.pump();
  }

  // ------------------------------------------------------------------ audio retries

  private audioFailed(key: string, el: HTMLAudioElement): void {
    const url = this.audioUrls.get(key) ?? el.src;
    const tries = (this.audioTries.get(key) ?? 0) + 1;
    this.audioTries.set(key, tries);
    if (tries < AUDIO_ATTEMPTS) {
      setTimeout(() => { el.src = retryUrl(url, tries + 1); el.load(); }, LOAD_TIMING.retryDelayMs * tries * 4);
      return;
    }
    console.warn("audio failed after retries:", key, url);
    this.audioGaveUp.add(key);
    this.audioGaveUpAt = now();
    // One notice for the whole set, and a quiet one: the game plays on without the music.
    if (!this.audioNoticed) {
      this.audioNoticed = true;
      this.onNotice?.("The music could not be loaded. The voyage goes on without it; it will try again when the connection settles.");
    }
  }

  /** Try the tracks that failed again (the connection came back, or a room was entered). */
  retryAudio(minAgeMs = 0): void {
    if (!this.audioGaveUp.size || now() - this.audioGaveUpAt < minAgeMs) return;
    for (const key of [...this.audioGaveUp]) {
      const el = this.audio.get(key);
      const url = this.audioUrls.get(key);
      if (!el || !url) continue;
      this.audioGaveUp.delete(key);
      this.audioTries.set(key, AUDIO_ATTEMPTS - 1);   // one more attempt, then it is given up again
      el.src = retryUrl(url, 9);
      el.load();
    }
    this.audioGaveUpAt = now();
  }

  /** When the browser says the network is back, retry whatever failed. */
  private hookOnline(): void {
    if (this.onlineHooked || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    this.onlineHooked = true;
    window.addEventListener("online", () => { this.retryFailed(); this.retryAudio(); });
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

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Load one image. Where `fetch` can stream, the bytes are read chunk by chunk and the stall
 * deadline restarts with each one, so a slow connection is waited for as long as bytes keep
 * coming and a dead one is abandoned `stallMs` after the last. Anywhere that cannot (no fetch,
 * a cross-origin host without CORS) it falls back to a plain <img> with a longer total deadline.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof fetch === "function" && !url.startsWith("data:") && !url.startsWith("blob:")) {
    const blob = await readStalled(url);
    if (blob === null) return null;
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      const img = await loadDirect(objectUrl, LOAD_TIMING.directMs);
      URL.revokeObjectURL(objectUrl);
      return img;
    }
  }
  return loadDirect(url, LOAD_TIMING.directMs);
}

/**
 * The bytes of `url`, with a stall deadline: a Blob when read, null when it failed (an HTTP
 * error, or no bytes for `stallMs`), undefined when streaming is not possible here.
 */
async function readStalled(url: string): Promise<Blob | null | undefined> {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stalled = false;
  const arm = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => { stalled = true; ctl?.abort(); }, LOAD_TIMING.stallMs);
  };
  try {
    arm();
    const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    const reader = res.body?.getReader?.();
    if (!reader) {
      const blob = await res.blob();
      return blob;
    }
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
      arm();
    }
    return new Blob(chunks as BlobPart[], { type });
  } catch {
    // A stall or an abort is a failed attempt; any other error (offline, CORS) may still be
    // loadable as a plain <img>, which the caller tries.
    return stalled ? null : undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** A plain <img> load with a total deadline (it reports no progress to restart a clock on). */
function loadDirect(url: string, totalMs: number): Promise<HTMLImageElement | null> {
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
    const timer = setTimeout(() => finish(null), totalMs);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/** A retry of a cached 404 needs a different URL or the browser may answer from its cache. */
export function retryUrl(url: string, attempt: number): string {
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}retry=${attempt}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

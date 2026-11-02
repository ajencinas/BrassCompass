/** Asset loading with progress reporting. */

export interface AssetManifest {
  images: Record<string, string>;
  audio: Record<string, string>;
}

export class Assets {
  readonly images = new Map<string, HTMLImageElement>();
  readonly audio = new Map<string, HTMLAudioElement>();
  private loaded = 0;
  private total = 0;

  async load(manifest: AssetManifest, onProgress: (p: number) => void): Promise<void> {
    this.total = Object.keys(manifest.images).length + Object.keys(manifest.audio).length;
    this.loaded = 0;

    const jobs: Promise<void>[] = [];

    for (const [key, url] of Object.entries(manifest.images)) {
      jobs.push(
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.images.set(key, img);
            this.tick(onProgress);
            resolve();
          };
          img.onerror = () => {
            console.warn("image failed:", key, url);
            this.tick(onProgress);
            resolve();
          };
          img.src = url;
        })
      );
    }

    for (const [key, url] of Object.entries(manifest.audio)) {
      jobs.push(
        new Promise<void>((resolve) => {
          const a = new Audio();
          a.preload = "auto";
          a.src = url;
          const done = () => {
            this.audio.set(key, a);
            this.tick(onProgress);
            resolve();
          };
          a.addEventListener("canplaythrough", done, { once: true });
          a.addEventListener("error", () => {
            console.warn("audio failed:", key, url);
            this.tick(onProgress);
            resolve();
          }, { once: true });
          // Don't let a stuck network request block boot forever.
          setTimeout(done, 6000);
        })
      );
    }

    await Promise.all(jobs);
  }

  private tick(onProgress: (p: number) => void): void {
    this.loaded++;
    onProgress(this.total === 0 ? 1 : this.loaded / this.total);
  }

  img(key: string): HTMLImageElement | undefined {
    return this.images.get(key);
  }

  private boundsCache = new Map<string, Bounds[]>();

  /**
   * Opaque extents of each cell of a horizontal strip (a single image is one cell), so figures
   * are anchored by their real feet rather than the transparent padding diffusion leaves around
   * them. Generated sheets are not reliably baseline-aligned, so every cell is measured on its own.
   */
  frameBounds(key: string, frames = 1): Bounds[] | undefined {
    const id = `${key}#${frames}`;
    const cached = this.boundsCache.get(id);
    if (cached) return cached;
    const img = this.images.get(key);
    if (!img || !img.width) return undefined;

    // Measure a downscaled copy; full-size sheets are ~5M pixels.
    const step = Math.max(1, Math.floor(Math.max(img.width, img.height) / 768));
    const w = Math.ceil(img.width / step), h = Math.ceil(img.height / step);
    let data: Uint8ClampedArray;
    try {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const cx = c.getContext("2d", { willReadFrequently: true })!;
      cx.drawImage(img, 0, 0, w, h);
      data = cx.getImageData(0, 0, w, h).data;
    } catch {
      return undefined;
    }
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
        const cell = img.width / frames;
        out.push({ top: 0, bottom: img.height, left: f * cell, right: (f + 1) * cell, torso: (f + 0.5) * cell });
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
        bottom: Math.min(img.height, (bottom + 1) * step),
        left: left * step,
        right: Math.min(img.width, (right + 1) * step),
        torso: tr >= tl ? ((tl + tr + 1) / 2) * step : ((left + right + 1) / 2) * step,
      });
    }
    this.boundsCache.set(id, out);
    return out;
  }
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

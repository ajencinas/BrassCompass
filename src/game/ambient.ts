/**
 * Atmosphere: the painted world given a little life. Lanterns breathe, harbour water moves,
 * dust turns in a moonbeam, fog rolls through, embers lift off a fire and a lighthouse sweeps
 * the sea. All of it comes from the room's script (`light`, `water`, `haze`, `motes`, `beacon`,
 * `stars`); none of it changes what the player can do.
 *
 * What the prototype taught, tried on every plate:
 *  - A lamp's glow is a soft radial sprite in `screen` mode at about 0.2 alpha, flickering
 *    ±15%. Any brighter and the scene looks filtered rather than lit.
 *  - Water moves by redrawing the painting's own water in 4 px strips nudged a pixel or two
 *    sideways. Its polygon must leave out hulls, posts and people, or they wobble too.
 *  - Glints belong on sunlit water; on night water they read as noise.
 *  - A lighthouse beam is a soft, pre-blurred sprite; a hard wedge looks like a laser.
 *  - Fog joins the depth sort at its floor line, so it hangs between things, not over them.
 *
 * The room's plate is drawn from here as well: graded by its `backdrop` once, into an offscreen
 * canvas (by hand where a canvas ignores filters), so a frame pays for a plain blit, and
 * occluders repaint just their own corner of it.
 *
 * Reduced motion: glows hold at their mean, the beacon is a steady lamp, fog stands still, and
 * the water, motes and twinkling stop. Nothing here allocates per frame: sprites, paths,
 * textures and particle seeds are made once per room (or once per colour).
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H } from "../engine/view";
import type { Poly } from "../engine/walkbox";
import { ROOMS } from "../content/rooms";
import { applyGradeByHand, filterSupported } from "./figures";
import type { Cond, LightKind, MoteKind, Room, RoomHaze, RoomLight, RoomMotes, RoomWater } from "./types";

export interface AmbientHost {
  /** The image for an asset key, once it has arrived. */
  image(key: string): HTMLImageElement | undefined;
  /** Whether a story condition holds: a light with `if` only shows while it does. */
  check(cond: Cond): boolean;
}

/** Where the scene is seen from, this frame. */
export interface AmbientView {
  /** World x of the screen's left edge. */
  cameraX: number;
  /** Seconds of game time; it stops while the game is paused. */
  time: number;
  /** Reduced motion: hold everything still. */
  reduced: boolean;
}

/** An entry in the game's depth sort, drawn in order of `y` (where it meets the floor). */
export interface Drawable { y: number; draw: () => void }

/** The room whose plate is the title screen's background. */
const TITLE_ROOM = "dock";

type Rgb = readonly [number, number, number];

// ------------------------------------------------------------ tuning

/** How a kind of light breathes. `amp` is the flicker's peak-to-peak depth, as a fraction of `alpha`. */
interface Breath { rgb: Rgb; alpha: number; amp: number; speed: number; jitter: number }
const BREATH: Record<LightKind, Breath> = {
  lantern: { rgb: [255, 178, 96], alpha: 0.22, amp: 0.3, speed: 1, jitter: 0 },
  candle: { rgb: [255, 196, 120], alpha: 0.24, amp: 0.4, speed: 1.6, jitter: 0 },
  fire: { rgb: [255, 128, 52], alpha: 0.28, amp: 0.35, speed: 1.3, jitter: 4 },
  lamp: { rgb: [255, 214, 150], alpha: 0.16, amp: 0.04, speed: 0.3, jitter: 0 },
  moon: { rgb: [170, 196, 255], alpha: 0.1, amp: 0, speed: 0, jitter: 0 },
};
/** Three incommensurate sines (radians a second at speed 1) and their weights: a flicker that never visibly repeats. */
const FLICKER_W = [2.3, 5.9, 13.7] as const;
const FLICKER_A = [0.55, 0.3, 0.15] as const;

/**
 * Photosensitivity (WCAG 2.3.1): a light this big covers enough of the screen to matter, so
 * its glow changes by under 6% peak to peak (a flash is 10%) and no part of it beats faster
 * than 3 Hz.
 */
const BIG_LIGHT = 200;
const BIG_P2P = 0.06;
const BIG_HZ = 3;

/** Water is redrawn in strips this tall. */
const STRIP = 4;

/** Fog repeats every this many world pixels, and its texture is stored this much smaller. */
const FOG_TILE = 1024;
const FOG_SCALE = 4;
const FOG_TINT = "#c9d2dc";

/** Motes fade out over this many pixels as they reach the edge of their area. */
const EDGE_FADE = 28;

const MOTE_RGB: Record<MoteKind, Rgb> = {
  dust: [236, 228, 208],
  embers: [255, 150, 60],
  steam: [226, 229, 232],
  glints: [255, 244, 214],
};

/** The lighthouse beam: how far it reaches when it's side-on, and how wide it is at the far end. */
const BEAM_LEN = 1500;
const BEAM_W = 110;
const BEAM_RGB: Rgb = [255, 236, 186];

const STAR_PHASES = 6;
const STAR_LEVELS = 4;

// ------------------------------------------------------------ small helpers

const TAU = Math.PI * 2;
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function lcg(seed: number): () => number {
  let s = (Math.floor(Math.abs(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A stable number in [0,1) for a position, so each light has its own phase. */
function hash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function rgbOf(hex: string): Rgb {
  const h = hex.length === 4 ? hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex.slice(1, 7);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const glows = new Map<string, HTMLCanvasElement>();
/** A soft round glow of one colour, hottest at the centre; drawn scaled to each light's radius. */
function glowSprite(rgb: Rgb): HTMLCanvasElement {
  const key = rgb.join(",");
  const hit = glows.get(key);
  if (hit) return hit;
  const size = 256, c = canvas(size, size), cx = c.getContext("2d")!;
  const g = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const rgba = (a: number): string => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  g.addColorStop(0, rgba(1));
  g.addColorStop(0.18, rgba(0.55));
  g.addColorStop(0.5, rgba(0.16));
  g.addColorStop(1, rgba(0));
  cx.fillStyle = g;
  cx.fillRect(0, 0, size, size);
  glows.set(key, c);
  return c;
}

let beam: HTMLCanvasElement | null = null;
/**
 * The lighthouse beam, pointing right from its origin at the left-middle: a wedge with soft
 * Gaussian sides that fades along its length. Soft by construction, so it never needs a blur.
 */
function beamSprite(): HTMLCanvasElement {
  if (beam) return beam;
  const w = 512, h = 64, c = canvas(w, h), cx = c.getContext("2d")!;
  const im = cx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5 - h / 2) / (h / 2);
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const half = 0.08 + 0.92 * u;
      const across = Math.exp(-3 * (v / half) * (v / half));
      const along = Math.pow(1 - u, 1.5) * Math.min(1, u / 0.03);
      const i = (y * w + x) * 4;
      im.data[i] = BEAM_RGB[0]; im.data[i + 1] = BEAM_RGB[1]; im.data[i + 2] = BEAM_RGB[2];
      im.data[i + 3] = Math.round(255 * across * along);
    }
  }
  cx.putImageData(im, 0, 0);
  return (beam = c);
}

// ------------------------------------------------------------ polygons

/** A polygon with its path and bounds, rebuilt if the editor drags a point. */
interface Shape { poly: Poly; sig: number; path: Path2D; x0: number; y0: number; x1: number; y1: number }

function signature(poly: Poly): number {
  let s = poly.length;
  for (let i = 0; i < poly.length; i++) s = (s * 31 + poly[i].x * 7.13 + poly[i].y * 3.71) % 1e9;
  return s;
}
function shape(poly: Poly): Shape {
  return fresh({ poly, sig: NaN, path: new Path2D(), x0: 0, y0: 0, x1: 0, y1: 0 });
}
function fresh(s: Shape): Shape {
  const sig = signature(s.poly);
  if (sig === s.sig) return s;
  s.sig = sig;
  s.path = new Path2D();
  s.x0 = s.y0 = Infinity;
  s.x1 = s.y1 = -Infinity;
  s.poly.forEach((p, i) => {
    if (i) s.path.lineTo(p.x, p.y); else s.path.moveTo(p.x, p.y);
    s.x0 = Math.min(s.x0, p.x); s.y0 = Math.min(s.y0, p.y);
    s.x1 = Math.max(s.x1, p.x); s.y1 = Math.max(s.y1, p.y);
  });
  s.path.closePath();
  return s;
}
function inside(poly: Poly, x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** Distance from a point to the nearest edge of a polygon. */
function edgeDistance(poly: Poly, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? clamp01(((x - a.x) * dx + (y - a.y) * dy) / len2) : 0;
    const ex = a.x + t * dx - x, ey = a.y + t * dy - y;
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
}
function area(poly: Poly): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  return Math.abs(s) / 2;
}

// ------------------------------------------------------------ a prepared room

interface LiveLight { src: RoomLight; sprite: HTMLCanvasElement; alpha: number; amp: number; speed: number; jitter: number; phase: number }
/** `scratch` is this water's own canvas: sharing one between waters would force a copy each time. */
interface LiveWater { src: RoomWater; shape: Shape; scratch: CanvasRenderingContext2D | null }
interface LiveHaze { src: RoomHaze; tex: HTMLCanvasElement[] | null; drawable: Drawable }
/** Particles as numbers only: STRIDE seeds each, made once; positions are pure functions of time. */
interface LiveMotes { src: RoomMotes; shape: Shape; n: number; seeds: Float32Array; rgb: Rgb; sprite: HTMLCanvasElement; tinted: boolean; style: string }
interface Sky { width: number; maxY: number; groups: { path: Path2D; alpha: number; phase: number }[]; moon: CanvasGradient | null }

const STRIDE = 8;

interface Scene {
  room: Room;
  lights: LiveLight[];
  water: LiveWater[];
  haze: LiveHaze[];
  motes: LiveMotes[];
  sky: Sky | null;
  occluders: Map<Poly, Shape>;
}

function liveLight(l: RoomLight): LiveLight {
  const b = BREATH[l.kind];
  let amp = b.amp, speed = b.speed;
  if (l.radius >= BIG_LIGHT) {
    amp = Math.min(amp, BIG_P2P / b.alpha);
    speed = Math.min(speed, (BIG_HZ * TAU) / FLICKER_W[2] * 0.95);
  }
  return {
    src: l, sprite: glowSprite(l.colour ? rgbOf(l.colour) : b.rgb),
    alpha: b.alpha, amp, speed, jitter: b.jitter, phase: hash(l.at.x * 0.37 + l.at.y) * 100,
  };
}

/** Seeds for a set of motes. Dust drifts through its whole area; the rest start inside it. */
function liveMotes(m: RoomMotes, index: number): LiveMotes {
  const s = shape(m.area);
  const rand = lcg(1 + index * 7919 + Math.round(s.x0 * 13 + s.y0 * 7));
  const w = s.x1 - s.x0, h = s.y1 - s.y0;
  // Dust is tested against the polygon every frame, so it gets enough candidates that about
  // `count` of them are inside at once. The others are placed inside it once, here.
  const n = m.kind === "dust" ? Math.min(m.count * 4, Math.ceil((m.count * w * h) / Math.max(1, area(m.area)))) : m.count;
  const seeds = new Float32Array(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    let u = rand(), v = rand();
    if (m.kind !== "dust") {
      for (let k = 0; k < 40 && !inside(m.area, s.x0 + u * w, s.y0 + v * h); k++) { u = rand(); v = rand(); }
    }
    seeds[o] = u;
    seeds[o + 1] = v;
    seeds[o + 2] = rand() * TAU;   // phase
    seeds[o + 3] = rand();         // size
    seeds[o + 4] = rand();         // speed or life
    seeds[o + 5] = rand();         // drift
    seeds[o + 6] = rand();         // rise or width
    seeds[o + 7] = rand();         // offset in its life
  }
  const rgb = MOTE_RGB[m.kind];
  return { src: m, shape: s, n, seeds, rgb, sprite: glowSprite(rgb), tinted: false, style: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` };
}

/** The night sky: the same scatter of stars as ever, grouped by twinkle phase and brightness. */
function skyOf(width: number, maxY: number): Sky {
  let seed = 7;
  const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bins = Array.from({ length: STAR_PHASES * STAR_LEVELS }, () => ({ path: new Path2D(), sum: 0, n: 0, phase: 0 }));
  for (let i = 0; i < Math.round(width / 9); i++) {
    const x = rand() * width, y = rand() * maxY, r = 0.6 + rand() * 1.6, phase = rand() * 6.3;
    const a = (0.5 + 0.5 * rand()) * (1 - (0.7 * y) / maxY);
    const p = Math.min(STAR_PHASES - 1, Math.floor((phase / 6.3) * STAR_PHASES));
    const l = Math.min(STAR_LEVELS - 1, Math.floor(a * STAR_LEVELS));
    const bin = bins[p * STAR_LEVELS + l];
    bin.path.moveTo(x + r, y);
    bin.path.arc(x, y, r, 0, TAU);
    bin.sum += a;
    bin.n++;
    bin.phase = ((p + 0.5) / STAR_PHASES) * 6.3;
  }
  return {
    width, maxY, moon: null,
    groups: bins.filter((b) => b.n).map((b) => ({ path: b.path, alpha: b.sum / b.n, phase: b.phase })),
  };
}

// ------------------------------------------------------------ fog

/** Smooth value noise in [0,1] from a grid of `gw`×`gh` random values, wrapping in x. */
function noise(grid: Float32Array, gw: number, gh: number, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = mod(xi, gw), x1 = (x0 + 1) % gw;
  const y0 = Math.min(gh - 1, Math.max(0, yi)), y1 = Math.min(gh - 1, y0 + 1);
  const a = grid[y0 * gw + x0], b = grid[y0 * gw + x1], c = grid[y1 * gw + x0], d = grid[y1 * gw + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * One layer of a fog band: banks and wisps of value noise in the band's tint, faded in at the
 * top and out at the bottom, repeating seamlessly every FOG_TILE pixels.
 */
function fogTexture(band: RoomHaze, seed: number, cells: number): HTMLCanvasElement {
  const w = FOG_TILE / FOG_SCALE, h = Math.max(4, Math.round((band.bottom - band.top) / FOG_SCALE));
  const c = canvas(w, h), cx = c.getContext("2d")!;
  const im = cx.createImageData(w, h);
  const rand = lcg(seed);
  const gw1 = cells, gh1 = 4, gw2 = cells * 3, gh2 = 7;
  const g1 = new Float32Array(gw1 * gh1).map(rand), g2 = new Float32Array(gw2 * gh2).map(rand);
  const [r, g, b] = rgbOf(band.tint ?? FOG_TINT);
  // Thickest from a little below the top down to the floor line, thinning away in front of it:
  // whoever stands behind the floor line is in the fog, whoever stands in front is not.
  const { top, bottom } = band;
  const thin = Math.min(band.floor, bottom - 0.2 * (bottom - top));
  const full = top + 0.3 * (Math.max(thin, top + 1) - top);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1), wy = top + v * (bottom - top);
    const mask = smooth(top, full, wy) * (1 - smooth(thin, bottom, wy));
    for (let x = 0; x < w; x++) {
      const n = 0.65 * noise(g1, gw1, gh1, (x / w) * gw1, v * (gh1 - 1)) + 0.35 * noise(g2, gw2, gh2, (x / w) * gw2, v * (gh2 - 1));
      const i = (y * w + x) * 4;
      im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b;
      // Banks and wisps over a thin veil, never quite clear.
      im.data[i + 3] = Math.round(255 * mask * (0.25 + 0.75 * smooth(0.2, 0.75, n)));
    }
  }
  cx.putImageData(im, 0, 0);
  return c;
}

// ------------------------------------------------------------ the layers

export class Ambient {
  private scene: Scene | null = null;
  private titleScene: Scene | null = null;
  private readonly titleView: AmbientView = { cameraX: 0, time: 0, reduced: false };

  /** What the plate is drawn from this frame: the image, or its graded bake. */
  private source: CanvasImageSource | undefined;
  private sourceW = 0;
  private sourceH = 0;
  private baked: HTMLCanvasElement | null = null;
  private lamp: HTMLCanvasElement | null = null;
  private bakedFrom: HTMLImageElement | null = null;
  private bakedCss = "";

  /** The context and view of the frame being drawn, for haze drawn from inside the depth sort. */
  private frameCtx: CanvasRenderingContext2D | null = null;
  private frameView: AmbientView | null = null;

  constructor(private readonly host: AmbientHost) {}

  /** A new room (or the same room recompiled): make its sprites, paths and seeds. */
  setRoom(room: Room): void {
    this.scene = this.prepare(room);
    if (!room.backdrop && this.baked) {
      // Hand the memory back: ~9 MB for a 2560×880 plate.
      this.baked.width = this.baked.height = 0;
      this.baked = this.bakedFrom = null;
      this.bakedCss = "";
    }
  }

  private prepare(room: Room): Scene {
    const scene: Scene = {
      room,
      lights: (room.lights ?? []).map(liveLight),
      water: (room.water ?? []).map((w) => ({ src: w, shape: shape(w.area), scratch: null })),
      haze: [],
      motes: (room.motes ?? []).map(liveMotes),
      sky: room.stars ? skyOf(room.width ?? LOGICAL_W, room.stars.y) : null,
      occluders: new Map((room.occluders ?? []).map((o) => [o.area, shape(o.area)])),
    };
    scene.haze = (room.haze ?? []).map((src, i) => {
      const live: LiveHaze = { src, tex: null, drawable: { y: src.floor, draw: () => this.drawHaze(live, i) } };
      return live;
    });
    return scene;
  }

  /**
   * The room's background, graded by its `backdrop` once and kept, or the image itself when it
   * has none. Undefined until the image has arrived.
   */
  plate(): CanvasImageSource | undefined {
    const room = this.scene?.room;
    const img = room ? this.host.image(room.bg) : undefined;
    this.source = undefined;
    if (!room || !img || !img.naturalWidth) return undefined;
    const css = (room.backdrop ?? "").trim();
    if (!css || css === "none") return this.use(img, img.naturalWidth, img.naturalHeight);
    if (this.baked && this.bakedFrom === img && this.bakedCss === css) return this.use(this.baked, this.baked.width, this.baked.height);
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = this.baked ?? canvas(w, h);
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    if (filterSupported()) {
      cx.filter = css;
      cx.drawImage(img, 0, 0);
      cx.filter = "none";
    } else {
      cx.drawImage(img, 0, 0);
      applyGradeByHand(cx, w, h, css);
    }
    this.baked = c;
    this.bakedFrom = img;
    this.bakedCss = css;
    return this.use(c, w, h);
  }

  private use(src: CanvasImageSource, w: number, h: number): CanvasImageSource {
    this.source = src;
    this.sourceW = w;
    this.sourceH = h;
    return src;
  }

  /** Repaint an occluder from the plate (just its own bounding box) over what stands behind it. */
  occlude(ctx: CanvasRenderingContext2D, o: { area: Poly }): void {
    const scene = this.scene, src = this.source;
    if (!scene || !src) return;
    let s = scene.occluders.get(o.area);
    if (!s) scene.occluders.set(o.area, (s = shape(o.area)));
    fresh(s);
    const worldW = scene.room.width ?? LOGICAL_W;
    const x0 = Math.max(0, Math.floor(s.x0)), y0 = Math.max(0, Math.floor(s.y0));
    const x1 = Math.min(worldW, Math.ceil(s.x1)), y1 = Math.min(SCENE_H, Math.ceil(s.y1));
    if (x1 <= x0 || y1 <= y0) return;
    const kx = this.sourceW / worldW, ky = this.sourceH / SCENE_H;
    ctx.save();
    ctx.clip(s.path);
    ctx.drawImage(src, x0 * kx, y0 * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  /**
   * After the plate, before anyone stands on it: the night sky, the beacon, moving water, and
   * what rises from things at the back of the room (glints on the water, embers off a brazier,
   * steam off a pot), which the figures standing in front of them must cover.
   */
  under(ctx: CanvasRenderingContext2D, view: AmbientView): void {
    const scene = this.scene;
    if (!scene) return;
    const left = view.cameraX, right = view.cameraX + LOGICAL_W;
    if (scene.sky) this.drawSky(ctx, scene.sky, view, left);
    if (scene.room.beacon) this.drawBeacon(ctx, scene.room.beacon, view);
    if (this.source) this.drawWater(ctx, scene, this.source, this.sourceW, this.sourceH, view, left, right);
    if (!view.reduced) {
      for (const m of scene.motes) if (m.src.kind !== "dust") this.drawMotes(ctx, m, view.time, left, right);
    }
  }

  /** Fog and smoke join the depth sort at their floor lines. */
  depth(drawables: Drawable[], ctx: CanvasRenderingContext2D, view: AmbientView): void {
    this.frameCtx = ctx;
    this.frameView = view;
    if (this.scene) for (const h of this.scene.haze) drawables.push(h.drawable);
  }

  /** Over the figures: the lights (which warm whoever passes them) and dust in the air. */
  over(ctx: CanvasRenderingContext2D, view: AmbientView): void {
    const scene = this.scene;
    if (!scene) return;
    const left = view.cameraX, right = view.cameraX + LOGICAL_W;
    this.drawLights(ctx, scene, view, left, right);
    if (!view.reduced) {
      for (const m of scene.motes) if (m.src.kind === "dust") this.drawMotes(ctx, m, view.time, left, right);
    }
  }

  /**
   * The title screen's background, alive: the dock's lanterns and its moving water. Draws in
   * title-screen coordinates over the dock's plate, which sits at `at` — by default where the
   * title draws it, cover-fitted to the screen's height and centred. Pass the same box if the
   * plate is drawn anywhere else (drifted or zoomed), or the water will be out of register.
   */
  title(ctx: CanvasRenderingContext2D, t: number, reduced: boolean, at?: { x: number; y: number; w: number; h: number }): void {
    const room = ROOMS[TITLE_ROOM];
    const img = room ? this.host.image(room.bg) : undefined;
    if (!room || !img || !img.naturalWidth) return;
    if (this.titleScene?.room !== room) this.titleScene = this.prepare(room);
    const scene = this.titleScene;
    // Where drawTitle puts the plate unless told otherwise: the screen's height, centred.
    const bw = at ? at.w : LOGICAL_H * (img.naturalWidth / img.naturalHeight), bh = at ? at.h : LOGICAL_H;
    const bx = at ? at.x : (LOGICAL_W - bw) / 2, by = at ? at.y : 0;
    const worldW = room.width ?? LOGICAL_W;
    const kx = bw / worldW, ky = bh / SCENE_H;
    const left = Math.max(0, -bx / kx), right = Math.min(worldW, (LOGICAL_W - bx) / kx);
    const view = this.titleView;
    view.cameraX = left;
    view.time = t;
    view.reduced = reduced;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(kx, ky);
    this.drawWater(ctx, scene, img, img.naturalWidth, img.naturalHeight, view, left, right);
    this.drawLights(ctx, scene, view, left, right);
    ctx.restore();
  }

  // ---------------------------------------------------------- drawing

  private drawLights(ctx: CanvasRenderingContext2D, scene: Scene, view: AmbientView, left: number, right: number): void {
    if (!scene.lights.length) return;
    const t = view.time;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const l of scene.lights) {
      const { at, radius } = l.src;
      if (at.x + radius < left || at.x - radius > right) continue;
      if (l.src.showIf && !this.holds(l.src.showIf)) continue;
      let f = 1, jitter = 0;
      if (!view.reduced && l.amp) {
        const s = l.speed, p = l.phase;
        const v = FLICKER_A[0] * Math.sin(t * FLICKER_W[0] * s + p) + FLICKER_A[1] * Math.sin(t * FLICKER_W[1] * s + p * 0.37)
          + FLICKER_A[2] * Math.sin(t * FLICKER_W[2] * s + p * 0.61);
        f = 1 + 0.5 * l.amp * v;
        if (l.jitter) jitter = l.jitter * Math.sin(t * 7.3 + p);
      }
      const r = radius * (1 + 0.04 * (f - 1));
      ctx.globalAlpha = l.alpha * f;
      ctx.drawImage(l.sprite, at.x - r + jitter, at.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  private holds(list: Cond[]): boolean {
    for (let i = 0; i < list.length; i++) if (!this.host.check(list[i])) return false;
    return true;
  }

  /**
   * The painting's own water, redrawn in strips that sway a little, more near the viewer. The
   * strips go into the water's own scratch canvas, which is masked by the polygon once and
   * blitted once: clipping each strip to the polygon costs a great deal more (2.7 ms a frame on
   * the dock, on an integrated GPU, against too little to measure).
   */
  private drawWater(ctx: CanvasRenderingContext2D, scene: Scene, src: CanvasImageSource, srcW: number, srcH: number,
    view: AmbientView, left: number, right: number): void {
    if (view.reduced || !scene.water.length) return;
    const t = view.time;
    const worldW = scene.room.width ?? LOGICAL_W;
    const kx = srcW / worldW, ky = srcH / SCENE_H;
    for (const w of scene.water) {
      const s = fresh(w.shape);
      const x0 = Math.floor(Math.max(s.x0, left, 0)), x1 = Math.ceil(Math.min(s.x1, right, worldW));
      const y0 = Math.floor(Math.max(s.y0, 0)), y1 = Math.ceil(Math.min(s.y1, SCENE_H));
      if (x1 <= x0 || y1 <= y0) continue;
      const bw = x1 - x0, bh = y1 - y0, span = Math.max(1, s.y1 - s.y0);
      let sc = w.scratch;
      if (!sc || sc.canvas.width < bw || sc.canvas.height < bh) {
        sc = w.scratch = canvas(Math.ceil(s.x1 - s.x0) + 2, Math.ceil(s.y1 - s.y0) + 2).getContext("2d")!;
      }
      sc.globalCompositeOperation = "source-over";
      sc.clearRect(0, 0, bw, bh);
      for (let y = y0; y < y1; y += STRIP) {
        const depth = (y - s.y0) / span;   // 0 at the far edge, 1 nearest the viewer
        const a = w.src.ripple * (0.35 + 0.65 * depth);
        const dx = a * Math.sin(t * 1.7 + y * (0.16 - 0.08 * depth)) + 0.5 * a * Math.sin(t * 0.9 - y * 0.05);
        const h = Math.min(STRIP, y1 - y);
        sc.drawImage(src, x0 * kx, y * ky, bw * kx, h * ky, dx, y - y0, bw, h);
      }
      sc.globalCompositeOperation = "destination-in";
      sc.translate(-x0, -y0);
      sc.fill(s.path);
      sc.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sc.canvas, 0, 0, bw, bh, x0, y0, bw, bh);
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D, sky: Sky, view: AmbientView, left: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    if (!sky.moon) {
      sky.moon = ctx.createRadialGradient(sky.width * 0.5, sky.maxY * 0.3, 0, sky.width * 0.5, sky.maxY * 0.3, sky.maxY * 1.1);
      sky.moon.addColorStop(0, "rgba(170,190,240,0.22)");
      sky.moon.addColorStop(1, "rgba(170,190,240,0)");
    }
    ctx.fillStyle = sky.moon;
    ctx.fillRect(left, 0, LOGICAL_W, sky.maxY * 1.5);
    ctx.fillStyle = "rgb(235,240,255)";
    for (const g of sky.groups) {
      ctx.globalAlpha = g.alpha * (view.reduced ? 0.75 : 0.75 + 0.25 * Math.sin(view.time * 1.3 + g.phase));
      ctx.fill(g.path);
    }
    ctx.restore();
  }

  /**
   * A lighthouse lamp turning once every `period` seconds, seen from the side: the beam is long
   * when side-on, short as it swings toward or away from the viewer, fades as it turns away,
   * and the lamp swells as it faces us.
   */
  private drawBeacon(ctx: CanvasRenderingContext2D, b: { at: { x: number; y: number }; period: number }, view: AmbientView): void {
    const { x, y } = b.at;
    const lamp = (this.lamp ??= glowSprite(BEAM_RGB));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    if (view.reduced) {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(lamp, x - 130, y - 130, 260, 260);
      ctx.restore();
      return;
    }
    const a = TAU * (view.time / b.period + 0.3);
    const c = Math.cos(a), s = Math.sin(a);   // s > 0: turning toward the viewer
    const len = BEAM_LEN * (0.12 + 0.88 * Math.abs(c));
    const alpha = 0.3 * smooth(-0.6, 0.2, s);
    if (alpha > 0.002) {
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(-0.2 * s, c));
      ctx.globalAlpha = alpha;
      ctx.drawImage(beamSprite(), 0, -BEAM_W / 2, len, BEAM_W);
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const face = Math.max(0, s);
    ctx.globalAlpha = 0.16 + 0.5 * face * face * face;
    ctx.drawImage(lamp, x - 130, y - 130, 260, 260);
    ctx.restore();
  }

  private drawHaze(h: LiveHaze, index: number): void {
    const ctx = this.frameCtx, view = this.frameView;
    if (!ctx || !view) return;
    h.tex ??= [fogTexture(h.src, 101 + index * 31, 5), fogTexture(h.src, 211 + index * 17, 3)];
    const t = view.reduced ? 0 : view.time;
    const height = h.src.bottom - h.src.top;
    ctx.save();
    for (let layer = 0; layer < 2; layer++) {
      const shift = mod(t * h.src.speed * (layer ? 1.7 : 1) + layer * 377, FOG_TILE);
      ctx.globalAlpha = h.src.alpha * (layer ? 0.5 : 0.65);
      let x = shift + Math.floor((view.cameraX - shift) / FOG_TILE) * FOG_TILE;
      for (; x < view.cameraX + LOGICAL_W; x += FOG_TILE) ctx.drawImage(h.tex[layer], x, h.src.top, FOG_TILE, height);
    }
    ctx.restore();
  }

  /** Dust, embers, steam and glints: every position a pure function of its seeds and the time. */
  private drawMotes(ctx: CanvasRenderingContext2D, m: LiveMotes, t: number, left: number, right: number): void {
    const s = fresh(m.shape);
    if (s.x1 < left - 200 || s.x0 > right + 200) return;
    if (!m.tinted && this.source) this.tint(m);
    const w = s.x1 - s.x0, h = s.y1 - s.y0, seeds = m.seeds, poly = m.src.area;
    ctx.save();
    ctx.globalCompositeOperation = m.src.kind === "embers" ? "lighter" : "screen";
    ctx.fillStyle = m.style;
    for (let i = 0; i < m.n; i++) {
      const o = i * STRIDE;
      const u = seeds[o], v = seeds[o + 1], ph = seeds[o + 2], size = seeds[o + 3];
      switch (m.src.kind) {
        case "dust": {
          // Drifting slowly through the beam, sinking a little, never quite still.
          const vx = (seeds[o + 4] - 0.5) * 6, vy = 1 + seeds[o + 5] * 4;
          const x = s.x0 + mod(u * w + vx * t + 8 * Math.sin(0.3 * t + ph), w);
          const y = s.y0 + mod(v * h + vy * t + 5 * Math.sin(0.23 * t + 1.3 * ph), h);
          if (x < left || x > right || !inside(poly, x, y)) continue;
          const fade = Math.min(1, edgeDistance(poly, x, y) / EDGE_FADE);
          ctx.globalAlpha = 0.7 * (0.55 + 0.45 * Math.sin(0.8 * t + ph)) * fade;
          const r = 2.4 + size * 4.4;
          ctx.drawImage(m.sprite, x - r, y - r, r * 2, r * 2);
          break;
        }
        case "embers": {
          // Up off the fire, wandering, cooling as they go.
          const life = 2.2 + seeds[o + 4] * 1.8;
          const age = mod(t / life + seeds[o + 7], 1);
          const x = s.x0 + u * w + Math.sin(1.3 * t + ph) * 18 * age + (seeds[o + 5] - 0.3) * 60 * age;
          const y = s.y0 + v * h - age * (260 + seeds[o + 6] * 160);
          if (x < left || x > right) continue;
          ctx.globalAlpha = (1 - age) * (0.65 + 0.35 * Math.sin(17 * t + ph));
          const r = (3 + size * 4) * (1 - 0.45 * age);
          ctx.drawImage(m.sprite, x - r, y - r, r * 2, r * 2);
          break;
        }
        case "steam": {
          // Soft puffs that rise, swell and thin away.
          const life = 3 + seeds[o + 4] * 2;
          const age = mod(t / life + seeds[o + 7], 1);
          const x = s.x0 + u * w + (seeds[o + 5] - 0.5) * 40 * age + Math.sin(0.9 * t + ph) * 5 * age;
          const y = s.y0 + v * h - age * (60 + seeds[o + 6] * 70);
          if (x < left - 60 || x > right + 60) continue;
          ctx.globalAlpha = 0.16 * Math.sin(Math.PI * age);
          const r = (6 + size * 6) * (1 + 3.5 * age);
          ctx.drawImage(m.sprite, x - r, y - r, r * 2, r * 2);
          break;
        }
        case "glints": {
          // Sun on the water: still points that flash, briefly, each in its own time. Bigger and
          // longer nearer the viewer.
          const p = Math.sin((2 + seeds[o + 4] * 3) * t + ph);
          if (p < 0.8) continue;
          const k = (p - 0.8) / 0.2, flash = k * k;
          const x = s.x0 + u * w, y = s.y0 + v * h;
          if (x < left || x > right) continue;
          const len = 4 + (8 + 14 * seeds[o + 6]) * v, r = 4 + 5 * v;
          ctx.globalAlpha = 0.45 * flash;
          ctx.drawImage(m.sprite, x - r, y - r, r * 2, r * 2);
          ctx.globalAlpha = 0.9 * flash;
          ctx.fillRect(x - len / 2, y - 0.5, len, 1 + v);
          break;
        }
      }
    }
    ctx.restore();
  }

  /**
   * Dust takes the colour of the light it floats in: the plate's average inside its area,
   * brightened. Done once, when the plate has arrived.
   */
  private tint(m: LiveMotes): void {
    m.tinted = true;
    const scene = this.scene;
    if (m.src.kind !== "dust" || !scene || scene.motes.indexOf(m) < 0 || !this.source) return;
    try {
      const worldW = scene.room.width ?? LOGICAL_W;
      const k = 1 / 8, w = Math.ceil(worldW * k), h = Math.ceil(SCENE_H * k);
      const c = canvas(w, h), cx = c.getContext("2d", { willReadFrequently: true })!;
      cx.drawImage(this.source, 0, 0, w, h);
      const data = cx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inside(m.src.area, (x + 0.5) / k, (y + 0.5) / k)) continue;
        const i = (y * w + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      if (!n) return;
      const top = Math.max(r, g, b) / n || 1;
      const mix = (v: number): number => Math.round(0.45 * ((v / n) * 255) / top + 0.55 * 255);
      m.rgb = [mix(r), mix(g), mix(b)];
      m.sprite = glowSprite(m.rgb);
      m.style = `rgb(${m.rgb[0]},${m.rgb[1]},${m.rgb[2]})`;
    } catch { /* keep the default colour */ }
  }
}

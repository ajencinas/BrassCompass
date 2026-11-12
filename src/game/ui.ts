/**
 * UI — the verb panel, sentence line, inventory, dialogue overlay and cursor.
 * Layout constants are shared between drawing and hit-testing so they can
 * never drift apart.
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H } from "../engine/view";
import { drawText, wrap, fontOf, typewriterSlice, type TextStyle } from "../engine/text";
import { VERBS } from "./verbs";
import type { Rect, VerbId } from "./types";
import { hudHighContrast } from "./prefs";
import { brassInset, ENGRAVE_LIP } from "./plate";

export interface Chip {
  id: string;
  name: string;
  /** Item art (`item_<id>`), drawn beside a smaller name when there is some. */
  icon?: HTMLImageElement | null;
}

/** Slots per inventory page. Beyond this the panel pages. */
export const INV_PER_PAGE = 8;

export interface PanelModel {
  verb: VerbId | null;
  objA: string | null;
  objB: string | null;
  narration: string | null;
  narrationFull: string | null;
  /**
   * How much of the narration box shows: 1 while the line matters, falling to 0 once it has been
   * read, so the box stops covering the bottom of the scene. (The line stays in the history.)
   */
  narrationAlpha?: number;
  inventory: Chip[];
  /** Zero-based inventory page. */
  page: number;
  hoverVerb: VerbId | null;
  hoverItem: string | null;
  focusVerb: VerbId | null;
  focusItem: string | null;
  selectedItem: string | null;
  /** The natural verb for whatever the pointer is over: lit up as a suggestion. */
  suggestVerb: VerbId | null;
  /** "Talk to Marta": what a click on the hovered thing would do. */
  suggestLine: string | null;
  /** The hovered thing is a way out: a click walks through it. */
  suggestExit?: boolean;
  /**
   * What the pointer (or keyboard focus) is on while a sentence is being built: previews how it
   * would finish ("Use crowbar with impounded crate").
   */
  target?: string | null;
  /** UI text scale (1, 1.25, 1.5). Layout grows to fit. */
  scale: number;
  /** The last pointer was a finger: hints speak of taps. */
  touch: boolean;
  /** The player is playing by keyboard: hints speak of keys. */
  keyboard?: boolean;
  /** The line on screen is fully shown and something is waiting for a click. */
  waiting: boolean;
  /** Items just acquired, and how brightly each still glows (0..1). */
  fresh?: Record<string, number> | null;
  /** Seconds, for the glow's pulse. */
  time?: number;
  /** Reduced motion: the glow holds still. */
  reduced?: boolean;
}

export type PanelHit =
  | { kind: "verb"; id: VerbId }
  | { kind: "item"; id: string }
  | { kind: "page"; delta: number }
  | { kind: "sentence" }
  | null;

export function inventoryPages(count: number): number {
  return Math.max(1, Math.ceil(count / INV_PER_PAGE));
}

/** The items on the model's current page. */
export function pageItems(model: PanelModel): Chip[] {
  const page = Math.min(model.page, inventoryPages(model.inventory.length) - 1);
  return model.inventory.slice(page * INV_PER_PAGE, page * INV_PER_PAGE + INV_PER_PAGE);
}

// ---------------------------------------------------------------- layout

const PANEL_Y = SCENE_H;

const V_X = 40;
const V_W = 152;
const V_GAP_X = 6;

/**
 * The panel's vertical layout at a text scale. At 100% this is the original layout; larger
 * text makes the verb buttons taller and moves the sentence line down into the slack.
 */
function panelLayout(scale: number) {
  // 40, 47, 54, then no taller: past 150% the sentence line below would run off the bottom of
  // the screen, and the type inside a cell stops growing before the cell does.
  const vh = Math.round(40 + (Math.min(scale, 1.5) - 1) * 28);
  const gap = scale > 1 ? 6 : 8;
  const vy = scale > 1 ? 888 : 892;
  const sentY = vy + 2 * vh + gap + (scale > 1 ? 6 : 12);
  const line1 = Math.round(Math.min(34, 27 * scale));
  return {
    vy, vh, gap, sentY,
    /** Sentence line sizes: the main line, and the hint or second object below it. */
    line1,
    line2: Math.round(Math.min(23, 20 * scale)),
    line2Y: sentY + line1 + (scale > 1 ? 3 : 11),
  };
}

const SENT_X = 40;
const SENT_W = 940;

const INV_X = 1010;
const INV_Y = 918;
const INV_W = 205;
const INV_H = 68;
const INV_GAP = 8;
/**
 * Item art is fitted inside this box (the pocket is 205 x 74): wide enough that a long thin
 * thing, a crowbar or a spyglass, is not shrunk to a sliver by the height it shares with a
 * round one, and short enough to leave a margin above and below.
 */
const ICON_W = 96;
const ICON_H = 58;

export const COLORS = {
  verb: "#d6caa8",
  verbHover: "#fff6dc",
  verbActive: "#e8c98a",
  sentence: "#7fd6d0",
  narration: "#d8cfb8",
  item: "#c9a2e0",
  itemHover: "#f0dcff",
  gold: "#c9a24a",
};

export function verbRect(i: number, scale = 1): Rect {
  const l = panelLayout(scale);
  const col = i % 6;
  const row = Math.floor(i / 6);
  return {
    x: V_X + col * (V_W + V_GAP_X),
    y: l.vy + row * (l.vh + l.gap),
    w: V_W,
    h: l.vh,
  };
}

/** The largest size, from `size` down to `min`, at which `text` fits in `maxWidth`. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, min: number, weight = "normal"): number {
  for (; size > min; size--) {
    ctx.font = `${weight} ${size}px Georgia, "Times New Roman", serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  return size;
}

/** Chrome text, fitted to its plate: shrunk toward `min`, then cut with an ellipsis. */
export interface FittedText { text: string; size: number }

/**
 * The largest size at or below `size` at which `text` fits `maxWidth` (no smaller than `min`);
 * if even that will not do, the text is trimmed and given an ellipsis. Used by every fixed-width
 * piece of canvas chrome (the top bar, the room plate, banners, panel headings) so that a larger
 * text scale makes type bigger without ever spilling out of a button.
 */
export function fitText(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, min: number, weight = "normal"
): FittedText {
  const floor = Math.max(1, Math.min(Math.round(min), Math.round(size)));
  const at = fitSize(ctx, text, maxWidth, Math.max(1, Math.round(size)), floor, weight);
  ctx.font = `${weight} ${at}px Georgia, "Times New Roman", serif`;
  if (ctx.measureText(text).width <= maxWidth) return { text, size: at };
  let cut = text;
  while (cut.length > 1) {
    cut = cut.slice(0, -1).trimEnd();
    if (ctx.measureText(`${cut}…`).width <= maxWidth) break;
  }
  return { text: `${cut}…`, size: at };
}

function itemRect(i: number): Rect {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return {
    x: INV_X + col * (INV_W + INV_GAP),
    y: INV_Y + row * (INV_H + INV_GAP),
    w: INV_W,
    h: INV_H,
  };
}

/** Where slot `i` of an inventory page is drawn (for things that fly into it). */
export function inventorySlotRect(i: number): Rect {
  return itemRect(i % INV_PER_PAGE);
}

// Pager, only drawn when there is more than one page.
const PAGE_PREV = { x: 1680, y: 880, w: 44, h: 34 };
const PAGE_NEXT = { x: 1780, y: 880, w: 44, h: 34 };

/**
 * The pager buttons can hold keyboard focus too (they are part of the inventory group), so a
 * player never needs a pointer to turn a page. These ids are the focus handles for them.
 */
export const PAGE_FOCUS = { prev: "page:prev", next: "page:next" } as const;

export function isPageFocus(id: string | null | undefined): boolean {
  return id === PAGE_FOCUS.prev || id === PAGE_FOCUS.next;
}

function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function hitTestPanel(x: number, y: number, model: PanelModel): PanelHit {
  if (y < PANEL_Y) return null;

  for (let i = 0; i < VERBS.length; i++) {
    if (inRect(x, y, verbRect(i, model.scale))) return { kind: "verb", id: VERBS[i].id };
  }
  const shown = pageItems(model);
  for (let i = 0; i < shown.length; i++) {
    if (inRect(x, y, itemRect(i))) return { kind: "item", id: shown[i].id };
  }
  if (inventoryPages(model.inventory.length) > 1) {
    if (inRect(x, y, PAGE_PREV)) return { kind: "page", delta: -1 };
    if (inRect(x, y, PAGE_NEXT)) return { kind: "page", delta: 1 };
  }
  const l = panelLayout(model.scale);
  if (inRect(x, y, { x: SENT_X, y: l.sentY - 8, w: SENT_W, h: LOGICAL_H - l.sentY + 8 })) {
    return { kind: "sentence" };
  }
  return null;
}

// ---------------------------------------------------------------- text, measured once

/**
 * Wrapping measures every word, and the UI draws the same few lines every frame. Wrapped lines
 * are kept by text, width and font; a bounded map, since typed and hovered text comes and goes.
 */
const wrapped = new Map<string, string[]>();
function wrapOnce(ctx: CanvasRenderingContext2D, text: string, width: number, style: TextStyle): string[] {
  const key = `${fontOf(style)}|${width}|${text}`;
  let lines = wrapped.get(key);
  if (!lines) {
    lines = wrap(ctx, text, width, style);
    if (wrapped.size > 160) wrapped.delete(wrapped.keys().next().value!);
    wrapped.set(key, lines);
  }
  return lines;
}

/**
 * Draw the first `shown` characters of already-wrapped `lines`. Wrapping the whole line once and
 * revealing into it means a word never jumps to the next line as the typewriter reaches it.
 */
function drawRevealed(ctx: CanvasRenderingContext2D, lines: string[], shown: number, x: number, y: number,
  style: TextStyle & { lineHeight: number }): void {
  let left = shown;
  for (let i = 0; i < lines.length && left > 0; i++) {
    const line = lines[i];
    drawText(ctx, left >= line.length ? line : line.slice(0, left), x, y + i * style.lineHeight, style);
    left -= line.length + 1;
  }
}

// ---------------------------------------------------------------- drawing

/** The panel's gradients: built once per context rather than once a frame. */
const panelPaint = new WeakMap<CanvasRenderingContext2D, { back: CanvasGradient; shade: CanvasGradient }>();
function paint(ctx: CanvasRenderingContext2D) {
  let p = panelPaint.get(ctx);
  if (!p) {
    const back = ctx.createLinearGradient(0, PANEL_Y, 0, LOGICAL_H);
    back.addColorStop(0, "rgba(10,14,24,0.96)");
    back.addColorStop(1, "rgba(4,6,12,0.99)");
    const shade = ctx.createLinearGradient(0, PANEL_Y, 0, PANEL_Y + 26);
    shade.addColorStop(0, "rgba(0,0,0,0.55)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    p = { back, shade };
    panelPaint.set(ctx, p);
  }
  return p;
}

/** Draws the panel; returns where the narration box is, so the cursor label can keep clear. */
export function drawPanel(ctx: CanvasRenderingContext2D, model: PanelModel): { narrationBox: Rect | null } {
  const p = paint(ctx);
  ctx.fillStyle = p.back;
  ctx.fillRect(0, PANEL_Y, LOGICAL_W, LOGICAL_H - PANEL_Y);

  // gold rule along the top of the panel
  ctx.strokeStyle = "rgba(201,162,74,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PANEL_Y + 1);
  ctx.lineTo(LOGICAL_W, PANEL_Y + 1);
  ctx.stroke();

  // subtle inner shadow beneath the rule
  ctx.fillStyle = p.shade;
  ctx.fillRect(0, PANEL_Y, LOGICAL_W, 26);

  drawVerbs(ctx, model);
  const narrationBox = drawSentence(ctx, model);
  drawInventory(ctx, model);
  return { narrationBox };
}

/**
 * One type size for every verb at a text scale, the largest at which the longest label (set
 * bold, as the active one is) fits its plate with room to spare: twelve labels in three sizes
 * read as a mistake.
 */
const verbSizes = new Map<number, number>();
function verbSize(ctx: CanvasRenderingContext2D, scale: number): number {
  let size = verbSizes.get(scale);
  if (size === undefined) {
    const room = V_W - (scale > 1 ? 40 : 20);
    size = Math.round(21 * scale);
    for (const v of VERBS) size = Math.min(size, fitSize(ctx, v.label, room, Math.round(21 * scale), 16, "bold"));
    verbSizes.set(scale, size);
  }
  return size;
}

function drawVerbs(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  VERBS.forEach((v, i) => {
    const r = verbRect(i, model.scale);
    const active = model.verb === v.id;
    const hover = model.hoverVerb === v.id;
    const focused = model.focusVerb === v.id;
    const suggested = !active && model.suggestVerb === v.id;

    // The resting edge of a verb cell must be visible against the dark panel (it was 0.16 alpha,
    // below the 3:1 a control boundary needs); high contrast makes it a bold, bright line.
    const hc = hudHighContrast();
    ctx.fillStyle = hc ? "rgba(130,160,180,0.16)" : "rgba(130,160,180,0.07)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = hc ? "rgba(214,226,236,0.9)" : "rgba(160,184,198,0.42)";
    ctx.lineWidth = hc ? 2 : 1;
    ctx.strokeRect(r.x + ctx.lineWidth / 2, r.y + ctx.lineWidth / 2, r.w - ctx.lineWidth, r.h - ctx.lineWidth);
    // The title's brass-plate material inside that edge (plain in high contrast): a dark glass
    // pane, a bevel, studs. The cell's own border, fills and focus ring are drawn around it.
    if (!hc) brassInset(ctx, r.x, r.y, r.w, r.h, { hover: hover || suggested, active, rivets: true });
    if (active) {
      ctx.fillStyle = "rgba(201,162,74,0.16)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(232,201,138,0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
    } else if (suggested) {
      ctx.fillStyle = "rgba(232,201,138,0.13)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(232,201,138,0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
    } else if (hover) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (focused) {
      ctx.strokeStyle = "#fff3cf";
      ctx.lineWidth = hc ? 4 : 2.5;
      ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    }

    const weight = active ? "bold" : "normal";
    // A bigger text size centres the label with 20 px of clear plate each side, so it never
    // touches the bevel or the studs; at 100% it sits left with the plate's own margin.
    const size = verbSize(ctx, model.scale);
    // Engraved: a pale lip under the letters, as if cut into the plate.
    if (!hc) {
      drawText(ctx, v.label, r.x + (model.scale > 1 ? r.w / 2 : 14), r.y + Math.round((r.h - size) / 2), {
        size, color: ENGRAVE_LIP, weight, align: model.scale > 1 ? "center" : "left", shadow: false,
      });
    }
    drawText(ctx, v.label, r.x + (model.scale > 1 ? r.w / 2 : 14), r.y + Math.round((r.h - size) / 2) - 1, {
      size,
      color: focused || active || suggested ? COLORS.verbActive : hover || hc ? COLORS.verbHover : COLORS.verb,
      weight,
      align: model.scale > 1 ? "center" : "left",
      shadow: false,
    });
  });
}

/** The narration, as a cinematic lower-third: no box, just darkness gathering under the line. */
function drawNarration(ctx: CanvasRenderingContext2D, model: PanelModel): Rect | null {
  const alpha = model.narrationAlpha ?? 1;
  if (!model.narration || alpha <= 0.001) return null;
  const size = Math.round(27 * model.scale);
  const lh = Math.round(size * 1.34);
  const style = { size, color: hudHighContrast() ? "#fffaf0" : COLORS.narration, lineHeight: lh };
  const full = model.narrationFull ?? model.narration;
  const lines = wrapOnce(ctx, full, 1560, style);
  const height = Math.max(Math.round(84 * model.scale), lines.length * lh + 48);
  const top = Math.max(64, SCENE_H - height - 4);
  const grad = ctx.createLinearGradient(0, top, 0, top + height);
  grad.addColorStop(0, "rgba(3,7,13,0)");
  grad.addColorStop(0.22, hudHighContrast() ? "rgba(0,0,0,0.88)" : "rgba(3,7,13,0.7)");
  grad.addColorStop(1, hudHighContrast() ? "rgba(0,0,0,0.98)" : "rgba(3,7,13,0.95)");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, LOGICAL_W, height);
  ctx.strokeStyle = "rgba(232,201,138,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(150, top + 1); ctx.lineTo(LOGICAL_W - 150, top + 1); ctx.stroke();
  drawRevealed(ctx, lines, model.narration.length, 150, top + 22, style);
  ctx.restore();
  return { x: 140, y: top, w: 1640, h: height };
}

/**
 * The sentence line: what Fenn is about to do, or what a click on the thing under the pointer
 * would do. It is a preview of the action, not a lesson in the controls — the instructions that
 * used to sit under it are gone.
 */
function drawSentence(ctx: CanvasRenderingContext2D, model: PanelModel): Rect | null {
  const l = panelLayout(model.scale);
  const box = drawNarration(ctx, model);

  const verbDef = model.verb ? VERBS.find((v) => v.id === model.verb) : undefined;
  const verbLabel = verbDef?.label ?? "";
  const a = model.objA ?? "";
  const b = model.objB ?? "";
  const link = model.verb === "give" ? "to" : "with";
  const line1 = [verbLabel, a].filter(Boolean).join(" ");
  // The sentence as it would finish on what the pointer (or focus) is on: "Look at" + crate,
  // or "Use crowbar" + "with impounded crate".
  const target = model.target && model.target !== a ? model.target : null;
  const preview = !line1 || b || !target ? null
    : !a ? ` ${target}`
    : verbDef?.twoObject ? ` ${link} ${target}` : null;

  // The sentence is read off a nameplate: dark glass with a brass edge, like the verbs above it.
  // It sits under the text (which keeps its own x and y) and grows to take a second line.
  {
    const hc = hudHighContrast();
    const bottom = b ? l.line2Y + Math.round(Math.min(28, 25 * model.scale)) + 12 : l.sentY + l.line1 + 16;
    const px = SENT_X - 12, py = l.sentY - 6, pw = SENT_W + 24, ph = Math.min(LOGICAL_H - 8, bottom) - py;
    ctx.save();
    ctx.fillStyle = "rgba(5,9,16,0.58)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = hc ? "rgba(232,201,138,0.8)" : "rgba(201,162,74,0.34)";
    ctx.lineWidth = hc ? 2 : 1;
    ctx.strokeRect(px + ctx.lineWidth / 2, py + ctx.lineWidth / 2, pw - ctx.lineWidth, ph - ctx.lineWidth);
    if (!hc) brassInset(ctx, px, py, pw, ph, { bare: true, rivets: true });
    ctx.restore();
  }

  if (line1) {
    const size = fitSize(ctx, line1 + (preview ?? ""), SENT_W, l.line1, 20, "bold");
    drawText(ctx, line1, SENT_X, l.sentY + 4, { size, color: COLORS.sentence, weight: "bold" });
    ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
    const at = SENT_X + ctx.measureText(line1).width;
    if (preview) {
      drawText(ctx, preview, at, l.sentY + 4, { size, color: "#ecd29a", weight: "bold" });
    } else if (verbDef?.twoObject && a && !b) {
      // A two-object verb is still waiting for its second half. Say so in the sentence's own
      // grammar — "Use crowbar with …" — rather than with a line of instructions beneath it.
      drawText(ctx, ` ${link} …`, at, l.sentY + 4, {
        size, color: hudHighContrast() ? "#f4e2b4" : "rgba(236,210,154,0.78)", weight: "bold",
      });
    }
  } else if (model.suggestLine) {
    // The lit-up verb as a promise: "Talk to Marta". A small compass mark, no caveat.
    ctx.fillStyle = "rgba(232,201,138,0.85)";
    ctx.beginPath(); ctx.arc(SENT_X + 7, l.sentY + 18, 3.5, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, model.suggestLine, SENT_X + 22, l.sentY + 4, {
      size: fitSize(ctx, model.suggestLine, SENT_W - 22, l.line1, 20, "bold"), color: "#ecd29a", weight: "bold",
    });
  }

  if (b) {
    drawText(ctx, `${link} ${b}`, SENT_X, l.line2Y, {
      size: Math.round(Math.min(28, 25 * model.scale)),
      color: COLORS.sentence,
    });
  }
  return box;
}

/** A rounded rectangle, drawn by hand so it never depends on roundRect support. */
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}

/**
 * The satchel. A strip of leather above the pockets, brass clasp and stitching, and the items
 * themselves shown as pictures in their pockets. A name is not written under each thing: it
 * appears in the pocket, over the dimmed picture, only while the pointer or the keyboard is on it.
 */
function drawInventory(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  const pages = inventoryPages(model.inventory.length);
  const page = Math.max(0, Math.min(model.page, pages - 1));
  const bandX = INV_X - 6, bandY = 879, bandW = 4 * (INV_W + INV_GAP) - INV_GAP + 12;

  // The satchel's leather head: a band, stitching, a small clasp at the left.
  ctx.save();
  const leather = ctx.createLinearGradient(0, bandY, 0, bandY + 34);
  leather.addColorStop(0, "rgba(50,36,23,0.92)");
  leather.addColorStop(1, "rgba(26,18,12,0.94)");
  ctx.fillStyle = leather;
  rounded(ctx, bandX, bandY, bandW, 34, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(201,162,74,0.26)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = "rgba(232,201,138,0.18)";
  ctx.beginPath();
  ctx.moveTo(bandX + 34, bandY + 7);
  ctx.lineTo(bandX + bandW - 12, bandY + 7);
  ctx.moveTo(bandX + 34, bandY + 27);
  ctx.lineTo(bandX + bandW - 12, bandY + 27);
  ctx.stroke();
  ctx.setLineDash([]);
  // The clasp: a brass ring and a tongue, the satchel's own compass.
  ctx.beginPath(); ctx.arc(bandX + 18, bandY + 17, 9, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(232,201,138,0.7)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "rgba(201,162,74,0.16)";
  ctx.fill();
  ctx.fillStyle = "#d9b877";
  ctx.beginPath();
  ctx.moveTo(bandX + 18, bandY + 10);
  ctx.lineTo(bandX + 22, bandY + 17);
  ctx.lineTo(bandX + 18, bandY + 24);
  ctx.lineTo(bandX + 14, bandY + 17);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (pages > 1) {
    const arrow = (r: Rect, glyph: string, enabled: boolean, focused: boolean) => {
      ctx.fillStyle = enabled ? "rgba(232,201,138,0.1)" : "rgba(255,255,255,0.025)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = enabled ? "rgba(232,201,138,0.5)" : "rgba(232,201,138,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      if (focused) {
        ctx.strokeStyle = "#fff3cf";
        ctx.lineWidth = hudHighContrast() ? 4 : 2.5;
        ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      }
      const glyphSize = Math.min(34, Math.round(26 * Math.max(1, model.scale)));
      drawText(ctx, glyph, r.x + r.w / 2, r.y + Math.round((r.h - glyphSize) / 2) - 2, {
        size: glyphSize,
        color: enabled ? "#f0d9a0" : hudHighContrast() ? "rgba(214,204,176,0.6)" : "rgba(201,180,140,0.38)",
        align: "center",
        shadow: false,
      });
    };
    arrow(PAGE_PREV, "‹", page > 0, model.focusItem === PAGE_FOCUS.prev);
    arrow(PAGE_NEXT, "›", page < pages - 1, model.focusItem === PAGE_FOCUS.next);
    // Pages as shot on a chart: a small row of beads, one lit, no numbers.
    const mid = (PAGE_PREV.x + PAGE_PREV.w + PAGE_NEXT.x) / 2;
    const gap = 11;
    const start = mid - ((pages - 1) * gap) / 2;
    for (let i = 0; i < pages; i++) {
      ctx.beginPath();
      ctx.arc(start + i * gap, 894, i === page ? 3.4 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = i === page ? "#e8c98a" : "rgba(232,201,138,0.3)";
      ctx.fill();
    }
  }

  // Every pocket is drawn, empty or not, so an empty satchel still reads as a satchel.
  for (let i = 0; i < INV_PER_PAGE; i++) drawPocket(ctx, itemRect(i), false, false, false);

  const shown = pageItems(model);
  shown.forEach((it, i) => {
    const r = itemRect(i);
    const selected = model.selectedItem === it.id;
    const hover = selected || model.hoverItem === it.id;
    const focused = model.focusItem === it.id;
    const glow = model.fresh?.[it.id] ?? 0;
    drawPocket(ctx, r, hover, focused, true);
    if (glow > 0) {
      // Just arrived: a warm glow that fades, so the eye finds the new thing.
      const pulse = model.reduced ? 1 : 0.7 + 0.3 * Math.sin((model.time ?? 0) * 5.5);
      ctx.fillStyle = `rgba(232,201,138,${(0.16 * glow * pulse).toFixed(3)})`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = `rgba(255,226,160,${(0.85 * glow * pulse).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    }
    if (selected) {
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(r.x, r.y, 4, r.h);
    }

    const icon = it.icon && it.icon.width > 0 ? it.icon : null;
    const reveal = hover || focused;
    // The picture, dimmed while its name has the pocket.
    if (icon) {
      const k = Math.min(ICON_W / icon.width, ICON_H / icon.height);
      const iw = icon.width * k, ih = icon.height * k;
      ctx.save();
      ctx.globalAlpha = reveal ? 0.22 : 1;
      ctx.drawImage(icon, r.x + (r.w - iw) / 2, r.y + (r.h - ih) / 2, iw, ih);
      ctx.restore();
    } else if (!reveal) {
      // A thing with no drawing of its own: a small brass knot, so the pocket is not blank.
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.strokeStyle = "rgba(201,162,74,0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(232,201,138,0.85)";
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (reveal) {
      // The name, in the pocket. Largest size that fits in two lines, never below 13px.
      let size = Math.round(18 * model.scale);
      let lines = wrapOnce(ctx, it.name, r.w - 20, { size, color: "" });
      while (size > 13 && (lines.length > 2 || lines.length * (size + 4) > r.h - 12)) {
        size--;
        lines = wrapOnce(ctx, it.name, r.w - 20, { size, color: "" });
      }
      const lh = size + 4;
      const y0 = r.y + Math.round((r.h - Math.min(2, lines.length) * lh) / 2) + 1;
      lines.slice(0, 2).forEach((ln, li) => {
        drawText(ctx, ln, r.x + r.w / 2, y0 + li * lh, {
          size, color: "#fff3d6", align: "center", shadow: false,
        });
      });
    }
  });
}

/** One leather pocket, stitched round the edge; brighter for a filled slot and its hover. */
function drawPocket(ctx: CanvasRenderingContext2D, r: Rect, hover: boolean, focused: boolean, filled: boolean): void {
  const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (filled) {
    grad.addColorStop(0, hover ? "rgba(74,53,31,0.92)" : "rgba(48,34,21,0.9)");
    grad.addColorStop(1, hover ? "rgba(40,28,18,0.94)" : "rgba(23,16,11,0.94)");
  } else {
    grad.addColorStop(0, "rgba(28,20,14,0.5)");
    grad.addColorStop(1, "rgba(15,11,8,0.6)");
  }
  ctx.save();
  rounded(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = hover ? "rgba(232,201,138,0.5)" : hudHighContrast() ? "rgba(232,201,138,0.8)" : "rgba(201,162,74,0.2)";
  ctx.lineWidth = hudHighContrast() ? 1.5 : 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,231,190,0.05)";
  ctx.beginPath(); ctx.moveTo(r.x + 8, r.y + 3); ctx.lineTo(r.x + r.w - 8, r.y + 3); ctx.stroke();
  // A filled pocket is a plate in the satchel: bevelled, with brass studs in its corners.
  if (filled) brassInset(ctx, r.x, r.y, r.w, r.h, { hover, radius: 6, rivets: true, bare: true });
  if (focused) {
    ctx.strokeStyle = "#fff3cf";
    ctx.lineWidth = hudHighContrast() ? 4 : 2.5;
    rounded(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 4);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- cursor

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string | null,
  rejected = false,
  scale = 1,
  /** A box the label must not cover (the narration): it moves above it instead. */
  avoid: Rect | null = null
): void {
  if (label) {
    ctx.save();
    const size = Math.round(20 * scale);
    ctx.font = `italic ${size}px Georgia, serif`;
    const w = ctx.measureText(label).width;
    const bx = Math.max(8, Math.min(x + 24, LOGICAL_W - w - 28));
    let by = Math.max(8, Math.min(y + 22, LOGICAL_H - size - 24));
    if (avoid && bx - 8 < avoid.x + avoid.w && bx + w + 8 > avoid.x &&
        by - 4 < avoid.y + avoid.h && by + size + 6 > avoid.y) {
      by = Math.max(8, avoid.y - size - 16);
    }
    ctx.fillStyle = "rgba(4,6,12,0.82)";
    ctx.fillRect(bx - 8, by - 4, w + 16, size + 10);
    ctx.fillStyle = "#f2e7c9";
    ctx.textBaseline = "top";
    ctx.fillText(label, bx, by + 2);
    ctx.restore();
  }
  if (rejected) {
    ctx.save();
    ctx.strokeStyle = "rgba(239,139,110,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 14, y + 16, 9, 0, Math.PI * 2);
    ctx.moveTo(x + 9, y + 11);
    ctx.lineTo(x + 19, y + 21);
    ctx.moveTo(x + 19, y + 11);
    ctx.lineTo(x + 9, y + 21);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- dialogue

/** Where the speaker stands on screen: the spotlight's centre and radii. */
export interface Spot { x: number; y: number; rx: number; ry: number }

export interface DialogueModel {
  speaker: string;
  /** Accent colour for the speaker name, from the character registry. */
  speakerAccent?: string | null;
  text: string;
  reveal: number;
  portraitKey: string | null;
  portrait: HTMLImageElement | null;
  /** `seen`: its answer has been heard already, so it's drawn dimmer. */
  choices: { text: string; index: number; seen?: boolean }[];
  hoverIndex: number;
  layout: DialogueLayout;
  /** Text scale, as in the panel. */
  scale: number;
  touch: boolean;
  keyboard?: boolean;
  /** The staging between frames (fade-in, eased height, crossfade, spotlight). */
  stage?: DialogueStage | null;
  /** A speaker with no portrait, in a conversation that has them: their initial in the frame. */
  monogram?: string | null;
}

export interface DialogueLayout {
  top: number; height: number; size: number; lineHeight: number;
  bodyY: number; rects: Rect[];
  /** The text column: right of the portrait, or the panel's own margin when nobody has one. */
  textX: number; textW: number;
  /** Whether there is a portrait column at all. */
  column: boolean;
  /** The body, wrapped once. */
  lines: string[];
  /** Each choice, wrapped once. */
  choiceLines: string[][];
}

const layouts = new Map<string, DialogueLayout>();

/**
 * Lay out a dialogue node: shared by drawing and hit-testing, and remembered, since the same
 * node is drawn every frame and laid out again on every pointer move otherwise.
 * `column` reserves the portrait column; conversations where nobody has a portrait (a voice from
 * the back room, the narrator alone) use the whole width instead of leaving it empty.
 */
export function dialogueLayout(ctx: CanvasRenderingContext2D, text: string, choices: string[], scale = 1, column = true): DialogueLayout {
  const key = `${scale}|${column}|${text}|${choices.join("\u0001")}`;
  const hit = layouts.get(key);
  if (hit) return hit;
  const textX = column ? 386 : 110;
  const textW = column ? 1430 : 1700;
  // Start at the scaled size and shrink only as far as needed to fit; never below 20px.
  let size = Math.round(27 * scale), lineHeight = 38;
  let lines: string[] = [], choiceLines: string[][] = [], heights: number[] = [], height = 0;
  const pad = Math.round(16 * scale);
  const bodyOffset = 76 + Math.round(12 * (scale - 1));
  do {
    lineHeight = size + Math.round(11 * Math.min(scale, 1.25));
    lines = wrap(ctx, text, textW, { size, color: "" });
    choiceLines = choices.map((c) => wrap(ctx, c, textW - 64, { size: size - 2, color: "" }));
    heights = choiceLines.map((c) => Math.max(48, c.length * lineHeight + pad));
    const choicesHeight = heights.reduce((sum, h) => sum + h + 6, 0);
    height = Math.max(400, bodyOffset + lines.length * lineHeight + 28 + choicesHeight + 16);
    if (height <= 1040 || size <= 20) break;
    size--;
  } while (true);
  const top = Math.max(20, 1060 - height);
  const bodyY = top + bodyOffset;
  let y = bodyY + lines.length * lineHeight + 30;
  const layout: DialogueLayout = {
    top, height, size, lineHeight, bodyY, textX, textW, column, lines, choiceLines,
    rects: heights.map((h) => { const r = { x: textX, y, w: textW, h }; y += h + 6; return r; }),
  };
  if (layouts.size > 48) layouts.delete(layouts.keys().next().value!);
  layouts.set(key, layout);
  return layout;
}

const approach = (from: number, to: number, dt: number, tau: number): number =>
  to + (from - to) * Math.exp(-dt / tau);
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);

/**
 * A conversation's staging between frames: the panel fading and rising in, its top easing as
 * lines change length, the portrait crossfading to a new speaker, and a spotlight that finds
 * whoever is talking in the scene. Reduced motion: everything is simply where it ends up.
 */
export class DialogueStage {
  /** 0 → 1 as the panel arrives. */
  appear = 0;
  /** The panel top as drawn, easing toward the layout's. */
  top: number | null = null;
  portrait: HTMLImageElement | null = null;
  prev: HTMLImageElement | null = null;
  /** Crossfade from `prev` to `portrait`, 0 → 1. */
  mix = 1;
  spot: Spot | null = null;
  /** The spotlight opening (1) or closing (0), like an iris. */
  open = 0;

  reset(): void {
    this.appear = 0;
    this.top = null;
    this.portrait = this.prev = null;
    this.mix = 1;
    this.spot = null;
    this.open = 0;
  }

  update(dt: number, layout: DialogueLayout, portrait: HTMLImageElement | null, spot: Spot | null, reduced: boolean): void {
    if (portrait !== this.portrait) {
      this.prev = this.portrait;
      this.portrait = portrait;
      this.mix = this.prev && !reduced ? 0 : 1;
    }
    if (reduced) {
      this.appear = 1;
      this.top = layout.top;
      this.mix = 1;
      this.prev = null;
      this.spot = spot;
      this.open = spot ? 1 : 0;
      return;
    }
    this.appear = Math.min(1, this.appear + dt / 0.28);
    this.top = this.top === null ? layout.top : approach(this.top, layout.top, dt, 0.07);
    if (Math.abs(this.top - layout.top) < 0.5) this.top = layout.top;
    this.mix = Math.min(1, this.mix + dt / 0.22);
    if (this.mix >= 1) this.prev = null;
    if (spot) {
      if (!this.spot || this.open < 0.02) this.spot = { ...spot };
      else {
        this.spot.x = approach(this.spot.x, spot.x, dt, 0.12);
        this.spot.y = approach(this.spot.y, spot.y, dt, 0.12);
        this.spot.rx = approach(this.spot.rx, spot.rx, dt, 0.12);
        this.spot.ry = approach(this.spot.ry, spot.ry, dt, 0.12);
      }
      this.open = Math.min(1, this.open + dt / 0.35);
    } else {
      this.open = Math.max(0, this.open - dt / 0.25);
    }
  }

  /** How far the panel's content is drawn (and hit-tested) from its laid-out place. */
  offset(layout: DialogueLayout): number {
    return (this.top ?? layout.top) - layout.top + this.rise();
  }
  /** The panel's drop while it fades in. */
  rise(): number {
    return (1 - easeOut(this.appear)) * 26;
  }
}

/**
 * The veil over the scene: flat, with a soft-edged hole where the speaker stands. It only has to
 * quiet the picture a little (the lower-third behind the text does the real work), so the room
 * stays visible while someone talks. High contrast keeps the old, darker veil.
 */
const VEIL = { soft: 0.34, strong: 0.72 };
const holeSprites: { soft: HTMLCanvasElement | null; strong: HTMLCanvasElement | null } = { soft: null, strong: null };
function hole(strong: boolean): HTMLCanvasElement {
  const kind = strong ? "strong" : "soft";
  const cached = holeSprites[kind];
  if (cached) return cached;
  const edge = VEIL[kind];
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, `rgba(2,4,10,${(edge * 0.11).toFixed(3)})`);
  grad.addColorStop(0.5, `rgba(2,4,10,${(edge * 0.3).toFixed(3)})`);
  grad.addColorStop(0.82, `rgba(2,4,10,${(edge * 0.8).toFixed(3)})`);
  grad.addColorStop(1, `rgba(2,4,10,${edge})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  holeSprites[kind] = c;
  return c;
}

const VEIL_FILL = { soft: `rgba(2,4,10,${VEIL.soft})`, strong: `rgba(2,4,10,${VEIL.strong})` };

function drawVeil(ctx: CanvasRenderingContext2D, spot: Spot | null, open: number): void {
  const strong = hudHighContrast();
  ctx.fillStyle = strong ? VEIL_FILL.strong : VEIL_FILL.soft;
  if (!spot || open <= 0.01) {
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    return;
  }
  // The hole opens like an iris: its edge is the veil's own darkness, so it never seams.
  const k = easeOut(open);
  const rx = spot.rx * k, ry = spot.ry * k;
  const x0 = spot.x - rx, y0 = spot.y - ry, x1 = spot.x + rx, y1 = spot.y + ry;
  ctx.fillRect(0, 0, LOGICAL_W, Math.max(0, y0));
  ctx.fillRect(0, y1, LOGICAL_W, Math.max(0, LOGICAL_H - y1));
  ctx.fillRect(0, y0, Math.max(0, x0), y1 - y0);
  ctx.fillRect(x1, y0, Math.max(0, LOGICAL_W - x1), y1 - y0);
  ctx.drawImage(hole(strong), x0, y0, x1 - x0, y1 - y0);
}

function drawPortrait(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: Rect, alpha: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
  const s = Math.max(p.w / img.width, p.h / img.height);
  ctx.drawImage(img, p.x + (p.w - img.width * s) / 2, p.y + (p.h - img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}

/** In the portrait frame, for a speaker without one: their initial, or a compass rose for the narrator. */
function drawMonogram(ctx: CanvasRenderingContext2D, p: Rect, letter: string, accent: string): void {
  const cx = p.x + p.w / 2, cy = p.y + Math.min(p.h, 248) / 2 + 20, r = 74;
  ctx.save();
  ctx.fillStyle = "rgba(19,33,46,0.9)";
  ctx.strokeStyle = accent;
  ctx.globalAlpha *= 0.85;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.globalAlpha *= 0.5; ctx.stroke();
  ctx.restore();
  if (letter) {
    drawText(ctx, letter, cx, cy - 38, { size: 76, color: accent, align: "center", weight: "bold", shadow: false });
    return;
  }
  // The narrator: a four-point rose.
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha *= 0.8;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? 14 : 52;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawDialogue(ctx: CanvasRenderingContext2D, m: DialogueModel): void {
  const l = m.layout;
  const stage = m.stage ?? null;
  drawVeil(ctx, stage?.spot ?? null, stage?.open ?? 0);

  const off = stage ? stage.offset(l) : 0;
  const rise = stage ? stage.rise() : 0;
  ctx.save();
  ctx.globalAlpha = stage ? easeOut(stage.appear) : 1;
  // The box keeps its foot on the panel line and grows or shrinks at the top as lines change.
  const boxTop = l.top + off, boxBottom = l.top + l.height + rise;
  // A cinematic lower-third, not a box: the picture keeps its top, the dark gathers at the foot.
  const veil = ctx.createLinearGradient(0, boxTop, 0, boxBottom);
  veil.addColorStop(0, "rgba(3,6,12,0)");
  const hc = hudHighContrast();
  veil.addColorStop(0.16, hc ? "rgba(3,6,12,0.55)" : "rgba(3,6,12,0.42)");
  veil.addColorStop(0.46, hc ? "rgba(3,6,12,0.9)" : "rgba(3,6,12,0.84)");
  veil.addColorStop(1, "rgba(2,4,9,0.98)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, boxTop, LOGICAL_W, boxBottom - boxTop);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, boxTop, LOGICAL_W, boxBottom - boxTop); ctx.clip();
  ctx.translate(0, off);

  if (l.column) {
    const p = { x: 92, y: l.top + 34, w: 238, h: Math.min(326, l.height - 68) };
    const mix = stage ? stage.mix : 1;
    // A film-still portrait: softly cropped, a hairline of brass around it, no picture frame.
    ctx.save();
    rounded(ctx, p.x, p.y, p.w, p.h, 3);
    ctx.clip();
    if (stage?.prev) drawPortrait(ctx, stage.prev, p, 1 - mix);
    if (m.portrait) drawPortrait(ctx, m.portrait, p, mix);
    else if (m.monogram !== undefined && m.monogram !== null) {
      ctx.save(); ctx.globalAlpha *= mix; drawMonogram(ctx, p, m.monogram, m.speakerAccent ?? "#e8c98a"); ctx.restore();
    }
    ctx.restore();
    ctx.save();
    rounded(ctx, p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1, 3);
    ctx.strokeStyle = "rgba(232,201,138,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  if (m.speaker) {
    const name = m.speaker.toUpperCase();
    const nameSize = Math.round(Math.min(26, 20 * m.scale));
    drawText(ctx, name, l.textX, l.top + 30, {
      size: nameSize, color: m.speakerAccent ?? "#edce91", weight: "bold", shadow: false,
    });
    ctx.save();
    ctx.font = `bold ${nameSize}px Georgia, "Times New Roman", serif`;
    const nw = ctx.measureText(name).width;
    ctx.strokeStyle = "rgba(232,201,138,0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l.textX + nw + 20, l.top + 30 + nameSize * 0.62);
    ctx.lineTo(l.textX + l.textW, l.top + 30 + nameSize * 0.62);
    ctx.stroke();
    ctx.restore();
  }

  drawRevealed(ctx, l.lines, typewriterSlice(m.text, m.reveal).length, l.textX, l.bodyY, {
    size: l.size, color: "#f0e7d6", lineHeight: l.lineHeight,
  });
  m.choices.forEach((choice, i) => {
    const r = l.rects[i], hover = m.hoverIndex === i;
    const seen = Boolean(choice.seen) && !hover;
    // Choices are lines of type with a brass mark, not buttons.
    if (hover) {
      const washRow = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
      washRow.addColorStop(0, "rgba(232,201,138,0.14)");
      washRow.addColorStop(0.7, "rgba(232,201,138,0.04)");
      washRow.addColorStop(1, "rgba(232,201,138,0)");
      ctx.fillStyle = washRow;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "#e8c98a";
      ctx.fillRect(r.x, r.y + 4, 2, r.h - 8);
    }
    ctx.strokeStyle = hover ? "rgba(232,201,138,0.35)" : "rgba(232,201,138,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x + 30, r.y + r.h - 1);
    ctx.lineTo(r.x + r.w, r.y + r.h - 1);
    ctx.stroke();
    // The mark: a small diamond that fills in under the pointer or the arrow keys.
    ctx.save();
    ctx.translate(r.x + 14, r.y + r.h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = hover ? "#ffe6a8" : "rgba(232,201,138,0.55)";
    ctx.fillStyle = hover ? "#e8c98a" : "rgba(232,201,138,0.08)";
    ctx.lineWidth = 1.2;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
    const inset = Math.round(8 * m.scale + (l.lineHeight - (l.size - 2)) / 2);
    (l.choiceLines[i] ?? []).forEach((line, li) => {
      drawText(ctx, line, r.x + 40, r.y + inset - 2 + li * l.lineHeight, {
        size: l.size - 2,
        color: hover ? "#fffaf0" : seen ? "#8b928c" : "#d3cbbb",
        shadow: false,
      });
    });
  });
  ctx.restore();
  ctx.restore();
}

export function dialogueHit(x: number, y: number, m: DialogueModel): number | null {
  const off = m.stage ? m.stage.offset(m.layout) : 0;
  const i = m.layout.rects.findIndex((r) => inRect(x, y - off, r));
  return i < 0 ? null : i;
}

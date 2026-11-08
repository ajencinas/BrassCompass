/**
 * UI — the verb panel, sentence line, inventory, dialogue overlay and cursor.
 * Layout constants are shared between drawing and hit-testing so they can
 * never drift apart.
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H } from "../engine/view";
import { drawText, wrap, fontOf, typewriterSlice, type TextStyle } from "../engine/text";
import { VERBS } from "./verbs";
import type { Rect, VerbId } from "./types";

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
  const vh = Math.round(40 + (scale - 1) * 28);      // 40, 47, 54
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
const INV_H = 74;
const INV_GAP = 10;
/** Item art is drawn no bigger than this, beside the name. */
const ICON = 56;

export const COLORS = {
  verb: "#93a3bb",
  verbHover: "#ffffff",
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
const PAGE_PREV = { x: 1690, y: 880, w: 32, h: 28 };
const PAGE_NEXT = { x: 1782, y: 880, w: 32, h: 28 };

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

function drawVerbs(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  VERBS.forEach((v, i) => {
    const r = verbRect(i, model.scale);
    const active = model.verb === v.id;
    const hover = model.hoverVerb === v.id;
    const focused = model.focusVerb === v.id;
    const suggested = !active && model.suggestVerb === v.id;

    ctx.fillStyle = "rgba(130,160,180,0.07)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "rgba(140,166,179,0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
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
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    }

    const weight = active ? "bold" : "normal";
    const size = fitSize(ctx, v.label, r.w - 20, Math.round(21 * model.scale), 18, weight);
    drawText(ctx, v.label, r.x + (model.scale > 1 ? r.w / 2 : 14), r.y + Math.round((r.h - size) / 2) - 1, {
      size,
      color: focused || active || suggested ? COLORS.verbActive : hover ? COLORS.verbHover : COLORS.verb,
      weight,
      align: model.scale > 1 ? "center" : "left",
      shadow: false,
    });
  });
}

/** The narration box over the bottom of the scene, if a line is showing. */
function drawNarration(ctx: CanvasRenderingContext2D, model: PanelModel): Rect | null {
  const alpha = model.narrationAlpha ?? 1;
  if (!model.narration || alpha <= 0.001) return null;
  const size = Math.round(26 * model.scale);
  const lh = Math.round(size * 1.31);
  const style = { size, color: COLORS.narration, lineHeight: lh };
  const full = model.narrationFull ?? model.narration;
  const lines = wrapOnce(ctx, full, 1760, style);
  const height = Math.max(Math.round(92 * model.scale), lines.length * lh + 46);
  const top = Math.max(76, SCENE_H - height - 12);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(5,13,22,0.94)";
  ctx.fillRect(40, top, 1840, height);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(40, top, 4, height);
  drawRevealed(ctx, lines, model.narration.length, 68, top + 20, style);
  if (model.waiting && model.narration === model.narrationFull) {
    // Something is waiting on this line: say how to move on.
    drawText(ctx, model.keyboard ? "Enter ▸" : model.touch ? "tap ▸" : "click ▸", 1860, top + height - 34, {
      size: Math.round(20 * model.scale), color: "#e8c98a", align: "right", shadow: false,
    });
  }
  ctx.restore();
  return { x: 40, y: top, w: 1840, h: height };
}

function drawSentence(ctx: CanvasRenderingContext2D, model: PanelModel): Rect | null {
  const l = panelLayout(model.scale);
  const box = drawNarration(ctx, model);

  const verbDef = model.verb ? VERBS.find((v) => v.id === model.verb) : undefined;
  const verbLabel = verbDef?.label ?? "";
  const a = model.objA ?? "";
  const b = model.objB ?? "";
  const line1 = [verbLabel, a].filter(Boolean).join(" ");
  const link = model.verb === "give" ? "to" : "with";
  // The sentence as it would finish on what the pointer (or focus) is on: "Look at" + crate,
  // or "Use crowbar" + "with impounded crate".
  const target = model.target && model.target !== a ? model.target : null;
  const preview = !line1 || b || !target ? null
    : !a ? ` ${target}`
    : verbDef?.twoObject ? ` ${link} ${target}` : null;

  const hint = (text: string) => drawText(ctx, text, SENT_X, l.line2Y, {
    size: fitSize(ctx, text, SENT_W, l.line2, 18), color: "#c3d3da", shadow: false,
  });
  if (line1) {
    const size = fitSize(ctx, line1 + (preview ?? ""), SENT_W, l.line1, 20, "bold");
    drawText(ctx, line1, SENT_X, l.sentY + 4, { size, color: COLORS.sentence, weight: "bold" });
    if (preview) {
      ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
      const at = SENT_X + ctx.measureText(line1).width;
      drawText(ctx, preview, at, l.sentY + 4, { size, color: "#ecd29a", weight: "bold" });
    }
  } else if (model.suggestLine) {
    drawText(ctx, model.suggestLine, SENT_X, l.sentY + 4, {
      size: fitSize(ctx, model.suggestLine, SENT_W, l.line1, 20, "bold"), color: "#ecd29a", weight: "bold",
    });
    if (!b) {
      hint(model.keyboard
        ? (model.suggestExit ? "Enter to go through · arrows for the next thing · Tab for verbs" : "Enter to do it · arrows for the next thing · Tab for verbs and items")
        : model.touch
        ? (model.suggestExit ? "tap again to go through · long-press to look" : "tap again to do it · long-press to look · or pick a verb")
        : (model.suggestExit ? "click to go through (double-click: at once) · right-click to look" : "click to do it · right-click to look · or pick a verb"));
    }
  } else {
    const idle = model.keyboard
      ? "Tab: scene, verbs, items · arrows to move · Enter to act · hold Q to reveal"
      : model.touch
      ? "Tap a thing to see it, again to act · tap the floor to walk"
      : "Click a thing to act · right-click to look · hold Q to reveal";
    drawText(ctx, idle, SENT_X, l.sentY + 6, {
      size: fitSize(ctx, idle, SENT_W, Math.round(Math.min(28, 22 * model.scale)), 18),
      color: "#b9c8d3",
      weight: "normal",
      shadow: false,
    });
  }

  if (b) {
    drawText(ctx, `${link} ${b}`, SENT_X, l.line2Y, {
      size: Math.round(Math.min(28, 25 * model.scale)),
      color: COLORS.sentence,
    });
  } else if (model.objA && verbDef?.twoObject && !preview) {
    hint(model.verb === "give" ? "Choose who receives it" : "Choose an object to use it with");
  }
  return box;
}

function drawInventory(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  // The panel heading and the pager are chrome too: they follow the text scale, fitted to the
  // fixed grid beneath them (the eight slots themselves cannot grow).
  const heading = fitText(ctx, "INVENTORY", 330, Math.round(18 * model.scale), 14, "bold");
  drawText(ctx, heading.text, INV_X, 889 - Math.max(0, Math.round((heading.size - 18) / 2)), {
    size: heading.size,
    color: "#d4b064",
    weight: "bold",
    shadow: false,
  });
  ctx.font = `bold ${heading.size}px Georgia, serif`;
  const w = ctx.measureText(heading.text).width;
  ctx.fillStyle = "rgba(201,162,74,0.35)";
  ctx.fillRect(INV_X + w + 12, 899, 220, 1);

  if (model.inventory.length === 0) {
    drawText(ctx, "empty pockets", INV_X, INV_Y + 22, {
      size: Math.round(20 * model.scale),
      color: "rgba(176,166,186,0.8)",
      weight: "normal",
      shadow: false,
    });
    return;
  }

  const pages = inventoryPages(model.inventory.length);
  const page = Math.min(model.page, pages - 1);
  if (pages > 1) {
    const arrow = (r: Rect, glyph: string, enabled: boolean, focused: boolean) => {
      ctx.fillStyle = enabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (focused) {
        ctx.strokeStyle = "#fff3cf";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      }
      drawText(ctx, glyph, r.x + r.w / 2, r.y + 3, {
        size: Math.round(20 * model.scale),
        color: enabled ? COLORS.item : "rgba(160,150,170,0.28)",
        align: "center",
        shadow: false,
      });
    };
    arrow(PAGE_PREV, "‹", page > 0, model.focusItem === PAGE_FOCUS.prev);
    arrow(PAGE_NEXT, "›", page < pages - 1, model.focusItem === PAGE_FOCUS.next);
    const counter = fitText(ctx, `${page + 1}/${pages}`, 80, Math.round(18 * model.scale), 13);
    drawText(ctx, counter.text, (PAGE_PREV.x + PAGE_NEXT.x + PAGE_NEXT.w) / 2, 884, {
      size: counter.size,
      color: "#d4b064",
      align: "center",
      shadow: false,
    });
  }

  const shown = pageItems(model);
  shown.forEach((it, i) => {
    const r = itemRect(i);
    const selected = model.selectedItem === it.id;
    const hover = selected || model.hoverItem === it.id;
    const focused = model.focusItem === it.id;
    const glow = model.fresh?.[it.id] ?? 0;
    ctx.fillStyle = hover ? "rgba(201,162,74,0.18)" : "rgba(255,255,255,0.035)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (glow > 0) {
      // Just arrived: a warm glow that fades, so the eye finds the new thing.
      const pulse = model.reduced ? 1 : 0.7 + 0.3 * Math.sin((model.time ?? 0) * 5.5);
      ctx.fillStyle = `rgba(232,201,138,${(0.16 * glow * pulse).toFixed(3)})`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = `rgba(255,226,160,${(0.85 * glow * pulse).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    }
    ctx.strokeStyle = hover ? "rgba(232,201,138,0.6)" : "rgba(201,162,74,0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    if (selected) {
      ctx.fillStyle = COLORS.gold; ctx.fillRect(r.x, r.y, 4, r.h);
    }
    if (focused) {
      ctx.strokeStyle = "#fff3cf";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    }
    // With art, the picture leads and the name sits smaller beside it.
    const icon = it.icon && it.icon.width > 0 ? it.icon : null;
    let textX = r.x + 12, textW = r.w - 24, base = 19, min = 18;
    if (icon) {
      const k = Math.min(ICON / icon.width, ICON / icon.height);
      const iw = icon.width * k, ih = icon.height * k;
      ctx.drawImage(icon, r.x + 8 + (ICON - iw) / 2, r.y + (r.h - ih) / 2, iw, ih);
      textX = r.x + 8 + ICON + 8;
      textW = r.x + r.w - 8 - textX;
      base = 16;
      min = 14;
    }
    // Largest size, up to the scale, at which the name fits in two lines.
    let size = Math.round(base * model.scale);
    let lines = wrapOnce(ctx, it.name, textW, { size, color: "" });
    while (size > min && (lines.length > 2 || lines.length * (size + 4) > r.h - 12)) {
      size--;
      lines = wrapOnce(ctx, it.name, textW, { size, color: "" });
    }
    const lh = size + 4;
    const y0 = r.y + Math.round((r.h - Math.min(2, lines.length) * lh) / 2) + 1;
    lines.slice(0, 2).forEach((ln, li) => {
      drawText(ctx, ln, textX, y0 + li * lh, {
        size,
        color: focused || hover ? COLORS.itemHover : COLORS.item,
        shadow: false,
      });
    });
  });
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
  const footer = dialogueFooterSize(scale);
  const bodyOffset = 76 + Math.round(12 * (scale - 1));
  do {
    lineHeight = size + Math.round(11 * Math.min(scale, 1.25));
    lines = wrap(ctx, text, textW, { size, color: "" });
    choiceLines = choices.map((c) => wrap(ctx, c, textW - 80, { size: size - 2, color: "" }));
    heights = choiceLines.map((c) => Math.max(48, c.length * lineHeight + pad));
    const choicesHeight = heights.reduce((sum, h) => sum + h + 6, 0);
    height = Math.max(420, bodyOffset + lines.length * lineHeight + 30 + choicesHeight + 8 + footer + 20);
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

function dialogueFooterSize(scale: number): number {
  return Math.round(Math.min(24, 19 * scale));
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

/** The veil over the scene: flat, with a soft-edged hole where the speaker stands. */
const VEIL = "rgba(2,4,10,0.72)";
let holeSprite: HTMLCanvasElement | null = null;
function hole(): HTMLCanvasElement {
  if (holeSprite) return holeSprite;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(2,4,10,0.08)");
  grad.addColorStop(0.5, "rgba(2,4,10,0.22)");
  grad.addColorStop(0.82, "rgba(2,4,10,0.58)");
  grad.addColorStop(1, "rgba(2,4,10,0.72)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  holeSprite = c;
  return c;
}

function drawVeil(ctx: CanvasRenderingContext2D, spot: Spot | null, open: number): void {
  ctx.fillStyle = VEIL;
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
  ctx.drawImage(hole(), x0, y0, x1 - x0, y1 - y0);
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
  ctx.fillStyle = "rgba(10,23,34,0.98)";
  ctx.fillRect(60, boxTop, 1800, boxBottom - boxTop);
  ctx.strokeStyle = "#9a8052"; ctx.lineWidth = 2;
  ctx.strokeRect(61, boxTop + 1, 1798, boxBottom - boxTop - 2);
  ctx.beginPath(); ctx.rect(60, boxTop, 1800, boxBottom - boxTop); ctx.clip();
  ctx.translate(0, off);

  if (l.column) {
    const p = { x: 96, y: l.top + 40, w: 248, h: Math.min(330, l.height - 80) };
    const mix = stage ? stage.mix : 1;
    if (stage?.prev) drawPortrait(ctx, stage.prev, p, 1 - mix);
    if (m.portrait) drawPortrait(ctx, m.portrait, p, mix);
    else if (m.monogram !== undefined && m.monogram !== null) {
      ctx.save(); ctx.globalAlpha *= mix; drawMonogram(ctx, p, m.monogram, m.speakerAccent ?? "#e8c98a"); ctx.restore();
    }
  }
  if (m.speaker) {
    drawText(ctx, m.speaker, l.textX, l.top + 30, { size: Math.round(Math.min(30, 22 * m.scale)), color: m.speakerAccent ?? "#edce91", weight: "bold" });
  }
  drawRevealed(ctx, l.lines, typewriterSlice(m.text, m.reveal).length, l.textX, l.bodyY, {
    size: l.size, color: "#f0e7d6", lineHeight: l.lineHeight,
  });
  m.choices.forEach((choice, i) => {
    const r = l.rects[i], hover = m.hoverIndex === i;
    const seen = Boolean(choice.seen) && !hover;
    ctx.fillStyle = hover ? "#304955" : seen ? "#11242f" : "#152e3c";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const inset = Math.round(8 * m.scale + (l.lineHeight - (l.size - 2)) / 2);
    drawText(ctx, String(i + 1), r.x + 14, r.y + inset, { size: l.size - 2, color: seen ? "#a08a5c" : "#e8c98a" });
    (l.choiceLines[i] ?? []).forEach((line, li) => {
      drawText(ctx, line, r.x + 56, r.y + inset - 2 + li * l.lineHeight, {
        size: l.size - 2, color: hover ? "#ffffff" : seen ? "#8c9da6" : "#cbd9de",
      });
    });
  });
  const footer = m.choices.length
    ? (m.keyboard ? "Press a reply's number, or arrows and Enter" : m.touch ? "Tap a reply · long-press to leave" : "Click a reply or press its number · right-click to leave")
    : (m.keyboard ? "Enter to continue" : m.touch ? "Tap to continue" : "Click to continue");
  const fs = dialogueFooterSize(m.scale);
  drawText(ctx, footer, l.textX, l.top + l.height - fs - 20, { size: fs, color: "#c3d3da", shadow: false });
  ctx.restore();
}

export function dialogueHit(x: number, y: number, m: DialogueModel): number | null {
  const off = m.stage ? m.stage.offset(m.layout) : 0;
  const i = m.layout.rects.findIndex((r) => inRect(x, y - off, r));
  return i < 0 ? null : i;
}

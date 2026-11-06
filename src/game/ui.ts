/**
 * UI — the verb panel, sentence line, inventory, dialogue overlay and cursor.
 * Layout constants are shared between drawing and hit-testing so they can
 * never drift apart.
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H } from "../engine/view";
import { drawText, drawWrapped, wrap, typewriterSlice } from "../engine/text";
import { VERBS } from "./verbs";
import type { VerbId } from "./types";

export interface Chip { id: string; name: string }

/** Slots per inventory page. Beyond this the panel pages. */
export const INV_PER_PAGE = 8;

export interface PanelModel {
  verb: VerbId | null;
  objA: string | null;
  objB: string | null;
  narration: string | null;
  narrationFull: string | null;
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
  /** UI text scale (1, 1.25, 1.5). Layout grows to fit. */
  scale: number;
  /** The last pointer was a finger: hints speak of taps. */
  touch: boolean;
  /** The line on screen is fully shown and something is waiting for a click. */
  waiting: boolean;
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

export function verbRect(i: number, scale = 1): { x: number; y: number; w: number; h: number } {
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

function itemRect(i: number): { x: number; y: number; w: number; h: number } {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return {
    x: INV_X + col * (INV_W + INV_GAP),
    y: INV_Y + row * (INV_H + INV_GAP),
    w: INV_W,
    h: INV_H,
  };
}

// Pager, only drawn when there is more than one page.
const PAGE_PREV = { x: 1690, y: 880, w: 32, h: 28 };
const PAGE_NEXT = { x: 1782, y: 880, w: 32, h: 28 };

function inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
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

// ---------------------------------------------------------------- drawing

export function drawPanel(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  // backdrop
  const g = ctx.createLinearGradient(0, PANEL_Y, 0, LOGICAL_H);
  g.addColorStop(0, "rgba(10,14,24,0.96)");
  g.addColorStop(1, "rgba(4,6,12,0.99)");
  ctx.fillStyle = g;
  ctx.fillRect(0, PANEL_Y, LOGICAL_W, LOGICAL_H - PANEL_Y);

  // gold rule along the top of the panel
  ctx.strokeStyle = "rgba(201,162,74,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PANEL_Y + 1);
  ctx.lineTo(LOGICAL_W, PANEL_Y + 1);
  ctx.stroke();

  // subtle inner shadow beneath the rule
  const sh = ctx.createLinearGradient(0, PANEL_Y, 0, PANEL_Y + 26);
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, PANEL_Y, LOGICAL_W, 26);

  drawVerbs(ctx, model);
  drawSentence(ctx, model);
  drawInventory(ctx, model);
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

function drawSentence(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  const l = panelLayout(model.scale);
  if (model.narration) {
    const size = Math.round(26 * model.scale);
    const lh = Math.round(size * 1.31);
    const lines = wrap(ctx, model.narrationFull ?? model.narration, 1760, { size, color: "" });
    const height = Math.max(Math.round(92 * model.scale), lines.length * lh + 46);
    const top = Math.max(76, SCENE_H - height - 12);
    ctx.fillStyle = "rgba(5,13,22,0.94)";
    ctx.fillRect(40, top, 1840, height);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(40, top, 4, height);
    drawWrapped(ctx, model.narration, 68, top + 20, {
      size, color: COLORS.narration, maxWidth: 1760, lineHeight: lh,
    });
    if (model.waiting && model.narration === model.narrationFull) {
      // Something is waiting on this line: say how to move on.
      drawText(ctx, model.touch ? "tap \u25B8" : "click \u25B8", 1860, top + height - 34, {
        size: 20, color: "#e8c98a", align: "right", shadow: false,
      });
    }
  }

  const verbLabel = model.verb ? VERBS.find((v) => v.id === model.verb)?.label ?? "" : "";
  const a = model.objA ?? "";
  const b = model.objB ?? "";
  const line1 = [verbLabel, a].filter(Boolean).join(" ");

  const hint = (text: string) => drawText(ctx, text, SENT_X, l.line2Y, {
    size: fitSize(ctx, text, SENT_W, l.line2, 18), color: "#c3d3da", shadow: false,
  });
  if (line1) {
    drawText(ctx, line1, SENT_X, l.sentY + 4, {
      size: fitSize(ctx, line1, SENT_W, l.line1, 20, "bold"),
      color: COLORS.sentence,
      weight: "bold",
    });
  } else if (model.suggestLine) {
    drawText(ctx, model.suggestLine, SENT_X, l.sentY + 4, {
      size: fitSize(ctx, model.suggestLine, SENT_W, l.line1, 20, "bold"), color: "#ecd29a", weight: "bold",
    });
    if (!b) {
      hint(model.touch
        ? (model.suggestExit ? "tap again to go through · long-press to look" : "tap again to do it · long-press to look · or pick a verb")
        : (model.suggestExit ? "click to go through (double-click: at once) · right-click to look" : "click to do it · right-click to look · or pick a verb"));
    }
  } else {
    const idle = model.touch
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
    drawText(ctx, `${model.verb === "give" ? "to" : "with"} ${b}`, SENT_X, l.line2Y, {
      size: Math.round(Math.min(28, 25 * model.scale)),
      color: COLORS.sentence,
    });
  } else if (model.objA && (model.verb === "use" || model.verb === "give")) {
    hint(model.verb === "give" ? "Choose who receives it" : "Choose an object to use it with");
  }
}

function drawInventory(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  drawText(ctx, "INVENTORY", INV_X, 889, {
    size: 18,
    color: "#d4b064",
    weight: "bold",
    shadow: false,
  });
  ctx.font = "bold 18px Georgia, serif";
  const w = ctx.measureText("INVENTORY").width;
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
    const arrow = (r: { x: number; y: number; w: number; h: number }, glyph: string, enabled: boolean) => {
      ctx.fillStyle = enabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      drawText(ctx, glyph, r.x + r.w / 2, r.y + 3, {
        size: 20,
        color: enabled ? COLORS.item : "rgba(160,150,170,0.28)",
        align: "center",
        shadow: false,
      });
    };
    arrow(PAGE_PREV, "\u2039", page > 0);
    arrow(PAGE_NEXT, "\u203A", page < pages - 1);
    drawText(ctx, `${page + 1}/${pages}`, (PAGE_PREV.x + PAGE_NEXT.x + PAGE_NEXT.w) / 2, 884, {
      size: 18,
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
    ctx.fillStyle = hover ? "rgba(201,162,74,0.18)" : "rgba(255,255,255,0.035)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
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
    // Largest size, up to the scale, at which the name fits in two lines.
    let size = Math.round(19 * model.scale);
    let lines = wrap(ctx, it.name, r.w - 24, { size, color: "" });
    while (size > 18 && (lines.length > 2 || lines.length * (size + 4) > r.h - 12)) {
      size--;
      lines = wrap(ctx, it.name, r.w - 24, { size, color: "" });
    }
    const lh = size + 4;
    const top = r.y + Math.round((r.h - Math.min(2, lines.length) * lh) / 2) + 1;
    lines.slice(0, 2).forEach((ln, li) => {
      drawText(ctx, ln, r.x + 12, top + li * lh, {
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
  scale = 1
): void {
  if (label) {
    ctx.save();
    const size = Math.round(20 * scale);
    ctx.font = `italic ${size}px Georgia, serif`;
    const w = ctx.measureText(label).width;
    const bx = Math.max(8, Math.min(x + 24, LOGICAL_W - w - 28));
    const by = Math.max(8, Math.min(y + 22, LOGICAL_H - size - 24));
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

export interface DialogueModel {
  speaker: string;
  /** Accent colour for the speaker name, from the character registry. */
  speakerAccent?: string | null;
  text: string;
  reveal: number;
  portraitKey: string | null;
  portrait: HTMLImageElement | null;
  choices: { text: string; index: number }[];
  hoverIndex: number;
  layout: DialogueLayout;
  /** Text scale, as in the panel. */
  scale: number;
  touch: boolean;
}

interface DialogueLayout {
  top: number; height: number; size: number; lineHeight: number;
  bodyY: number; rects: { x: number; y: number; w: number; h: number }[];
}

export function dialogueLayout(ctx: CanvasRenderingContext2D, text: string, choices: string[], scale = 1): DialogueLayout {
  // Start at the scaled size and shrink only as far as needed to fit; never below 20px.
  let size = Math.round(27 * scale), lineHeight = 38;
  let bodyHeight = 0, heights: number[] = [], height = 0;
  const pad = Math.round(16 * scale);
  const footer = dialogueFooterSize(scale);
  const bodyOffset = 76 + Math.round(12 * (scale - 1));
  do {
    lineHeight = size + Math.round(11 * Math.min(scale, 1.25));
    bodyHeight = wrap(ctx, text, 1430, { size, color: "" }).length * lineHeight;
    heights = choices.map(c => Math.max(48, wrap(ctx, c, 1350, { size: size - 2, color: "" }).length * lineHeight + pad));
    const choicesHeight = heights.reduce((sum, h) => sum + h + 6, 0);
    height = Math.max(420, bodyOffset + bodyHeight + 30 + choicesHeight + 8 + footer + 20);
    if (height <= 1040 || size <= 20) break;
    size--;
  } while (true);
  const top = Math.max(20, 1060 - height);
  const bodyY = top + bodyOffset;
  let y = bodyY + bodyHeight + 30;
  return { top, height, size, lineHeight, bodyY,
    rects: heights.map(h => { const r = { x: 386, y, w: 1430, h }; y += h + 6; return r; }) };
}

function dialogueFooterSize(scale: number): number {
  return Math.round(Math.min(24, 19 * scale));
}

export function drawDialogue(ctx: CanvasRenderingContext2D, m: DialogueModel): void {
  const l = m.layout;
  ctx.fillStyle = "rgba(2,4,10,0.72)";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = "rgba(10,23,34,0.98)";
  ctx.fillRect(60, l.top, 1800, l.height);
  ctx.strokeStyle = "#9a8052"; ctx.lineWidth = 2;
  ctx.strokeRect(61, l.top + 1, 1798, l.height - 2);
  if (m.portrait) {
    const p = { x: 96, y: l.top + 40, w: 248, h: Math.min(330, l.height - 80) };
    ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
    const s = Math.max(p.w / m.portrait.width, p.h / m.portrait.height);
    ctx.drawImage(m.portrait, p.x + (p.w - m.portrait.width * s) / 2,
      p.y + (p.h - m.portrait.height * s) / 2, m.portrait.width * s, m.portrait.height * s);
    ctx.restore();
  }
  drawText(ctx, m.speaker, 386, l.top + 30, { size: Math.round(Math.min(30, 22 * m.scale)), color: m.speakerAccent ?? "#edce91", weight: "bold" });
  drawWrapped(ctx, typewriterSlice(m.text, m.reveal), 386, l.bodyY, {
    size: l.size, color: "#f0e7d6", maxWidth: 1430, lineHeight: l.lineHeight,
  });
  m.choices.forEach((choice, i) => {
    const r = l.rects[i], hover = m.hoverIndex === i;
    ctx.fillStyle = hover ? "#304955" : "#152e3c";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const inset = Math.round((l.lineHeight - (l.size - 2)) / 2) + 6;
    drawText(ctx, String(i + 1), r.x + 14, r.y + inset, { size: l.size - 2, color: "#e8c98a" });
    drawWrapped(ctx, choice.text, r.x + 56, r.y + inset - 2, {
      size: l.size - 2, color: hover ? "#ffffff" : "#cbd9de", maxWidth: 1350, lineHeight: l.lineHeight,
    });
  });
  const footer = m.choices.length
    ? (m.touch ? "Tap a reply · long-press to leave" : "Click a reply or press its number · right-click to leave")
    : (m.touch ? "Tap to continue" : "Click to continue");
  const fs = dialogueFooterSize(m.scale);
  drawText(ctx, footer, 386, l.top + l.height - fs - 20, { size: fs, color: "#c3d3da", shadow: false });
}

export function dialogueHit(x: number, y: number, m: DialogueModel): number | null {
  const i = m.layout.rects.findIndex(r => inRect(x, y, r));
  return i < 0 ? null : i;
}
